import { Profile } from "./useSocial";
import { BorderedAvatar } from "./components/cosmetics";

const GAME_META: Record<string, { name: string; icon: string }> = {
  impostor: { name: "L'Imposteur", icon: "🕵️" },
  quiz: { name: "Quiz Culture", icon: "🧠" },
  spyfall: { name: "Spyfall", icon: "🗺️" },
};

function gameInfo(id: string) {
  return GAME_META[id] ?? { name: id, icon: "🎮" };
}

function ago(ts: number): string {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function memberSince(ts?: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function ProfileShowcase({
  profile,
  isMe,
  onClose,
  onCustomize,
  onOpenAdmin,
  onLogout,
}: {
  profile: Profile;
  isMe: boolean;
  onClose: () => void;
  onCustomize?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
}) {
  const { stats, equipped, catalog } = profile;
  const sig = equipped.signature || "#7c6cff";
  const u = profile.user;
  const name = u?.display_name ?? "Joueur";
  const borderVisual = catalog.border.find((b) => b.id === equipped.border)?.visual ?? null;
  const title = catalog.title.find((t) => t.id === equipped.title);

  const played = stats.games_played ?? 0;
  const wins = stats.wins ?? 0;
  const winrate = played > 0 ? Math.round((wins / played) * 100) : 0;

  const breakdown = profile.breakdown ?? {};
  const history = profile.history ?? [];

  // trophées : cosmétiques débloqués par slot
  const trophySlots: { slot: "title" | "border" | "effect"; label: string }[] = [
    { slot: "title", label: "Titres" },
    { slot: "border", label: "Bordures" },
    { slot: "effect", label: "Effets" },
  ];

  return (
    <div className="pv" style={{ ["--sig" as string]: sig }}>
      <div className="ambient" />

      <div className="pv-head">
        <button className="tbl-back" onClick={onClose} title="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="pv-h1">{isMe ? "Mon profil" : "Profil"}</h1>
        {isMe && onCustomize && (
          <button className="pv-customize" onClick={onCustomize}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Personnaliser
          </button>
        )}
      </div>

      <div className="pv-scroll">
        {/* --- bandeau identité --- */}
        <div className="pv-hero">
          <div className="pv-hero-glow" />
          <div className="pv-hero-avatar">
            <BorderedAvatar url={u?.avatar_url ?? null} name={name} size={104} visual={borderVisual} signature={sig} />
            {profile.online && <span className="pv-online-dot" title="En ligne" />}
          </div>
          <div className="pv-hero-name">{name}</div>
          {title && (
            <div className="pv-title" style={{ background: `${sig}22`, borderColor: `${sig}55` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={sig} stroke="none">
                <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
              </svg>
              {title.name}
            </div>
          )}
          <div className="pv-hero-sub">
            <span className="mono">@{u?.username}</span>
            {profile.member_since && <span className="muted">· Membre depuis {memberSince(profile.member_since)}</span>}
          </div>
        </div>

        {/* --- stats principales --- */}
        <div className="pv-tiles">
          <Tile value={played} label="Parties" />
          <Tile value={wins} label="Victoires" accent />
          <Tile value={`${winrate}%`} label="Taux de victoire" />
          <Tile value={stats.games_hosted ?? 0} label="Tables hébergées" />
        </div>

        {/* --- par jeu --- */}
        {Object.keys(breakdown).length > 0 && (
          <Section title="Par jeu">
            <div className="pv-games">
              {Object.entries(breakdown).map(([gid, b]) => {
                const info = gameInfo(gid);
                const wr = b.played > 0 ? Math.round((b.wins / b.played) * 100) : 0;
                return (
                  <div key={gid} className="pv-game">
                    <span className="pv-game-icon">{info.icon}</span>
                    <div className="pv-game-body">
                      <div className="pv-game-name">{info.name}</div>
                      <div className="pv-game-stat muted small">
                        {b.played} partie{b.played > 1 ? "s" : ""} · {b.wins} victoire{b.wins > 1 ? "s" : ""} · {wr}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* --- détail Imposteur (si joué) --- */}
        {(stats.impostor_games ?? 0) > 0 && (
          <Section title="En imposteur">
            <div className="pv-tiles">
              <Tile value={stats.impostor_games ?? 0} label="Parties" small />
              <Tile value={stats.impostor_wins ?? 0} label="Victoires" small accent />
              <Tile value={stats.correct_votes ?? 0} label="Votes justes" small />
            </div>
          </Section>
        )}

        {/* --- trophées / cosmétiques débloqués --- */}
        <Section title="Trophées">
          {trophySlots.map(({ slot, label }) => {
            const items = catalog[slot];
            const unlocked = items.filter((i) => i.unlocked);
            return (
              <div key={slot} className="pv-trophy-group">
                <div className="pv-trophy-head">
                  <span className="pv-trophy-label">{label}</span>
                  <span className="muted small">
                    <strong style={{ color: "var(--txt)" }}>{unlocked.length}</strong> / {items.length}
                  </span>
                </div>
                <div className="pv-trophy-chips">
                  {unlocked.map((it) => (
                    <span
                      key={it.id}
                      className={"pv-chip" + (equipped[slot] === it.id ? " on" : "")}
                      style={equipped[slot] === it.id ? { borderColor: sig, background: `${sig}18` } : undefined}
                    >
                      {it.name}
                    </span>
                  ))}
                  {unlocked.length === 0 && <span className="muted small">Rien de débloqué</span>}
                </div>
              </div>
            );
          })}
        </Section>

        {/* --- historique --- */}
        <Section title="Dernières parties">
          {history.length === 0 ? (
            <p className="muted small" style={{ padding: "4px 2px" }}>Aucune partie jouée pour l'instant.</p>
          ) : (
            <div className="pv-history">
              {history.map((h, i) => {
                const info = gameInfo(h.game_id);
                return (
                  <div key={i} className="pv-hist-row">
                    <span className="pv-hist-icon">{info.icon}</span>
                    <div className="pv-hist-body">
                      <div className="pv-hist-name">{info.name}</div>
                      <div className="pv-hist-meta muted small">
                        {h.detail?.role === "impostor" ? "Imposteur · " : h.detail?.role === "civil" ? "Civil · " : ""}
                        {ago(h.played_at)}
                        {h.detail?.hosted ? " · hôte" : ""}
                      </div>
                    </div>
                    <span className={"pv-hist-result " + (h.won ? "win" : "loss")}>
                      {h.won ? "Victoire" : "Défaite"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* --- actions (mon profil uniquement) --- */}
        {isMe && (
          <div className="pv-actions">
            {onOpenAdmin && (
              <button className="pv-action admin" onClick={onOpenAdmin}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" />
                </svg>
                Back-office admin
              </button>
            )}
            {onLogout && (
              <button className="pv-action logout" onClick={onLogout}>
                Se déconnecter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ value, label, accent, small }: { value: number | string; label: string; accent?: boolean; small?: boolean }) {
  return (
    <div className={"pv-tile" + (small ? " small" : "")}>
      <div className={"pv-tile-value" + (accent ? " accent" : "")}>{value}</div>
      <div className="pv-tile-label">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pv-section">
      <div className="pv-section-title">{title}</div>
      {children}
    </div>
  );
}
