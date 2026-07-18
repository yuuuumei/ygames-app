import { useMemo, useState } from "react";
import { GamePlayer, GameView } from "./useSocial";
import Avatar from "./components/Avatar";

type Props = {
  view: GameView;
  myPlayerId: string;
  isHost: boolean;
  code: string;
  onAction: (action: object) => Promise<string | null>;
  onEnd: () => Promise<string | null>;
};

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: `${4 + i * 6}%`,
  size: `${6 + (i % 3) * 3}px`,
  color: ["#7c6cff", "#22d3ee", "#43d17a", "#ffc24b", "#ff4d5e"][i % 5],
  dur: `${2.4 + (i % 4) * 0.4}s`,
  delay: `${i * 0.16}s`,
}));

export default function ImpostorScreen(props: Props) {
  const { view } = props;
  const [clue, setClue] = useState("");
  const [myVote, setMyVote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = view.players.find((p) => p.id === props.myPlayerId);
  const byName = useMemo(() => {
    const m: Record<string, GamePlayer> = {};
    view.players.forEach((p) => (m[p.name] = p));
    return m;
  }, [view.players]);

  async function act(action: object) {
    setError(await props.onAction(action));
  }

  const stepIndex = view.phase === "clues" ? 0 : view.phase === "vote" ? 1 : 2;

  return (
    <div className="imp">
      <div className="imp-ambient" />
      <div className="imp-vignette" />

      {/* barre de progression */}
      <div className="imp-progress">
        <div className="imp-dossier-code mono">DOSSIER · {props.code}</div>
        <div className="imp-steps">
          {[
            { num: "01", label: "Indices" },
            { num: "02", label: "Vote" },
            { num: "03", label: "Révélation" },
          ].map((s, i) => {
            const active = i === stepIndex;
            const done = i < stepIndex;
            return (
              <div key={s.num} className="imp-step-wrap">
                <div className={"imp-step" + (active ? " active" : done ? " done" : "")}>
                  <span className="mono imp-step-num">{s.num}</span>
                  <span className="imp-step-label">{s.label}</span>
                </div>
                {i < 2 && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a4152" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <div className="imp-category muted small">{view.category}</div>
      </div>

      {view.phase === "clues" && <Clues {...props} me={me} clue={clue} setClue={setClue} act={act} error={error} />}
      {view.phase === "vote" && (
        <Vote {...props} me={me} myVote={myVote} setMyVote={setMyVote} act={act} />
      )}
      {view.phase === "over" && view.reveal && <Reveal {...props} me={me} byName={byName} />}
    </div>
  );
}

/* ---------------------------- PHASE INDICES ---------------------------- */

function Clues({
  view,
  isHost,
  me,
  clue,
  setClue,
  act,
}: Props & {
  me?: GamePlayer;
  clue: string;
  setClue: (v: string) => void;
  act: (a: object) => void;
  error: string | null;
}) {
  const myTurn = view.current_turn_id === me?.id && !me?.has_clue;
  const cluesList = view.players.filter((p) => view.clues[p.id]);

  function sendClue(e: React.FormEvent) {
    e.preventDefault();
    const text = clue.trim();
    if (!text || !myTurn) return;
    setClue("");
    act({ type: "clue", text });
  }

  return (
    <div className="imp-body">
      <div className="imp-stage">
        <div className="imp-kicker">Ton mot secret</div>

        <div className="imp-dossier-wrap">
          <div className="imp-dossier">
            <div className="imp-confidential mono">CONFIDENTIEL</div>
            <div className="imp-dossier-tag">
              <span />
              Tu fais partie de la bande
            </div>
            <div className="imp-word">{view.your_word}</div>
            <div className="imp-dossier-hint">
              Donne un indice qui prouve que tu connais le mot…{" "}
              <span style={{ color: "#c3c9d6" }}>sans le rendre évident.</span>
            </div>
          </div>
        </div>

        <div className="imp-turnorder">
          {view.players.map((p) => {
            const current = view.current_turn_id === p.id;
            return (
              <div
                key={p.id}
                className={"imp-turn-avatar" + (current ? " current" : "")}
                style={{ opacity: p.connected ? 1 : 0.45 }}
              >
                <Avatar url={p.avatar} name={p.name} />
                {p.has_clue && (
                  <span className="imp-turn-check">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#04140a" strokeWidth="4">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="imp-turn-text">
          {myTurn ? (
            <span style={{ fontWeight: 700, color: "#ffd479" }}>C'est ton tour</span>
          ) : (
            <>
              <span style={{ fontWeight: 700, color: "#ffd479" }}>C'est au tour de {view.current_turn}</span>{" "}
              de donner son indice…
            </>
          )}
        </div>

        <form className="imp-clue-form" onSubmit={sendClue}>
          <div className={"imp-clue-input" + (myTurn ? " active" : "")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            <input
              value={clue}
              onChange={(e) => setClue(e.currentTarget.value)}
              placeholder={myTurn ? "Ton indice, en un mot…" : "Attends ton tour…"}
              disabled={!myTurn}
              maxLength={60}
            />
          </div>
          <button className="imp-clue-send" disabled={!myTurn || !clue.trim()}>
            Envoyer
          </button>
        </form>
      </div>

      <aside className="imp-feed">
        <div className="imp-feed-head">
          <span className="imp-feed-title">Les indices</span>
          <span className="muted small">{cluesList.length}/{view.players.length}</span>
        </div>
        <div className="imp-feed-list">
          {cluesList.length === 0 && (
            <p className="muted small" style={{ textAlign: "center", padding: "1rem" }}>
              En attente du premier indice…
            </p>
          )}
          {cluesList.map((p) => (
            <div key={p.id} className="imp-clue-row">
              <Avatar url={p.avatar} name={p.name} className="imp-clue-avatar" />
              <div style={{ minWidth: 0 }}>
                <div className="imp-clue-name">{p.name}</div>
                <div className="imp-clue-word">{view.clues[p.id]}</div>
              </div>
            </div>
          ))}
        </div>
        {isHost && (
          <div className="imp-host-ctrl">
            <div className="imp-host-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffc24b" stroke="none">
                <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
              </svg>
              Tu es l'hôte
            </div>
            <button className="imp-open-vote" onClick={() => act({ type: "open_vote" })}>
              Ouvrir le vote
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ----------------------------- PHASE VOTE ----------------------------- */

function Vote({
  view,
  me,
  myVote,
  setMyVote,
  act,
}: Props & {
  me?: GamePlayer;
  myVote: string | null;
  setMyVote: (v: string) => void;
  act: (a: object) => void;
}) {
  const votedCount = view.players.filter((p) => p.has_voted).length;
  const total = view.players.filter((p) => p.connected).length;
  const canVote = !me?.has_voted;

  function vote(p: GamePlayer) {
    if (!canVote || p.id === me?.id) return;
    setMyVote(p.id);
    act({ type: "vote", target: p.id });
  }

  return (
    <div className="imp-vote">
      <div className="imp-vote-head">
        <div className="imp-kicker" style={{ color: "#ff8a95" }}>
          Le vote est ouvert
        </div>
        <div className="imp-vote-title">Qui est l'imposteur ?</div>
        <div className="muted">Clique sur le joueur que tu suspectes. Un seul vote.</div>
      </div>

      <div className="imp-vote-grid-wrap">
        <div className="imp-vote-grid">
          {view.players.map((p) => {
            const isYou = p.id === me?.id;
            const picked = myVote === p.id;
            return (
              <button
                key={p.id}
                className={"imp-vote-card" + (picked ? " picked" : "") + (isYou ? " you" : "")}
                disabled={!canVote || isYou}
                onClick={() => vote(p)}
              >
                {picked && <div className="imp-vote-badge">TON VOTE</div>}
                <div className="imp-vote-avatar">
                  <Avatar url={p.avatar} name={p.name} />
                  {picked && <span className="imp-vote-ring" />}
                </div>
                <div className="imp-vote-name">{p.name}</div>
                <div className="imp-vote-status">
                  {isYou ? (
                    <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 11 }}>c'est toi</span>
                  ) : p.has_voted ? (
                    <span className="imp-voted-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      A voté
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
                      réfléchit…
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="imp-vote-progress">
        <div className="imp-vote-bar">
          <div style={{ width: `${total ? (votedCount / total) * 100 : 0}%` }} />
        </div>
        <span className="imp-vote-count">
          <strong>{votedCount}</strong> / {total} ont voté
        </span>
      </div>
    </div>
  );
}

/* -------------------------- PHASE RÉVÉLATION -------------------------- */

function Reveal({
  view,
  isHost,
  me,
  byName,
  onEnd,
}: Props & { me?: GamePlayer; byName: Record<string, GamePlayer> }) {
  const reveal = view.reveal!;
  const impostorWon = reveal.impostors.some((n) => reveal.winners.includes(n));
  const bandeWon = !impostorWon;
  const didIWin = me ? reveal.winners.includes(me.name) : false;

  return (
    <div className="imp-reveal">
      <div
        className="imp-flood"
        style={{
          background: `radial-gradient(80% 70% at 50% 0%, ${bandeWon ? "rgba(67,209,122,.2)" : "rgba(255,77,94,.24)"}, transparent 60%)`,
        }}
      />
      {bandeWon && (
        <div className="imp-confetti">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              style={{
                left: c.left,
                width: c.size,
                height: c.size,
                background: c.color,
                animationDuration: c.dur,
                animationDelay: c.delay,
              }}
            />
          ))}
        </div>
      )}

      <div className="imp-reveal-inner">
        <div className={"imp-verdict" + (bandeWon ? " win" : " loss")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            {bandeWon ? (
              <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5Z" />
            ) : (
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
            )}
          </svg>
          {bandeWon ? "La bande gagne" : "L'imposteur gagne"}
        </div>

        <div className="imp-reveal-title">
          {bandeWon ? "L'imposteur est démasqué" : "L'imposteur s'en sort"}
        </div>
        <div className="imp-personal" style={{ color: didIWin ? "#59e08c" : "#ff8a95" }}>
          {didIWin ? "🏆 Tu gagnes cette manche" : "💀 Perdu cette fois"}
        </div>

        {/* imposteur(s) démasqué(s) */}
        <div className="imp-unmasked-row">
          {reveal.impostors.map((name) => {
            const p = byName[name];
            return (
              <div key={name} className="imp-unmasked">
                <div className="imp-unmasked-halo" />
                <span className="imp-unmasked-ring" />
                <div className="imp-unmasked-avatar">
                  <Avatar url={p?.avatar} name={name} />
                </div>
                <div className={"imp-stamp" + (bandeWon ? " caught" : " free")}>
                  {bandeWon ? "DÉMASQUÉ" : "LIBRE"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="imp-imposter-line">
          <strong>{reveal.impostors.join(", ")}</strong>{" "}
          <span className="muted">
            {reveal.impostors.length > 1 ? "étaient les imposteurs" : "était l'imposteur"}
          </span>
        </div>

        {/* les deux mots */}
        <div className="imp-words">
          <div className="imp-word-card bande">
            <div className="imp-word-label" style={{ color: "#59e08c" }}>
              Le mot de la bande
            </div>
            <div className="imp-word-value">{reveal.word_main}</div>
          </div>
          <div className="imp-word-vs mono">VS</div>
          <div className="imp-word-card imposteur">
            <div className="imp-word-label" style={{ color: "#ff8a95" }}>
              Le mot de l'imposteur
            </div>
            <div className="imp-word-value">{reveal.word_impostor}</div>
          </div>
        </div>

        {/* détail des votes */}
        {Object.keys(reveal.votes).length > 0 && (
          <div className="imp-votes-cast">
            {Object.entries(reveal.votes).map(([voter, target]) => (
              <div key={voter} className="imp-vote-chip">
                <Avatar url={byName[voter]?.avatar} name={voter} size={26} />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <Avatar url={byName[target]?.avatar} name={target} size={24} />
              </div>
            ))}
          </div>
        )}

        {/* actions */}
        <div className="imp-reveal-actions">
          {isHost ? (
            <button className="imp-replay" onClick={onEnd}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
              Retour à la table
            </button>
          ) : (
            <p className="muted small">L'hôte va vous ramener à la table…</p>
          )}
        </div>
      </div>
    </div>
  );
}
