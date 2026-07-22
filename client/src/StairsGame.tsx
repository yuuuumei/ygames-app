import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sound } from "./sound";

/* ============================================================
   STAIRS — la boucle de jeu.

   Un jeu de réflexe à 60 fps ne peut pas passer par l'état React :
   re-rendre l'arbre à chaque image tuerait le framerate. Les valeurs
   qui bougent en continu (défilement de la tour, jauge d'endurance)
   sont donc écrites DIRECTEMENT dans le DOM via des refs, et React ne
   gère que ce qui change à chaque marche (score, gemmes, mort).
   ============================================================ */

const STEP_H = 46; // hauteur d'une marche, en px
const STEP_W = 78; // décalage horizontal entre deux marches
const AHEAD = 26; // marches générées en avance
const GEM_EVERY = 7; // une gemme toutes les ~7 marches en moyenne

/* --- Endurance ---------------------------------------------------------
   Le chrono N'EST PAS remis à fond à chaque marche : c'est une réserve qui
   se vide en continu, et chaque marche n'y rajoute qu'un peu. Le joueur ne
   réagit donc plus marche par marche, il doit TENIR UNE CADENCE — et une
   hésitation ne se rattrape pas, elle se paie trois marches plus loin.

   La réserve démarre pleine et le reste tant que le rendu par marche
   dépasse ta cadence. Elle ne commence à fondre que le jour où la marche
   te rend moins de temps que tu n'en mets à sauter — à partir de là, tu
   as ces 2,2 s de sursis, et pas une de plus.                            */
const POOL_MAX = 2200; // matelas maximum, en ms
const REFILL_START = 700; // ms rendus par marche au démarrage
const REFILL_DECAY = 3; // ms de moins par marche gravie
const REFILL_MIN = 110; // asymptote : on tend vers l'impossible, sans palier

/* --- Zones maudites ----------------------------------------------------
   Passé une certaine altitude, des tronçons inversent gauche et droite.
   Ils sont visibles à l'avance (marches magenta) : la difficulté est de
   désapprendre son réflexe, pas de deviner.                              */
const CURSE_FROM = 40; // altitude à partir de laquelle ça peut tomber
const CURSE_MIN_LEN = 5;
const CURSE_MAX_LEN = 11;
const CURSE_GAP = 14; // marches tranquilles minimum entre deux zones
const CURSE_CHANCE = 0.09;

/** Temps rendu par une marche, à cette altitude. Décroît sans plancher utile. */
export function refillFor(score: number): number {
  return Math.max(REFILL_MIN, REFILL_START - score * REFILL_DECAY);
}

type Step = {
  id: number;
  dir: "L" | "R";
  x: number;
  y: number;
  gem: boolean;
  cursed: boolean;
};

/** État du générateur de tour : de quoi étaler les zones maudites. */
type Gen = { cursedLeft: number; cooldown: number };

/** Génère la marche qui suit `prev`. Tour aléatoire : chacun la sienne.
 *  `id` est un compteur qui ne redescend jamais : il sert de clé React
 *  stable même quand on élague le bas de la tour. */
function nextStep(prev: Step, id: number, gen: Gen): Step {
  const dir: "L" | "R" = Math.random() < 0.5 ? "L" : "R";

  // zone maudite : soit on en poursuit une, soit on en démarre une
  let cursed = false;
  if (gen.cursedLeft > 0) {
    gen.cursedLeft -= 1;
    cursed = true;
  } else if (gen.cooldown > 0) {
    gen.cooldown -= 1;
  } else if (id >= CURSE_FROM && Math.random() < CURSE_CHANCE) {
    gen.cursedLeft =
      CURSE_MIN_LEN + Math.floor(Math.random() * (CURSE_MAX_LEN - CURSE_MIN_LEN + 1)) - 1;
    gen.cooldown = CURSE_GAP;
    cursed = true;
  }

  return {
    id,
    dir,
    x: prev.x + (dir === "R" ? STEP_W : -STEP_W),
    y: prev.y - STEP_H,
    // pas de gemme sur les toutes premières marches : on laisse respirer
    gem: id > 4 && Math.random() < 1 / GEM_EVERY,
    cursed,
  };
}

export type RunResult = { score: number; coins: number };

/** L'état d'une run, créé AVANT le premier rendu : si la tour était générée
 *  dans un effet, le premier rendu n'aurait aucune marche à afficher et
 *  l'écran resterait vide jusqu'au premier saut. */
function createRun() {
  const gen: Gen = { cursedLeft: 0, cooldown: 0 };
  const steps: Step[] = [
    { id: 0, dir: "R", x: 0, y: 0, gem: false, cursed: false },
  ];
  let nextId = 1;
  while (steps.length < AHEAD) {
    steps.push(nextStep(steps[steps.length - 1], nextId++, gen));
  }
  return {
    steps,
    gen,
    index: 0, // marche sur laquelle on se tient
    nextId, // compteur de clés, jamais réutilisé
    score: 0,
    coins: 0,
    pool: POOL_MAX, // réserve d'endurance, en ms
    dead: false,
    camX: 0,
    camY: 0,
    raf: 0,
    last: 0,
  };
}

/** Cadence de remontée d'altitude en mode course. Envoyer à chaque marche
 *  saturerait le socket ; deux fois par seconde suffit pour que le tableau
 *  de bord des autres reste vivant. */
const PROGRESS_EVERY_MS = 450;

export default function StairsGame({
  onDead,
  onQuit,
  onProgress,
  paused,
}: {
  onDead: (r: RunResult) => void;
  onQuit: () => void;
  /** Mode course : appelé périodiquement pour diffuser l'altitude. */
  onProgress?: (r: RunResult) => void;
  /** Gèle la partie (compte à rebours de départ). */
  paused?: boolean;
}) {
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [flash, setFlash] = useState<"gem" | "miss" | null>(null);

  const towerRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  // tout l'état vivant du jeu, hors React — construit dès le premier rendu
  const runRef = useRef<ReturnType<typeof createRun> | null>(null);
  if (runRef.current === null) runRef.current = createRun();
  const g = runRef as { current: ReturnType<typeof createRun> };

  // les refs DOM n'existent qu'après le montage : on cadre alors la caméra
  useLayoutEffect(() => {
    paint(true);
  }, []);

  /** Écrit la position de la caméra et la jauge dans le DOM. */
  function paint(snap = false) {
    const s = g.current;
    const cur = s.steps[s.index];
    if (!cur) return;
    // la caméra vise la marche courante, en douceur
    const tx = -cur.x;
    const ty = -cur.y;
    if (snap) {
      s.camX = tx;
      s.camY = ty;
    } else {
      s.camX += (tx - s.camX) * 0.28;
      s.camY += (ty - s.camY) * 0.28;
    }
    if (towerRef.current) {
      towerRef.current.style.transform = `translate3d(${s.camX}px, ${s.camY}px, 0)`;
    }
    // la jauge et son pourcentage : écrits à la main à chaque frame, jamais
    // par React — c'est ce qui tient le 60 fps.
    const ratio = Math.max(0, Math.min(1, s.pool / POOL_MAX));
    const tone =
      ratio > 0.45
        ? ["linear-gradient(90deg,#2ba85d,#43d17a)", "var(--online)"]
        : ratio > 0.2
        ? ["linear-gradient(90deg,#d99215,#ffc24b)", "var(--gold)"]
        : ["linear-gradient(90deg,#c0303e,#ff4d5e)", "var(--danger)"];
    if (gaugeRef.current) {
      gaugeRef.current.style.transform = `scaleX(${ratio})`;
      gaugeRef.current.style.background = tone[0];
      gaugeRef.current.style.boxShadow =
        ratio <= 0.2 ? "0 0 16px rgba(255,77,94,.6)" : "none";
    }
    if (pctRef.current) {
      pctRef.current.textContent = `${Math.round(ratio * 100)}%`;
      pctRef.current.style.color = tone[1];
    }
  }

  // --- la boucle ------------------------------------------------------
  // `paused` est lu via une ref : la boucle est montée une seule fois et ne
  // doit pas être reconstruite à chaque changement de prop.
  const pausedRef = useRef(!!paused);
  pausedRef.current = !!paused;

  useEffect(() => {
    const s = g.current;
    s.last = performance.now();

    function frame(now: number) {
      const dt = Math.min(now - s.last, 100); // un lag ne doit pas tuer
      s.last = now;
      if (!s.dead && !pausedRef.current) {
        s.pool -= dt;
        if (s.pool <= 0) die();
      }
      paint();
      s.raf = requestAnimationFrame(frame);
    }
    s.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(s.raf);
  }, []);

  // --- mode course : on diffuse l'altitude à cadence fixe --------------
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useEffect(() => {
    if (!onProgress) return;
    const id = window.setInterval(() => {
      const s = g.current;
      if (s.dead) return;
      progressRef.current?.({ score: s.score, coins: s.coins });
    }, PROGRESS_EVERY_MS);
    return () => window.clearInterval(id);
  }, [!!onProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  function die() {
    const s = g.current;
    if (s.dead) return;
    s.dead = true;
    s.pool = 0;
    sound.play("defeat");
    playerRef.current?.classList.add("st-falling");
    // petite pause pour voir la chute avant l'écran de fin
    window.setTimeout(() => onDead({ score: s.score, coins: s.coins }), 620);
  }

  /** Le joueur tente un saut. Sur une marche maudite, les côtés sont inversés. */
  function jump(dir: "L" | "R") {
    const s = g.current;
    if (s.dead || pausedRef.current) return;
    const next = s.steps[s.index + 1];
    if (!next) return;

    const expected: "L" | "R" = next.cursed
      ? next.dir === "L"
        ? "R"
        : "L"
      : next.dir;

    if (expected !== dir) {
      setFlash("miss");
      die();
      return;
    }

    s.index += 1;
    s.score += 1;
    // la marche ne remet pas la jauge à fond : elle y rajoute, et de moins
    // en moins. C'est ce qui force à tenir une cadence.
    s.pool = Math.min(POOL_MAX, s.pool + refillFor(s.score));

    if (next.gem) {
      s.coins += 1;
      setCoins(s.coins);
      setFlash("gem");
      window.setTimeout(() => setFlash(null), 260);
      sound.play("click");
    }
    setScore(s.score);

    // on garde toujours de la tour devant nous
    while (s.steps.length < s.index + AHEAD) {
      s.steps.push(nextStep(s.steps[s.steps.length - 1], s.nextId++, s.gen));
    }
    // et on oublie ce qui est loin derrière (sinon le DOM enfle sans fin)
    if (s.index > 60) {
      const drop = s.index - 40;
      s.steps.splice(0, drop);
      s.index -= drop;
    }

    playerRef.current?.classList.remove("st-hop");
    void playerRef.current?.offsetWidth; // force le redémarrage de l'anim
    playerRef.current?.classList.add("st-hop");
  }

  // --- entrées : flèches, ZQSD/WASD, et clic sur les moitiés d'écran ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "q" || k === "a") {
        e.preventDefault();
        jump("L");
      } else if (k === "arrowright" || k === "d") {
        e.preventDefault();
        jump("R");
      } else if (k === "escape") {
        onQuit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const s = g.current;
  const visible = s.steps.slice(Math.max(0, s.index - 6), s.index + 14);
  const baseIdx = Math.max(0, s.index - 6);
  const inCurse = !!s.steps[s.index + 1]?.cursed;

  const stamPct = Math.round(Math.max(0, Math.min(1, s.pool / POOL_MAX)) * 100);

  return (
    <div
      className={
        "st-play" + (flash ? " st-flash-" + flash : "") + (inCurse ? " st-cursed" : "")
      }
    >
      <div className="st-gridlines" />

      {/* moities cliquables - jouable a la souris */}
      <div className="st-tap left" onPointerDown={() => jump("L")} />
      <div className="st-tap right" onPointerDown={() => jump("R")} />

      <div className="st-hud">
        <div>
          <div className="st-score-label">Altitude</div>
          <div className="st-score">
            {score}
            <small>m</small>
          </div>
        </div>

        <div className="st-stam">
          <div className="st-stam-top">
            <span className="st-stam-k">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
              </svg>
              Endurance
            </span>
            <span className="st-stam-pct" ref={pctRef}>
              {stamPct}%
            </span>
          </div>
          <div className="st-gauge-track">
            <div className="st-gauge" ref={gaugeRef} />
          </div>
        </div>

        <div className="st-coins">
          <span className="st-gem-icon" />
          <b>{String(coins).padStart(2, "0")}</b>
        </div>
      </div>

      {inCurse && (
        <div className="st-curse-banner">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M17 4v6h-6M7 20v-6h6" />
            <path d="M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4" />
          </svg>
          Zone maudite - controles inverses
        </div>
      )}

      <div className="st-stage">
        <div className="st-tower" ref={towerRef}>
          {visible.map((st, i) => {
            const idx = baseIdx + i;
            return (
              <div
                key={st.id}
                className={
                  "st-step" +
                  (idx === s.index ? " current" : "") +
                  (idx < s.index ? " past" : "") +
                  (st.cursed ? " cursed" : "")
                }
                style={{ transform: `translate3d(${st.x}px, ${st.y}px, 0)` }}
              >
                {st.gem && idx > s.index && <span className="st-gem" />}
              </div>
            );
          })}
        </div>
        <div className="st-player" ref={playerRef}>
          <div className="st-player-body" />
          <div className="st-player-eye" />
        </div>
      </div>

      <div className="st-keys">
        <div className="st-keys-grp">
          <kbd className="st-kbd">&#9664;</kbd>
          <kbd className="st-kbd">&#9654;</kbd>
          <b style={inCurse ? { color: "#f472d0" } : undefined}>
            {inCurse ? "inversees !" : "sauter du bon cote"}
          </b>
        </div>
        <div className="st-sep" />
        <div className="st-keys-grp">
          <kbd className="st-kbd">Echap</kbd>
          <b>quitter</b>
        </div>
      </div>
    </div>
  );
}
