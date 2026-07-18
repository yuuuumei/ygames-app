import { useEffect, useRef, useState } from "react";
import { CosmeticsMap, Friend, GameMeta, Lobby, PLAYABLE_GAMES } from "./useSocial";
import Avatar from "./components/Avatar";
import { BorderedAvatar } from "./components/cosmetics";
import Dropdown from "./components/Dropdown";
import { sound } from "./sound";
import { toast } from "./toast";

type Props = {
  lobby: Lobby;
  meId: number;
  friends: Friend[];
  games: GameMeta[];
  cosmetics: CosmeticsMap;
  initialGameId?: string | null;
  isAdmin?: boolean;
  onInvite: (userId: number) => Promise<string | null>;
  onKick: (userId: number) => Promise<string | null>;
  onAddBot: () => Promise<string | null>;
  onLeave: () => Promise<string | null>;
  onChat: (text: string) => Promise<string | null>;
  onStartGame: (gameId: string, config: Record<string, any>) => Promise<string | null>;
  onViewProfile: (userId: number) => void;
};

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function LobbyScreen(props: Props) {
  const { lobby } = props;
  const isHost = lobby.host_id === props.meId;
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lobby.chat.length]);

  // jeu sélectionné + config de la partie
  const firstPlayable =
    props.initialGameId && PLAYABLE_GAMES.has(props.initialGameId)
      ? props.initialGameId
      : props.games.find((g) => PLAYABLE_GAMES.has(g.id))?.id ?? "impostor";
  const [selectedGameId, setSelectedGameId] = useState(firstPlayable);
  const [config, setConfig] = useState<Record<string, any>>({});
  const selectedGame = props.games.find((g) => g.id === selectedGameId);

  useEffect(() => {
    const g = props.games.find((x) => x.id === selectedGameId);
    const init: Record<string, any> = {};
    g?.options.forEach((o) => (init[o.key] = o.default));
    setConfig(init);
  }, [selectedGameId, props.games.length]);

  const host = lobby.members.find((m) => m.id === lobby.host_id);
  const min = selectedGame?.min_players ?? 3;
  const max = selectedGame?.max_players ?? 12;
  const connectedCount = lobby.members.filter((m) => m.connected).length;
  const enough = connectedCount >= min;
  const freeSeats = Math.max(0, max - lobby.members.length);
  const maxImpostors = Math.max(1, connectedCount - 1);

  const memberIds = new Set(lobby.members.map((m) => m.id));
  const invitable = props.friends.filter((f) => f.online && !memberIds.has(f.id));

  async function copyCode() {
    await navigator.clipboard.writeText(lobby.code).catch(() => {});
    setCopied(true);
    sound.play("click");
    toast("Code copié");
    setTimeout(() => setCopied(false), 1600);
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
    if (!err) {
      setInvited((prev) => [...prev, id]);
      const f = props.friends.find((x) => x.id === id);
      toast(`Invitation envoyée à ${f?.display_name ?? "ton pote"}`);
    }
  }
  async function launch() {
    setError(await props.onStartGame(selectedGameId, config));
  }
  function setOpt(key: string, value: any) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  return (
    <div className="tbl">
      {/* en-tête table */}
      <header className="tbl-head">
        <div className="tbl-head-left">
          <button className="tbl-back" onClick={props.onLeave} title="Quitter la table">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="tbl-emblem">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#98a1b6" strokeWidth="2">
              <path d="M3 11h18M6 15h.01M10 15h.01" />
              <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
          </div>
          <div>
            <div className="tbl-title">La table de {host?.display_name ?? "…"}</div>
            <div className="muted small">On joue à quoi ce soir ?</div>
          </div>
        </div>
        <div className="tbl-code-wrap">
          <span className="tbl-code-label">Code de la table</span>
          <button className="tbl-code" onClick={copyCode}>
            <span className="tbl-code-value">{lobby.code}</span>
            <span className={"tbl-copy" + (copied ? " copied" : "")}>
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M9 3h9a2 2 0 0 1 2 2v9M15 21H6a2 2 0 0 1-2-2V8" />
                </svg>
              )}
              {copied ? "Copié" : "Copier"}
            </span>
          </button>
        </div>
      </header>

      <div className="tbl-body">
        {/* GAUCHE : la bande */}
        <aside className="tbl-side">
          <div className="tbl-side-head">
            <span className="tbl-side-title">La bande</span>
            <span className="muted small">
              <span style={{ color: "var(--txt)", fontWeight: 700 }}>{lobby.members.length}</span> / {max}
            </span>
          </div>

          <div className="tbl-seats">
            {lobby.members.map((m) => {
              const isMe = m.id === props.meId;
              const isTheHost = m.id === lobby.host_id;
              const cos = props.cosmetics[String(m.id)];
              const viewable = !m.is_bot;
              return (
                <div
                  key={m.id}
                  className={"tbl-seat" + (isMe ? " me" : "") + (viewable ? " clickable" : "")}
                  onClick={viewable ? () => props.onViewProfile(m.id) : undefined}
                  title={viewable ? "Voir le profil" : undefined}
                >
                  <div className={"tbl-seat-avatar" + (m.connected ? "" : " off")}>
                    {cos ? (
                      <BorderedAvatar
                        url={m.avatar_url}
                        name={m.display_name}
                        size={40}
                        visual={cos.border_visual}
                        signature={cos.signature}
                      />
                    ) : (
                      <Avatar url={m.avatar_url} name={m.display_name} />
                    )}
                    {isTheHost && (
                      <span className="tbl-crown" title="Hôte">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
                        </svg>
                      </span>
                    )}
                    <span
                      className="tbl-seat-dot"
                      style={{ background: m.connected ? "var(--online)" : "var(--txt-3)" }}
                    />
                  </div>
                  <div className="tbl-seat-info">
                    <div className="tbl-seat-name-row">
                      <span className="tbl-seat-name" style={{ color: m.connected ? "var(--txt)" : "var(--txt-2)" }}>
                        {m.display_name}
                      </span>
                      {isMe && <span className="tbl-badge-you">TOI</span>}
                      {m.is_bot && <span className="tbl-badge-bot">BOT</span>}
                    </div>
                    <div className="tbl-seat-status" style={{ color: m.connected ? "var(--txt-2)" : "var(--txt-3)" }}>
                      {m.is_bot ? "robot 🤖" : cos?.title ? cos.title : isTheHost ? "Hôte" : m.connected ? "en ligne" : "déconnecté 💤"}
                    </div>
                  </div>
                  {isHost && !isMe && (
                    <button
                      className="tbl-kick"
                      title="Exclure"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onKick(m.id);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {freeSeats > 0 && (
              <div className="tbl-empty-seat">
                <div className="tbl-empty-avatar">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="muted small">Places libres · {freeSeats}</span>
              </div>
            )}

            {props.isAdmin && isHost && freeSeats > 0 && (
              <button
                className="tbl-add-bot"
                onClick={async () => setError(await props.onAddBot())}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="8" width="16" height="11" rx="2" />
                  <path d="M12 8V4M9 13h.01M15 13h.01M8 4h8" />
                </svg>
                Ajouter un bot
                <span className="tbl-add-bot-tag">admin</span>
              </button>
            )}
          </div>

          {invitable.length > 0 && (
            <div className="tbl-invite">
              <div className="tbl-invite-label">Inviter — en ligne</div>
              {invitable.map((f) => (
                <div key={f.id} className="tbl-invite-row">
                  <div className="tbl-invite-avatar">
                    <Avatar url={f.avatar_url} name={f.display_name} />
                    <span className="tbl-seat-dot" style={{ background: "var(--online)" }} />
                  </div>
                  <span className="tbl-invite-name">{f.display_name}</span>
                  <button
                    className={"tbl-invite-btn" + (invited.includes(f.id) ? " done" : "")}
                    disabled={invited.includes(f.id)}
                    onClick={() => invite(f.id)}
                  >
                    {invited.includes(f.id) ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Invité
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Inviter
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* CENTRE : sélection du jeu + réglages */}
        <main className="tbl-center">
          {/* sélecteur de jeu */}
          <div className="tbl-field">
            <span className="tbl-field-label">Le jeu</span>
            <Dropdown
              value={selectedGameId}
              disabled={!isHost}
              onChange={setSelectedGameId}
              options={props.games.map((g) => ({
                value: g.id,
                label: g.name,
                disabled: !PLAYABLE_GAMES.has(g.id),
                hint: PLAYABLE_GAMES.has(g.id) ? undefined : "bientôt",
              }))}
            />
          </div>

          {/* résumé du jeu */}
          {selectedGame && (
            <div className="tbl-game-brief">
              <div className="tbl-game-brief-top">
                <span className="tbl-game-brief-name">{selectedGame.name}</span>
                <span className="muted small">
                  {min}–{max} joueurs · ~15 min
                </span>
              </div>
              <p className="tbl-game-brief-desc muted">{selectedGame.description}</p>
            </div>
          )}

          {/* réglages */}
          {selectedGame && selectedGame.options.length > 0 && (
            <div className="tbl-settings">
              <div className="tbl-settings-label">Réglages de la partie</div>
              {selectedGame.options.map((opt) => {
                const val = config[opt.key] ?? opt.default;
                const step = opt.step ?? 1;
                const optMin = opt.min ?? 1;
                // n_impostors : plafond dynamique (jamais que des imposteurs).
                const optMax = opt.key === "n_impostors" ? maxImpostors : (opt.max ?? 99);
                return (
                  <div key={opt.key} className="tbl-setting-row">
                    <span className="tbl-setting-name">{opt.label}</span>
                    {opt.choices ? (
                      <Dropdown
                        size="small"
                        value={String(val)}
                        disabled={!isHost}
                        onChange={(v) => setOpt(opt.key, v)}
                        options={opt.choices.map((ch) => ({ value: ch, label: ch }))}
                      />
                    ) : (
                      <div className="tbl-stepper">
                        <button
                          className="tbl-step-btn"
                          disabled={!isHost || Number(val) <= optMin}
                          onClick={() => setOpt(opt.key, Math.max(optMin, Number(val) - step))}
                        >
                          −
                        </button>
                        <span className="tbl-step-val">{Number(val)}</span>
                        <button
                          className="tbl-step-btn"
                          disabled={!isHost || Number(val) >= optMax}
                          onClick={() => setOpt(opt.key, Math.min(optMax, Number(val) + step))}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="tbl-center-spacer" />

          {/* zone de lancement */}
          <div className="tbl-launch-area">
            {isHost ? (
              enough ? (
                <>
                  <button className="tbl-launch" onClick={launch}>
                    <span className="hero-cta-sheen" />
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Lancer la partie
                  </button>
                  <span className="muted small" style={{ fontWeight: 500 }}>
                    {connectedCount} joueurs prêts.
                  </span>
                </>
              ) : (
                <>
                  <div className="tbl-launch-wait">
                    <span className="spinner" style={{ width: 18, height: 18, borderColor: "var(--txt-3)", borderTopColor: "transparent" }} />
                    Encore {min - connectedCount} joueur{min - connectedCount > 1 ? "s" : ""}…
                  </div>
                  <span className="muted small" style={{ fontWeight: 500 }}>
                    Invite tes potes ou partage le code.
                  </span>
                </>
              )
            ) : (
              <span className="muted" style={{ fontWeight: 500 }}>
                {host?.display_name} configure et lance le jeu 👑
              </span>
            )}
          </div>

          {error && <p className="error small" style={{ marginTop: 10 }}>{error}</p>}
        </main>

        {/* DROITE : chat */}
        <aside className="tbl-chat">
          <div className="tbl-chat-head">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98a1b6" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
            </svg>
            <span className="tbl-chat-title">Chat</span>
          </div>
          <div className="tbl-chat-msgs">
            {lobby.chat.length === 0 && (
              <p className="muted small" style={{ textAlign: "center", padding: "1rem" }}>
                Dis bonjour à ta bande. 👋
              </p>
            )}
            {lobby.chat.map((msg, i) => (
              <div key={i} className="tbl-msg">
                <Avatar url={msg.from.avatar_url} name={msg.from.display_name} className="tbl-msg-avatar" />
                <div style={{ minWidth: 0 }}>
                  <div className="tbl-msg-meta">
                    <span className="tbl-msg-name">{msg.from.display_name}</span>
                    <span className="tbl-msg-time">{fmtTime(msg.ts)}</span>
                  </div>
                  <div className="tbl-msg-text">{msg.text}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="tbl-chat-input" onSubmit={submitChat}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              placeholder="Écris un message…"
              maxLength={500}
            />
            <button type="submit" disabled={!draft.trim()} title="Envoyer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
