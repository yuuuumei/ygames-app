import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "./components/Avatar";
import SkribblCanvas, { PALETTE, SIZES, Stroke, Tool } from "./SkribblCanvas";
import { sound } from "./sound";

type BoardRow = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  connected: boolean;
  found: boolean;
  is_drawer: boolean;
  gained: number;
};
type ChatLine = { who: string | null; text: string; kind: "guess" | "system" | "found" };

export type SkribblView = {
  game: "skribbl";
  phase: "choosing" | "drawing" | "reveal" | "over";
  round: number;
  n_rounds: number;
  duration: number;
  ends_in_ms: number;
  drawer: string;
  drawer_name: string;
  is_drawer: boolean;
  board: BoardRow[];
  chat: ChatLine[];
  found: boolean;
  strokes: Stroke[];
  word: string | null;
  masked: string;
  length: number;
  choices?: string[];
  reveal?: { word: string; found: { name: string; points: number }[] };
  winners?: string[];
};

const TOOLS: [Tool, string, string][] = [
  ["pen", "✏️", "Crayon"],
  ["fill", "🪣", "Pot de peinture"],
  ["eraser", "🧽", "Gomme"],
];

export default function SkribblScreen({
  view,
  me,
  isHost,
  onAction,
  onEnd,
  push,
  subscribe,
}: {
  view: SkribblView;
  me: string;
  isHost: boolean;
  onAction: (action: object) => Promise<string | null>;
  onEnd: () => void;
  /** Envoi sans accusé, pour les traits. */
  push: (event: string, data: object) => void;
  subscribe: (event: string, handler: (d: any) => void) => () => void;
}) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#0b0d13");
  const [size, setSize] = useState(SIZES[1]);
  const [guess, setGuess] = useState("");
  const [left, setLeft] = useState(view.ends_in_ms);
  const [close, setClose] = useState(false);
  const advanced = useRef("");

  // --- chrono local, réamorcé à chaque changement de phase ---------------
  useEffect(() => {
    setLeft(view.ends_in_ms);
    const from = view.ends_in_ms;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      setLeft(Math.max(0, from - (performance.now() - t0)));
    }, 200);
    return () => window.clearInterval(id);
  }, [view.phase, view.round, view.drawer]); // eslint-disable-line react-hooks/exhaustive-deps

  // À l'expiration, on demande au serveur d'avancer. Il revérifie l'échéance
  // de son côté : ce n'est qu'un déclencheur, pas une décision.
  useEffect(() => {
    if (left > 0 || view.phase === "over") return;
    const key = `${view.phase}:${view.round}:${view.drawer}`;
    if (advanced.current === key) return;
    advanced.current = key;
    onAction({ type: "advance" });
  }, [left, view.phase, view.round, view.drawer]); // eslint-disable-line react-hooks/exhaustive-deps

  // « tu brûles » : signal privé, envoyé au seul joueur concerné
  useEffect(() => {
    return subscribe("game_event", (e: any) => {
      if (e?.type === "skribbl_close") {
        setClose(true);
        window.setTimeout(() => setClose(false), 1600);
      }
      if (e?.type === "skribbl_found") sound.play("reveal");
    });
  }, [subscribe]);

  const onStroke = useCallback((s: Stroke) => push("skribbl_draw", { stroke: s }), [push]);
  const subStroke = useCallback(
    (handler: (s: Stroke) => void) => subscribe("skribbl_stroke", handler),
    [subscribe]
  );

  function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    const t = guess.trim();
    if (!t) return;
    onAction({ type: "guess", text: t });
    setGuess("");
  }

  const secs = Math.ceil(left / 1000);
  const ratio = view.duration ? left / (view.duration * 1000) : 0;

  // ---------------- fin de partie ----------------
  if (view.phase === "over") {
    const iWon = view.winners?.includes(view.board.find((b) => b.id === me)?.name ?? "");
    return (
      <div className="sk-over">
        <div className="ambient" />
        <div className="sk-over-inner">
          <div className="sk-kicker">Partie terminée</div>
          <h1 className="sk-over-title">
            {view.winners && view.winners.length > 1
              ? `${view.winners.join(" et ")} ex æquo !`
              : `${view.winners?.[0] ?? "Personne"} gagne`}
          </h1>
          {iWon && <div className="sk-over-you">Beau coup de crayon. 🎨</div>}
          <div className="sk-podium">
            {view.board.map((p) => (
              <div
                key={p.id}
                className={
                  "sk-podium-row" + (p.rank === 1 ? " first" : "") + (p.id === me ? " me" : "")
                }
              >
                <span className="sk-rank mono">#{p.rank}</span>
                <Avatar url={p.avatar?.startsWith("http") ? p.avatar : null} name={p.name} size={34} />
                <span className="sk-podium-name">{p.name}</span>
                <span className="sk-podium-score mono">{p.score}</span>
              </div>
            ))}
          </div>
          {isHost ? (
            <button className="sk-btn" onClick={onEnd}>
              Retour à la table
            </button>
          ) : (
            <p className="muted small">L'hôte va ramener tout le monde à la table.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sk">
      {/* ---------------- barre du haut ---------------- */}
      <div className="sk-top">
        <div className={"sk-timer" + (ratio < 0.25 ? " urgent" : "")}>
          <div
            className="sk-timer-ring"
            style={{ ["--p" as string]: `${Math.round(ratio * 100)}%` }}
          >
            <i>{secs}</i>
          </div>
          <span className="sk-timer-label">Temps</span>
        </div>

        <div className="sk-word">
          {view.phase === "reveal" ? (
            <>
              <span className="sk-word-label">Le mot était</span>
              <span className="sk-word-value">{view.reveal?.word}</span>
            </>
          ) : view.is_drawer || view.found ? (
            <>
              <span className="sk-word-label">{view.is_drawer ? "Fais deviner" : "Trouvé !"}</span>
              <span className="sk-word-value">{view.word}</span>
            </>
          ) : (
            <>
              <span className="sk-word-hint mono">{view.masked.split("").join(" ")}</span>
              <span className="sk-word-count">{view.length} lettres</span>
            </>
          )}
        </div>

        <div className="sk-round">
          <div className="sk-round-n">
            Manche {view.round} / {view.n_rounds}
          </div>
          <div className="sk-round-l">{view.drawer_name} dessine</div>
        </div>
      </div>

      <div className="sk-body">
        {/* ---------------- joueurs ---------------- */}
        <aside className="sk-players">
          <div className="sk-col-head">Joueurs</div>
          <div className="sk-players-list">
          {view.board.map((p) => (
            <div
              key={p.id}
              className={
                "sk-player" +
                (p.rank === 1 && p.score > 0 ? " lead" : "") +
                (p.is_drawer ? " drawing" : "") +
                (p.found ? " found" : "") +
                (p.connected ? "" : " off")
              }
            >
              <span className="sk-rank mono">#{p.rank}</span>
              <Avatar url={p.avatar?.startsWith("http") ? p.avatar : null} name={p.name} size={32} />
              <div className="sk-player-text">
                <div className="sk-player-name">
                  {p.name}
                  {p.id === me && <span className="sk-you">TOI</span>}
                </div>
                <div className="sk-player-score mono">{p.score} pts</div>
              </div>
              {p.is_drawer && (
                <span className="sk-pencil" data-tip="Dessine" aria-label="Dessine">
                  ✏️
                </span>
              )}
              {p.found && !p.is_drawer && <span className="sk-check">✓</span>}
            </div>
          ))}
          </div>
        </aside>

        {/* ---------------- la toile ---------------- */}
        <main className="sk-stage">
          <SkribblCanvas
            canDraw={view.is_drawer && view.phase === "drawing"}
            tool={tool}
            color={color}
            size={size}
            strokes={view.strokes}
            onStroke={onStroke}
            subscribe={subStroke}
          />

          {/* choix du mot */}
          {view.phase === "choosing" && (
            <div className="sk-veil">
              {view.is_drawer ? (
                <>
                  <div className="sk-veil-title">Choisis ton mot</div>
                  <div className="sk-choices">
                    {view.choices?.map((w) => (
                      <button
                        key={w}
                        className="sk-choice"
                        onClick={() => onAction({ type: "pick", word: w })}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <div className="sk-veil-sub">Sans choix de ta part, le premier sera pris.</div>
                </>
              ) : (
                <>
                  <div className="sk-veil-title">{view.drawer_name} choisit un mot…</div>
                  <div className="sk-veil-sub">Prépare tes doigts.</div>
                </>
              )}
            </div>
          )}

          {/* révélation entre deux tours */}
          {view.phase === "reveal" && (
            <div className="sk-veil">
              <div className="sk-veil-label">Le mot était</div>
              <div className="sk-reveal-word">{view.reveal?.word}</div>
              {view.reveal?.found.length ? (
                <div className="sk-reveal-list">
                  {view.reveal.found.map((f, i) => (
                    <div key={i} className="sk-reveal-row">
                      <span>{f.name}</span>
                      <b className="mono">+{f.points}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sk-veil-sub">Personne n'a trouvé…</div>
              )}
            </div>
          )}

          {/* outils du dessinateur */}
          {view.is_drawer && view.phase === "drawing" && (
            <div className="sk-tools">
              <div className="sk-tool-group">
                {TOOLS.map(([id, icon, label]) => (
                  <button
                    key={id}
                    className={"sk-tool" + (tool === id ? " on" : "")}
                    onClick={() => setTool(id)}
                    data-tip={label}
                    aria-label={label}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              <div className="sk-divider" />

              <div className="sk-swatches">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    className={"sk-swatch" + (color === c && tool !== "eraser" ? " on" : "")}
                    style={{ background: c }}
                    onClick={() => {
                      setColor(c);
                      // choisir une couleur, c'est vouloir peindre : on sort de
                      // la gomme sans avoir à recliquer sur le crayon
                      if (tool === "eraser") setTool("pen");
                    }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>

              <div className="sk-divider" />

              <div className="sk-sizes">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    className={"sk-size" + (size === s ? " on" : "")}
                    onClick={() => setSize(s)}
                    aria-label={`Épaisseur ${s}`}
                  >
                    <span style={{ width: s, height: s }} />
                  </button>
                ))}
              </div>

              <div className="sk-tool-actions">
                <button
                  className="sk-act"
                  onClick={() => push("skribbl_draw", { stroke: { t: "undo" } })}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M9 14 4 9l5-5" />
                    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
                  </svg>
                  Annuler
                </button>
                <button
                  className="sk-act danger"
                  onClick={() => push("skribbl_draw", { stroke: { t: "clear" } })}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                  Effacer
                </button>
                <button className="sk-act" onClick={() => onAction({ type: "skip" })}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 4l10 8-10 8zM19 5v14" />
                  </svg>
                  Passer
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ---------------- chat ---------------- */}
        <aside className="sk-chat">
          <div className="sk-chat-head">Propositions</div>
          <div className="sk-chat-list">
            {view.chat.map((c, i) => (
              <div key={i} className={"sk-chat-line " + c.kind}>
                {c.who && <b>{c.who}</b>}
                {c.text}
              </div>
            ))}
          </div>
          <div className="sk-chat-foot">
          {close && (
            <div className="sk-close-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c2 4-1 5-1 8a3 3 0 0 0 6 0c0-1 0-2-.5-3 2 2 3.5 4.5 3.5 7a8 8 0 0 1-16 0c0-4 3-7 5-9 1.5-1.5 3-2 3-3Z" />
              </svg>
              Tu brûles…
            </div>
          )}
          <form className="sk-chat-form" onSubmit={submitGuess}>
            <input
              value={guess}
              onChange={(e) => setGuess(e.currentTarget.value)}
              placeholder={
                view.is_drawer
                  ? "Tu dessines — pas de triche 😉"
                  : view.found
                  ? "Tu as trouvé !"
                  : "Ta proposition…"
              }
              disabled={view.is_drawer || view.found || view.phase !== "drawing"}
              spellCheck={false}
              maxLength={80}
            />
          </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
