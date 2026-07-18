import { useState } from "react";
import { Friend } from "./useSocial";
import Avatar from "./components/Avatar";
import { toast } from "./toast";

type Props = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  onAdd: (username: string) => Promise<string | null>;
  onAccept: (userId: number) => Promise<string | null>;
  onDecline: (userId: number) => Promise<string | null>;
  onRemove: (userId: number) => Promise<string | null>;
  onViewProfile: (userId: number) => void;
};

/** Sidebar d'amis : repliée (72px) par défaut, s'élargit au survol.
 *  Une seule entité — le contenu (à largeur fixe) est simplement dévoilé. */
export default function FriendsRail(props: Props) {
  const [name, setName] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const online = props.friends.filter((f) => f.online);
  const offline = props.friends.filter((f) => !f.online);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setAddErr(null);
    const err = await props.onAdd(name.trim());
    setPending(false);
    if (err) {
      setAddErr(err);
    } else {
      toast(`Demande envoyée à ${name.trim()}`);
      setName("");
    }
  }

  return (
    <aside className="friends-sidebar">
      <div className="fs-inner">
        {/* en-tête */}
        <div className="fs-head">
          <div className="fs-head-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {online.length > 0 && <span className="fs-head-badge">{online.length}</span>}
          </div>
          <div className="fs-reveal">
            <div className="fs-head-title">La bande</div>
            <div className="fs-head-sub">
              <span style={{ color: "var(--online)", fontWeight: 700 }}>{online.length}</span> en
              ligne · {props.friends.length} pote{props.friends.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* ajout par pseudo */}
        <form className="fs-add" onSubmit={submitAdd}>
          <div className="fs-add-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="fs-reveal"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Ajouter par pseudo…"
              spellCheck={false}
            />
            {name.trim() && (
              <button type="submit" className="icon-btn ok fs-reveal" disabled={pending} title="Envoyer" style={{ width: 26, height: 26 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
          {addErr && <p className="error small fs-reveal" style={{ padding: "6px 4px 0" }}>{addErr}</p>}
        </form>

        <div className="fs-divider" />

        <div className="fs-scroll">
          {/* demandes reçues */}
          {props.incoming.length > 0 && (
            <>
              <div className="fs-label" style={{ color: "#a99cff" }}>
                Demande{props.incoming.length > 1 ? "s" : ""} reçue{props.incoming.length > 1 ? "s" : ""}
              </div>
              {props.incoming.map((r) => (
                <div key={r.id} className="fs-row fs-req">
                  <div className="fs-avatar">
                    <Avatar url={r.avatar_url} name={r.display_name} />
                  </div>
                  <div className="fs-info fs-reveal">
                    <div className="fs-name">{r.display_name}</div>
                    <div className="fs-status muted">veut rejoindre ta bande</div>
                  </div>
                  <button className="icon-btn ok fs-reveal" title="Accepter" onClick={() => props.onAccept(r.id)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                  <button className="icon-btn neutral fs-reveal" title="Refuser" onClick={() => props.onDecline(r.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* en ligne */}
          {online.length > 0 && (
            <>
              <div className="fs-label">En ligne — {online.length}</div>
              {online.map((f) => (
                <div key={f.id} className="fs-row clickable">
                  <div
                    className="fs-avatar fs-clicktarget"
                    onClick={() => props.onViewProfile(f.id)}
                    title="Voir le profil"
                  >
                    <Avatar url={f.avatar_url} name={f.display_name} />
                    <span className="fs-dot" style={{ background: "var(--online)" }} />
                  </div>
                  <div
                    className="fs-info fs-reveal fs-clicktarget"
                    onClick={() => props.onViewProfile(f.id)}
                    title="Voir le profil"
                  >
                    <div className="fs-name">{f.display_name}</div>
                    <div className="fs-status" style={{ color: "var(--online)" }}>
                      En ligne
                    </div>
                  </div>
                  <button className="icon-btn neutral fs-reveal" title="Retirer" onClick={() => props.onRemove(f.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* hors ligne */}
          {offline.length > 0 && (
            <>
              <div className="fs-label">Hors ligne — {offline.length}</div>
              {offline.map((f) => (
                <div
                  key={f.id}
                  className="fs-row offline clickable fs-clicktarget"
                  onClick={() => props.onViewProfile(f.id)}
                  title="Voir le profil"
                >
                  <div className="fs-avatar">
                    <Avatar url={f.avatar_url} name={f.display_name} />
                    <span className="fs-dot" style={{ background: "var(--txt-3)" }} />
                  </div>
                  <div className="fs-info fs-reveal">
                    <div className="fs-name" style={{ color: "#cdd3e0" }}>
                      {f.display_name}
                    </div>
                    <div className="fs-status muted">Hors ligne</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* demandes envoyées */}
          {props.outgoing.length > 0 && (
            <>
              <div className="fs-label">Envoyées</div>
              {props.outgoing.map((f) => (
                <div key={f.id} className="fs-row offline">
                  <div className="fs-avatar">
                    <Avatar url={f.avatar_url} name={f.display_name} />
                  </div>
                  <div className="fs-info fs-reveal">
                    <div className="fs-name" style={{ color: "#cdd3e0" }}>
                      {f.display_name}
                    </div>
                    <div className="fs-status muted">en attente…</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {props.friends.length === 0 &&
            props.incoming.length === 0 &&
            props.outgoing.length === 0 && (
              <p className="empty-hint fs-reveal">
                Ta bande est vide.
                <br />
                Ajoute un pote par son pseudo ci-dessus.
              </p>
            )}
        </div>
      </div>
    </aside>
  );
}
