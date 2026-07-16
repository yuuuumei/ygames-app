import { useState } from "react";
import { GamePlayer, GameView } from "./useSocial";

type Props = {
  view: GameView;
  myPlayerId: string; // String(user.id) — l'id de joueur dans la partie
  isHost: boolean;
  onAction: (action: object) => Promise<string | null>;
  onEnd: () => Promise<string | null>;
};

function PlayerAvatar({ p }: { p: GamePlayer }) {
  return p.avatar.startsWith("http") ? (
    <img className="gp-avatar" src={p.avatar} alt="" />
  ) : (
    <span className="gp-avatar gp-avatar-fallback">
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function ImpostorScreen(props: Props) {
  const { view } = props;
  const [clue, setClue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const me = view.players.find((p) => p.id === props.myPlayerId);
  const myTurn = view.phase === "clues" && view.current_turn_id === props.myPlayerId;
  const allCluesIn = view.players.every((p) => p.has_clue || !p.connected);

  async function act(action: object) {
    setError(await props.onAction(action));
  }

  async function sendClue(e: React.FormEvent) {
    e.preventDefault();
    const text = clue.trim();
    if (!text) return;
    setClue("");
    await act({ type: "clue", text });
  }

  return (
    <div className="game">
      <header className="game-header">
        <span className="game-badge">🕵️ L'Imposteur</span>
        <span className="muted small">Catégorie : {view.category}</span>
      </header>

      {/* Le mot secret — chacun ne voit que le sien (filtré côté serveur). */}
      {view.phase !== "over" && (
        <div className="word-card">
          <span className="word-label">Ton mot</span>
          <span className="word-value">{view.your_word}</span>
        </div>
      )}

      {/* Les joueurs */}
      <div className="gp-row">
        {view.players.map((p) => {
          const votable =
            view.phase === "vote" && p.id !== props.myPlayerId && !me?.has_voted;
          return (
            <button
              key={p.id}
              className={
                "gp-card" +
                (view.current_turn_id === p.id ? " gp-turn" : "") +
                (votable ? " gp-votable" : "")
              }
              disabled={!votable}
              onClick={() => act({ type: "vote", target: p.id })}
            >
              <PlayerAvatar p={p} />
              <span className="gp-name">{p.name}</span>
              <span className="gp-status">
                {!p.connected && "💤"}
                {view.phase === "clues" && p.has_clue && "💬"}
                {view.phase === "vote" && p.has_voted && "🗳️"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Les indices donnés */}
      {Object.keys(view.clues).length > 0 && (
        <div className="clues">
          {view.players
            .filter((p) => view.clues[p.id])
            .map((p) => (
              <div key={p.id} className="clue-line">
                <span className="chat-author">{p.name}</span>
                <span>{view.clues[p.id]}</span>
              </div>
            ))}
        </div>
      )}

      {/* Zone d'action selon la phase */}
      {view.phase === "clues" && (
        <div className="game-actions">
          {myTurn ? (
            <form className="chat-form clue-form" onSubmit={sendClue}>
              <input
                className="add-input"
                value={clue}
                onChange={(e) => setClue(e.currentTarget.value)}
                placeholder="Ton indice… (un mot, pas le mot !)"
                maxLength={60}
                autoFocus
              />
              <button className="add-btn" disabled={!clue.trim()}>
                Donner
              </button>
            </form>
          ) : (
            <p className="muted">
              C'est au tour de <strong>{view.current_turn}</strong>…
            </p>
          )}
          {props.isHost && (
            <button
              className={"add-btn vote-open-btn" + (allCluesIn ? "" : " subtle")}
              onClick={() => act({ type: "open_vote" })}
            >
              Passer au vote {allCluesIn ? "" : "(indices en cours…)"}
            </button>
          )}
        </div>
      )}

      {view.phase === "vote" && (
        <p className="muted game-actions">
          {me?.has_voted
            ? "Vote enregistré. On attend les autres…"
            : "Vote : clique sur le joueur que tu soupçonnes."}
        </p>
      )}

      {view.phase === "over" && view.reveal && (
        <div className="reveal">
          <h2 className="reveal-title">
            {view.reveal.winners.includes(me?.name ?? "")
              ? "🏆 Victoire !"
              : "💀 Défaite…"}
          </h2>
          <p>
            L'imposteur était <strong>{view.reveal.impostors.join(", ")}</strong>
          </p>
          <p className="muted">
            Mot des civils : <strong>{view.reveal.word_main}</strong> · Mot de
            l'imposteur : <strong>{view.reveal.word_impostor}</strong>
          </p>
          <div className="reveal-votes">
            {Object.entries(view.reveal.votes).map(([voter, target]) => (
              <span key={voter} className="muted small">
                {voter} → {target}
              </span>
            ))}
          </div>
          {props.isHost ? (
            <button className="discord-btn reconnect-btn" onClick={props.onEnd}>
              Retour au lobby
            </button>
          ) : (
            <p className="muted small">Le host va vous ramener au lobby…</p>
          )}
        </div>
      )}

      {error && <p className="error small">{error}</p>}
    </div>
  );
}
