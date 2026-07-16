import { useEffect, useRef, useState } from "react";
import { Friend, Lobby } from "./useSocial";

type Props = {
  lobby: Lobby;
  meId: number;
  friends: Friend[];
  onInvite: (userId: number) => Promise<string | null>;
  onKick: (userId: number) => Promise<string | null>;
  onLeave: () => Promise<string | null>;
  onChat: (text: string) => Promise<string | null>;
};

function Avatar({ user }: { user: Friend }) {
  return user.avatar_url ? (
    <img className="member-avatar" src={user.avatar_url} alt="" />
  ) : (
    <span className="member-avatar member-avatar-fallback">
      {user.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function LobbyScreen(props: Props) {
  const { lobby } = props;
  const isHost = lobby.host_id === props.meId;
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<number[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll du chat vers le bas à chaque message.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lobby.chat.length]);

  async function copyCode() {
    await navigator.clipboard.writeText(lobby.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submitChat(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await props.onChat(text);
  }

  async function invite(id: number) {
    const err = await props.onInvite(id);
    if (!err) setInvited((prev) => [...prev, id]);
  }

  // Amis en ligne qui ne sont pas déjà dans le lobby.
  const memberIds = new Set(lobby.members.map((m) => m.id));
  const invitable = props.friends.filter((f) => f.online && !memberIds.has(f.id));

  return (
    <div className="lobby">
      <header className="lobby-header">
        <div>
          <h1 className="lobby-title">Lobby</h1>
          <button className="lobby-code" onClick={copyCode} title="Copier le code">
            {lobby.code} {copied ? "✓ copié" : "⧉"}
          </button>
        </div>
        <button className="ghost-btn" onClick={props.onLeave}>
          Quitter
        </button>
      </header>

      <div className="lobby-body">
        <aside className="lobby-side">
          <h2 className="online-title">Joueurs — {lobby.members.length}</h2>
          <ul className="online-list">
            {lobby.members.map((m) => (
              <li key={m.id} className="online-item">
                <Avatar user={m} />
                <span className="online-name">
                  {m.display_name}
                  {m.id === lobby.host_id && (
                    <span title="Host"> 👑</span>
                  )}
                </span>
                <span className={m.connected ? "dot dot-on" : "dot dot-idle"} />
                {isHost && m.id !== props.meId && (
                  <button
                    className="mini-btn no ghost"
                    title="Exclure"
                    onClick={() => props.onKick(m.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          {invitable.length > 0 && (
            <>
              <h2 className="online-title invite-title">Inviter</h2>
              <ul className="online-list">
                {invitable.map((f) => (
                  <li key={f.id} className="online-item">
                    <Avatar user={f} />
                    <span className="online-name">{f.display_name}</span>
                    <button
                      className="mini-btn invite"
                      disabled={invited.includes(f.id)}
                      onClick={() => invite(f.id)}
                    >
                      {invited.includes(f.id) ? "✓" : "+"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="lobby-chat">
          <div className="chat-messages">
            {lobby.chat.length === 0 && (
              <p className="muted small">
                Le salon est à vous. Les jeux arrivent bientôt ici. 🎲
              </p>
            )}
            {lobby.chat.map((msg, i) => (
              <div key={i} className="chat-msg">
                <span className="chat-author">{msg.from.display_name}</span>
                <span className="chat-text">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={submitChat}>
            <input
              className="add-input"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder="Écrire au salon…"
              maxLength={500}
            />
            <button className="add-btn" disabled={!draft.trim()}>
              Envoyer
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
