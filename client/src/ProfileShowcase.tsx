import { useState } from "react";
import { Profile, HistoryEntry } from "./useSocial";
import { BorderedAvatar } from "./components/cosmetics";

const GAME_META: Record<string, { name: string; icon: string; cls: string }> = {
  impostor: { name: "L'Imposteur", icon: "?", cls: "imp" },
  quiz: { name: "Quiz Culture", icon: "🧠", cls: "quiz" },
  wordle: { name: "Le Mot du jour", icon: "MOT", cls: "mot" },
  wikidle: { name: "Wikidle", icon: "📖", cls: "wiki" },
  stairs: { name: "STAIRS", icon: "🏔️", cls: "stairs" },
  spyfall: { name: "Spyfall", icon: "🗺️", cls: "spy" },
};

function gameInfo(id: string) {
  return GAME_META[id] ?? { name: id, icon: "🎮", cls: "" };
}

/** « hier · 22:14 » — le jour en relatif, l'heure en absolu. */
function whenLabel(ts: number): string {
  const date = new Date(ts * 1000);
  const hm = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (days < 1) return `aujourd'hui · ${hm}`;
  if (days === 1) return `hier · ${hm}`;
  if (days < 7) return `${days} j · ${hm}`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function memberSince(ts?: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** La ligne de contexte sous le nom du jeu : ce qui rend l'historique lisible. */
function describe(h: HistoryEntry, isMe: boolean): string {
  const d = h.detail ?? {};
  const you = isMe ? "Tu étais" : "Il/elle était";
  const bits: string[] = [];

  if (h.game_id === "impostor" && d.role) {
    bits.push(d.role === "impostor" ? `${you} l'imposteur` : `${you} dans la bande`);
  }
  if (typeof d.rank === "number" && typeof d.players === "number") {
    bits.push(`${d.rank}e sur ${d.players}`);
  } else if (typeof d.players === "number") {
    bits.push(`table à ${d.players}`);
  }
  if (typeof d.tries === "number") {
    bits.push(h.won ? `trouvé en ${d.tries} essai${d.tries > 1 ? "s" : ""}` : "pas trouvé");
  }
  if (h.game_id === "stairs") {
    bits.push(`${d.score ?? 0} marche${(d.score ?? 0) > 1 ? "s" : ""} gravie${(d.score ?? 0) > 1 ? "s" : ""}`);
  }
  if (d.daily) bits.unshift("Défi du jour");
  if (d.hosted) bits.push(isMe ? "tu recevais" : "hôte de la table");
  return bits.join(" · ");
}

export default function ProfileShowcase({
  profile,
  isMe,
  onClose,
  onCustomize,
  onOpenAdmin,
  onLogout,
  onInvite,
}: {
  profile: Profile;
  isMe: boolean;
  onClose: () => void;
  onCustomize?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  onInvite?: () => void;
}) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const { stats, equipped, catalog } = profile;
  const sig = equipped.signature || "#7c6cff";
  const u = profile.user;
  const name = u?.display_name ?? "Joueur";
  const borderVisual = catalog.border.find((b) => b.id === equipped.border)?.visual ?? null;
  const title = catalog.title.find((t) => t.id === equipped.title);
  const borderName = catalog.border.find((b) => b.id === equipped.border)?.name;
  const effectName = catalog.effect.find((e) => e.id === equipped.effect)?.name;

  const played = stats.games_played ?? 0;
  const wins = stats.wins ?? 0;
  const winrate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const impGames = stats.impostor_games ?? 0;
  const impWins = stats.impostor_wins ?? 0;
  const impRate = impGames > 0 ? Math.round((impWins / impGames) * 100) : null;

  const breakdown = profile.breakdown ?? {};
  const history = profile.history ?? [];

  // collection : total débloqué, tous slots confondus
  const allItems = [...catalog.title, ...catalog.border, ...catalog.effect];
  const unlocked = allItems.filter((i) => i.unlocked).length;

  return (
    <div className="pv" style={{ ["--sig" as string]: sig }}>
      <div className="ambient" />

      <div className="pv-head">
        <button className="pv-back" onClick={onClose} data-tip="Retour" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="pv-kicker">{isMe ? "Ma vitrine" : "Vitrine de joueur"}</span>
      </div>

      <div className="pv-body">
        {/* ---------------- colonne gauche : identité ---------------- */}
        <div className="pv-left">
          <div className="pv-hero">
            <div className="pv-hero-avatar">
              <BorderedAvatar
                url={u?.avatar_url ?? null}
                name={name}
                size={96}
                visual={borderVisual}
                signature={sig}
              />
              {profile.online && <span className="pv-online-dot" data-tip="En ligne" aria-label="En ligne" />}
            </div>
            <div className="pv-hero-name">{name}</div>
            {title && (
              <div className="pv-title-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill={sig} stroke="none">
                  <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
                </svg>
                <b>{title.name}</b>
              </div>
            )}
            <div className="pv-hero-tag mono">
              @{u?.username}
              {profile.member_since && ` · membre depuis ${memberSince(profile.member_since)}`}
            </div>
          </div>

          {/* panoplie équipée */}
          <div className="pv-loadout">
            <LoadoutRow label="Bordure" value={borderName ?? "Aucune"}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </LoadoutRow>
            <LoadoutRow label="Effet de victoire" value={effectName ?? "Aucun"}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
              </svg>
            </LoadoutRow>
            <div className="pv-lo">
              <span className="pv-lo-swatch" />
              <div className="pv-lo-text">
                <div className="pv-lo-key">Collection</div>
                <div className="pv-lo-val">
                  {unlocked} / {allItems.length} débloqués
                </div>
              </div>
            </div>
          </div>

          {/* action principale, en bas de colonne */}
          {isMe && onCustomize && (
            <button className="pv-cta" onClick={onCustomize}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Personnaliser mon profil
            </button>
          )}
          {!isMe && onInvite && (
            <button className="pv-cta" onClick={onInvite}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
              Inviter à ma table
            </button>
          )}

          {isMe && (onOpenAdmin || onLogout) && (
            <div className="pv-side-actions">
              {onOpenAdmin && (
                <button className="pv-side-btn" onClick={onOpenAdmin}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" />
                  </svg>
                  Back-office
                </button>
              )}
              {onLogout && (
                <button className="pv-side-btn danger" onClick={onLogout}>
                  Se déconnecter
                </button>
              )}
            </div>
          )}
        </div>

        {/* ---------------- colonne droite : chiffres + historique ---------------- */}
        <div className="pv-right">
          <div className="pv-stats">
            <Stat value={played} label="Parties jouées" />
            <Stat value={wins} label="Victoires" tone="win" />
            <Stat value={played > 0 ? `${winrate}%` : "—"} label="Taux de victoire" />
            {impRate !== null ? (
              <Stat value={`${impRate}%`} label="Réussite en imposteur" tone="gold" />
            ) : (
              <Stat value={stats.games_hosted ?? 0} label="Tables hébergées" />
            )}
          </div>

          {Object.keys(breakdown).length > 0 && (
            <div className="pv-games">
              {Object.entries(breakdown).map(([gid, b]) => {
                const info = gameInfo(gid);
                const wr = b.played > 0 ? Math.round((b.wins / b.played) * 100) : 0;
                return (
                  <div key={gid} className="pv-game">
                    <span className={"pv-gm " + info.cls}>{info.icon}</span>
                    <div className="pv-game-text">
                      <div className="pv-game-name">{info.name}</div>
                      <div className="pv-game-sub mono">
                        {b.played} · {b.wins} V · {wr}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pv-hist">
            <div className="pv-hist-head">
              <div className="pv-hist-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 3v5h5" />
                  <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                  <path d="M12 7v5l4 2" />
                </svg>
                Historique récent
              </div>
              {history.length > 0 && (
                <span className="pv-hist-count">
                  {history.length} dernière{history.length > 1 ? "s" : ""} partie
                  {history.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <div className="pv-empty">
                <span className="pv-empty-icon">🎲</span>
                <p>{isMe ? "Tu n'as encore joué aucune partie." : "Aucune partie pour l'instant."}</p>
              </div>
            ) : (
              <div className="pv-hist-list">
                {history.map((h, i) => {
                  const info = gameInfo(h.game_id);
                  const ctx = describe(h, isMe);
                  const summary = h.detail?.summary;
                  const open = openRow === i;
                  return (
                    <div key={i} className={"pv-entry" + (open ? " open" : "")}>
                      <div
                        className={"pv-row" + (summary ? " clickable" : "")}
                        onClick={summary ? () => setOpenRow(open ? null : i) : undefined}
                      >
                        <span className={"pv-gm " + info.cls}>{info.icon}</span>
                        <div className="pv-row-info">
                          <div className="pv-row-game">{info.name}</div>
                          {ctx && <div className="pv-row-meta">{ctx}</div>}
                        </div>
                        {h.game_id === "stairs" && h.detail?.solo ? (
                          // run d'arcade en solo : pas de victoire, juste une altitude
                          <span className="pv-res neutral mono">{h.detail?.score ?? 0} m</span>
                        ) : (
                          <span className={"pv-res " + (h.won ? "win" : "loss")}>
                            {h.won ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            )}
                            {h.won ? "Gagné" : "Perdu"}
                          </span>
                        )}
                        <span className="pv-when mono">{whenLabel(h.played_at)}</span>
                        {summary && (
                          <svg
                            className="pv-chev"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        )}
                      </div>
                      {open && summary && <MatchDetail gameId={h.game_id} summary={summary} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Le récit d'une partie, déplié sous sa ligne d'historique. */
function MatchDetail({ gameId, summary }: { gameId: string; summary: any }) {
  // --- défis du jour : la réponse et les tentatives ---
  if (gameId === "wordle" || gameId === "wikidle") {
    const guesses: string[] = summary.guesses ?? [];
    return (
      <div className="pv-detail">
        <div className="pv-detail-facts">
          <Fact label="Réponse" value={summary.answer ?? "?"} strong />
          <Fact label="Propositions" value={String(guesses.length)} />
        </div>
        {guesses.length > 0 && (
          <div className="pv-detail-block">
            <div className="pv-detail-label">Tes propositions</div>
            <div className="pv-guesses">
              {guesses.map((g, i) => (
                <span key={i} className={"pv-guess" + (i === guesses.length - 1 ? " last" : "")}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
        {summary.url && (
          <a className="pv-detail-link" href={summary.url} target="_blank" rel="noreferrer">
            Lire l'article sur Wikipédia →
          </a>
        )}
      </div>
    );
  }

  // --- stairs en course : le classement de la table ---
  if (gameId === "stairs" && summary.race) {
    const table: any[] = summary.table ?? [];
    return (
      <div className="pv-detail">
        <div className="pv-detail-block">
          <div className="pv-detail-label">Altitude de chacun</div>
          <div className="pv-standings">
            {table.map((p, i) => (
              <div key={i} className={"pv-standing" + (p.rank === 1 ? " first" : "")}>
                <span className="pv-standing-rank mono">#{p.rank}</span>
                <span className="pv-standing-name">{p.name}</span>
                <span className="pv-standing-score mono">{p.score} m</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- stairs en solo : la run en chiffres ---
  if (gameId === "stairs") {
    const secs = Math.round((summary.duration_ms ?? 0) / 1000);
    return (
      <div className="pv-detail">
        <div className="pv-detail-facts">
          <Fact label="Marches" value={String(summary.score ?? 0)} strong />
          <Fact label="Gemmes" value={String(summary.coins ?? 0)} />
          <Fact label="Durée" value={secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`} />
        </div>
      </div>
    );
  }

  // --- quiz : le classement complet ---
  if (gameId === "quiz") {
    const table: any[] = summary.table ?? [];
    return (
      <div className="pv-detail">
        <div className="pv-detail-facts">
          <Fact label="Questions" value={String(summary.questions ?? "?")} />
          <Fact label="Catégorie" value={summary.category ?? "Aléatoire"} />
        </div>
        <div className="pv-detail-block">
          <div className="pv-detail-label">Classement final</div>
          <div className="pv-standings">
            {table.map((p, i) => (
              <div key={i} className={"pv-standing" + (p.rank === 1 ? " first" : "")}>
                <span className="pv-standing-rank mono">#{p.rank}</span>
                <span className="pv-standing-name">{p.name}</span>
                <span className="pv-standing-score mono">{p.score} pt{p.score > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- imposteur : le mot, le traître, et qui a voté quoi ---
  const table: any[] = summary.table ?? [];
  return (
    <div className="pv-detail">
      <div className="pv-detail-facts">
        <Fact label="Mot de la bande" value={summary.word ?? "?"} strong />
        {summary.word_impostor && summary.word_impostor !== summary.word && (
          <Fact label="Mot de l'imposteur" value={summary.word_impostor} />
        )}
        <Fact label="Catégorie" value={summary.category ?? "Aléatoire"} />
      </div>
      <div className="pv-detail-block">
        <div className="pv-detail-label">Autour de la table</div>
        <div className="pv-table">
          {table.map((p, i) => (
            <div key={i} className={"pv-seat" + (p.impostor ? " impostor" : "")}>
              <div className="pv-seat-head">
                <span className="pv-seat-name">{p.name}</span>
                {p.impostor && <span className="pv-seat-badge">imposteur</span>}
              </div>
              <div className="pv-seat-line">
                {p.clue ? (
                  <>
                    indice <em>« {p.clue} »</em>
                  </>
                ) : (
                  <span className="pv-seat-mute">aucun indice</span>
                )}
                {p.voted && <> · a voté {p.voted}</>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="pv-fact">
      <div className="pv-fact-label">{label}</div>
      <div className={"pv-fact-value" + (strong ? " strong" : "")}>{value}</div>
    </div>
  );
}

function LoadoutRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="pv-lo">
      <span className="pv-lo-icon">{children}</span>
      <div className="pv-lo-text">
        <div className="pv-lo-key">{label}</div>
        <div className="pv-lo-val">{value}</div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: "win" | "gold" }) {
  return (
    <div className="pv-stat">
      <div className={"pv-stat-n" + (tone ? " " + tone : "")}>{value}</div>
      <div className="pv-stat-l">{label}</div>
    </div>
  );
}
