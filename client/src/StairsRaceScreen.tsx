import { useEffect, useRef, useState } from "react";
import Avatar from "./components/Avatar";
import StairsGame, { RunResult } from "./StairsGame";
import { sound } from "./sound";

/* ============================================================
   STAIRS en course — la coquille multijoueur.

   La simulation reste 100 % locale (voir StairsGame) : cet écran
   ne fait qu'envoyer l'altitude au serveur et afficher celle des
   autres. Rien de ce qui est reçu ne pilote le jeu du joueur.
   ============================================================ */

type Standing = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  coins: number;
  alive: boolean;
  connected: boolean;
  rank: number;
};

type RaceView = {
  game: "stairs";
  phase: "racing" | "over";
  starts_in_ms: number;
  show_rivals: boolean;
  me: { score: number; coins: number; alive: boolean };
  alive_count: number;
  total: number;
  standings?: Standing[];
  winners?: string[];
};

const Crown = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
  </svg>
);

export default function StairsRaceScreen({
  view,
  me,
  isHost,
  onAction,
  onEnd,
}: {
  view: RaceView;
  me: string;
  isHost: boolean;
  onAction: (action: object) => Promise<string | null>;
  onEnd: () => void;
}) {
  // compte à rebours local, amorcé sur la DURÉE envoyée par le serveur
  const [countdown, setCountdown] = useState(view.starts_in_ms);
  const deadSent = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const started = performance.now();
    const from = countdown;
    const id = window.setInterval(() => {
      const left = Math.max(0, from - (performance.now() - started));
      setCountdown(left);
      if (left <= 0) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const racing = countdown <= 0;
  const secs = Math.ceil(countdown / 1000);

  useEffect(() => {
    if (racing) sound.play("your_turn");
  }, [racing]);

  function report(r: RunResult) {
    onAction({ type: "progress", score: r.score, coins: r.coins });
  }

  function fell(r: RunResult) {
    if (deadSent.current) return;
    deadSent.current = true;
    onAction({ type: "dead", score: r.score, coins: r.coins });
  }

  const standings = view.standings ?? [];
  const best = Math.max(1, ...standings.map((s) => s.score), view.me.score);

  // ---------------- fin de course ----------------
  if (view.phase === "over") {
    const myRow = standings.find((s) => s.id === me);
    const iWon = !!myRow && myRow.rank === 1;
    const winners = view.winners ?? [];
    return (
      <div className="st-race-over">
        <div className="st-race-kicker">Course terminée</div>
        <h1 className="st-race-winner">
          {winners.length > 1
            ? `${winners.join(" et ")} ex æquo !`
            : `${winners[0] ?? "Personne"} remporte la course`}
        </h1>
        {iWon && (
          <div className="st-race-you">
            <span className="st-crown">
              <Crown size={16} />
            </span>
            Et c'est toi. 🏔️
          </div>
        )}

        <div className="st-race-podium">
          {standings.map((p) => (
            <div
              key={p.id}
              className={
                "st-race-row" + (p.rank === 1 ? " first" : "") + (p.id === me ? " me" : "")
              }
            >
              <span className="st-rank">{p.rank}</span>
              <div className="st-race-name">
                {p.rank === 1 && (
                  <span className="st-crown">
                    <Crown />
                  </span>
                )}
                {p.name}
                {p.id === me && <span className="st-you">TOI</span>}
              </div>
              <span className="st-race-coins">
                <span className="st-gem-icon" />
                {p.coins}
              </span>
              <span className="st-race-score">
                {p.score}
                <small>m</small>
              </span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button className="st-back-btn" onClick={onEnd}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Retour à la table
          </button>
        ) : (
          <p className="muted small" style={{ marginTop: 24 }}>
            L'hôte va ramener tout le monde à la table.
          </p>
        )}
      </div>
    );
  }

  // ---------------- en course ----------------
  return (
    <div className="st-race">
      <div className={"st-race-main" + (racing ? "" : " dimmed")}>
        <StairsGame onDead={fell} onQuit={() => {}} onProgress={report} paused={!racing} />

        {!racing && (
          <div className="st-veil st-countdown">
            <div className="st-countdown-n">{secs > 0 ? secs : "GO"}</div>
            <div className="st-countdown-sub">Prépare tes doigts…</div>
          </div>
        )}

        {racing && !view.me.alive && (
          <div className="st-veil st-spectate">
            <div className="st-spectate-ic">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v9m0 0-4-4m4 4 4-4M5 19h14" />
              </svg>
            </div>
            <div className="st-spectate-title">
              Tu es tombé à <b>{view.me.score}</b> marches
            </div>
            <div className="st-spectate-sub">
              {view.alive_count > 0 ? (
                <>
                  <span className="st-live-dot" />
                  {view.alive_count} joueur{view.alive_count > 1 ? "s" : ""} encore en course…
                </>
              ) : (
                "Décompte des résultats…"
              )}
            </div>
          </div>
        )}
      </div>

      {view.show_rivals && (
        <aside className="st-race-side">
          <div className="st-race-side-head">
            <div className="st-race-side-title">
              <span className="st-live-dot" />
              {racing ? "En course" : "Sur la ligne"}
            </div>
            <div className="st-race-side-count">
              {racing ? `${view.alive_count}/${view.total}` : view.total}
            </div>
          </div>
          <div className="st-race-list">
            {standings.map((p) => (
              <div
                key={p.id}
                className={
                  "st-rival" +
                  (p.rank === 1 && p.score > 0 ? " lead" : "") +
                  (p.id === me ? " me" : "") +
                  (p.alive ? "" : " out")
                }
              >
                <div className="st-rival-top">
                  {/* `avatar` porte l'URL Discord, ou l'emoji de repli */}
                  <Avatar
                    url={p.avatar?.startsWith("http") ? p.avatar : null}
                    name={p.name}
                    size={30}
                  />
                  <div className="st-rival-name">
                    {p.rank === 1 && p.score > 0 && (
                      <span className="st-crown">
                        <Crown size={12} />
                      </span>
                    )}
                    {p.name}
                    {p.id === me && <span className="st-you">TOI</span>}
                  </div>
                  <div className="st-rival-alt">
                    {racing ? (
                      <>
                        {p.score}
                        <small>m</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="st-rival-bar">
                  <span style={{ width: `${racing ? (p.score / best) * 100 : 0}%` }} />
                </div>
                {!p.alive && (
                  <div className="st-rival-out">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                    tombé
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
