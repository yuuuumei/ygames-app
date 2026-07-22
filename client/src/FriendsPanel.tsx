import { useState } from "react";
import { Friend } from "./useSocial";

type Props = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  onAdd: (username: string) => Promise<string | null>;
  onAccept: (userId: number) => Promise<string | null>;
  onDecline: (userId: number) => Promise<string | null>;
  onRemove: (userId: number) => Promise<string | null>;
};

function Avatar({ user }: { user: Friend }) {
  return user.avatar_url ? (
    <img className="online-avatar" src={user.avatar_url} alt="" />
  ) : (
    <span className="online-avatar online-avatar-fallback">
      {user.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function FriendsPanel(props: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || pendingAdd) return;
    setPendingAdd(true);
    setError(null);
    const err = await props.onAdd(name.trim());
    setPendingAdd(false);
    if (err) {
      setError(err);
    } else {
      setName("");
    }
  }

  // Amis en ligne d'abord, puis alphabétique.
  const sorted = [...props.friends].sort(
    (a, b) =>
      Number(b.online ?? false) - Number(a.online ?? false) ||
      a.display_name.localeCompare(b.display_name),
  );
  const onlineCount = props.friends.filter((f) => f.online).length;

  return (
    <section className="online-panel">
      <h2 className="online-title">
        Amis — {onlineCount}/{props.friends.length} en ligne
      </h2>

      <form className="add-friend" onSubmit={submit}>
        <input
          className="add-input"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Pseudo Discord…"
          spellCheck={false}
        />
        <button className="add-btn" disabled={pendingAdd || !name.trim()}>
          Ajouter
        </button>
      </form>
      {error && <p className="error small">{error}</p>}

      {props.incoming.length > 0 && (
        <div className="requests">
          <h3 className="requests-title">Demandes reçues</h3>
          {props.incoming.map((u) => (
            <div key={u.id} className="online-item">
              <Avatar user={u} />
              <span className="online-name">{u.display_name}</span>
              <button className="mini-btn ok" onClick={() => props.onAccept(u.id)}>
                ✓
              </button>
              <button className="mini-btn no" onClick={() => props.onDecline(u.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <ul className="online-list">
        {sorted.map((f) => (
          <li key={f.id} className="online-item">
            <Avatar user={f} />
            <span className="online-name">{f.display_name}</span>
            <span className={f.online ? "dot dot-on" : "dot dot-idle"} />
            <button
              className="mini-btn no ghost"
              data-tip="Retirer cet ami" aria-label="Retirer cet ami"
              onClick={() => props.onRemove(f.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {props.outgoing.length > 0 && (
        <p className="muted small outgoing-note">
          En attente : {props.outgoing.map((u) => u.display_name).join(", ")}
        </p>
      )}

      {props.friends.length === 0 &&
        props.incoming.length === 0 &&
        props.outgoing.length === 0 && (
          <p className="muted small">
            Ajoute tes potes avec leur pseudo Discord (pas le nom d'affichage).
          </p>
        )}
    </section>
  );
}
