import { useState } from "react";
import { CatalogItem, Profile } from "./useSocial";
import { BorderedAvatar, VictoryEffect } from "./components/cosmetics";
import { sound } from "./sound";

type User = { display_name: string; username: string; avatar_url: string | null };
type Slot = "title" | "border" | "effect";

const SWATCHES = ["#7c6cff", "#22d3ee", "#43d17a", "#ffc24b", "#ff4d5e", "#eb459e", "#5865f2", "#14b8a6"];

const TABS: { slot: Slot; label: string; hint: string }[] = [
  { slot: "title", label: "Titres", hint: "Un seul titre affiché sous ton pseudo." },
  { slot: "border", label: "Bordures d'avatar", hint: "L'anneau autour de ton avatar." },
  { slot: "effect", label: "Effet de victoire", hint: "Ta mise en scène au moment de gagner." },
];

export default function ProfileCustomize({
  user,
  profile,
  onSet,
  onBack,
}: {
  user: User;
  profile: Profile;
  onSet: (slot: string, value: string) => Promise<string | null>;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Slot>("title");
  const [playKey, setPlayKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { equipped, catalog } = profile;
  const sig = equipped.signature;
  const equippedTitle = catalog.title.find((t) => t.id === equipped.title);
  const equippedBorderVisual = catalog.border.find((b) => b.id === equipped.border)?.visual ?? null;
  const equippedEffectVisual = catalog.effect.find((e) => e.id === equipped.effect)?.visual ?? null;
  const items = catalog[tab];
  const equippedId = equipped[tab];
  const unlockedCount = items.filter((i) => i.unlocked).length;

  async function pick(slot: string, value: string) {
    const err = await onSet(slot, value);
    setError(err);
    if (!err) sound.play("click");
  }

  function testEffect() {
    setPlayKey((k) => k + 1);
    sound.play("victory");
  }

  return (
    <div className="prof">
      <div className="ambient" />

      {/* aperçu — colonne gauche */}
      <aside className="prof-preview">
        <div className="prof-preview-label">Aperçu en direct</div>

        <div className="prof-card" style={{ ["--sig" as string]: sig }}>
          <div className="prof-effect-layer">
            <VictoryEffect visual={equippedEffectVisual} signature={sig} playKey={playKey} />
          </div>
          <div className="prof-avatar-wrap">
            <div className="prof-avatar-float">
              <BorderedAvatar
                url={user.avatar_url}
                name={user.display_name}
                size={92}
                visual={equippedBorderVisual}
                signature={sig}
              />
              <span className="prof-status-dot" />
            </div>
            <div className="prof-name">{user.display_name}</div>
            <div
              className="prof-title-badge"
              style={{ background: `${sig}22`, borderColor: `${sig}55` }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={sig} stroke="none">
                <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
              </svg>
              <span>{equippedTitle?.name ?? "—"}</span>
            </div>
            <div className="prof-tag mono">@{user.username}</div>
          </div>
        </div>

        <div className="prof-sig">
          <div className="prof-section-label">Couleur de signature</div>
          <div className="prof-swatches">
            {SWATCHES.map((col) => (
              <button
                key={col}
                className={"prof-swatch" + (col.toLowerCase() === sig.toLowerCase() ? " active" : "")}
                style={{ background: col }}
                onClick={() => pick("signature", col)}
              >
                {col.toLowerCase() === sig.toLowerCase() && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <button className="prof-test" onClick={testEffect}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Tester mon effet de victoire
        </button>
      </aside>

      {/* personnalisation — colonne droite */}
      <section className="prof-custom">
        <div className="prof-head">
          <button className="tbl-back" onClick={onBack} title="Retour à la vitrine">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="prof-h1">Personnaliser</h1>
        </div>

        <div className="prof-tabs">
          {TABS.map((t) => (
            <button
              key={t.slot}
              className={"prof-tab" + (tab === t.slot ? " active" : "")}
              onClick={() => setTab(t.slot)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="prof-content">
          <div className="prof-content-head">
            <span className="muted small">{TABS.find((t) => t.slot === tab)!.hint}</span>
            <span className="muted small">
              <strong style={{ color: "var(--txt)" }}>{unlockedCount}</strong> / {items.length} débloqués
            </span>
          </div>

          <div className={"prof-grid " + tab}>
            {items.map((it) => (
              <CosmeticCard
                key={it.id}
                item={it}
                slot={tab}
                sig={sig}
                equipped={it.id === equippedId && it.unlocked}
                userName={user.display_name}
                userAvatar={user.avatar_url}
                onPick={() => it.unlocked && pick(tab, it.id)}
              />
            ))}
          </div>
          {error && <p className="error small" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      </section>
    </div>
  );
}

function CosmeticCard({
  item,
  slot,
  sig,
  equipped,
  userName,
  userAvatar,
  onPick,
}: {
  item: CatalogItem;
  slot: Slot;
  sig: string;
  equipped: boolean;
  userName: string;
  userAvatar: string | null;
  onPick: () => void;
}) {
  return (
    <button
      className={"prof-cos" + (equipped ? " equipped" : "") + (item.unlocked ? "" : " locked")}
      style={equipped ? { borderColor: sig, background: `${sig}18` } : undefined}
      onClick={onPick}
      disabled={!item.unlocked}
    >
      {equipped && (
        <span className="prof-cos-tick" style={{ background: sig }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#06070c" strokeWidth="3.4">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          ÉQUIPÉ
        </span>
      )}
      {!item.unlocked && (
        <span className="prof-cos-lock">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      )}

      <div className={"prof-cos-visual " + slot}>
        <CosmeticVisual slot={slot} visual={item.visual} sig={sig} locked={!item.unlocked} userName={userName} userAvatar={userAvatar} />
      </div>
      <div className="prof-cos-name" style={{ color: item.unlocked ? "var(--txt)" : "var(--txt-2)" }}>
        {item.name}
      </div>
      <div className="prof-cos-sub">
        {item.sub}
        {item.progress && <span className="prof-cos-progress"> · {item.progress}</span>}
      </div>
    </button>
  );
}

const ENGINE_ICON: Record<string, string> = {
  confetti: "M8 5v14l11-7z",
  rings: "M12 2a10 10 0 1 0 0 20",
  sweep: "M9 18V5l12-2v13",
  glitch: "M4 4h6v6H4zM14 14h6v6h-6z",
  rain: "M12 3v18M7 8l5-5 5 5",
};

function CosmeticVisual({
  slot,
  visual,
  sig,
  locked,
  userName,
  userAvatar,
}: {
  slot: Slot;
  visual: any | null;
  sig: string;
  locked: boolean;
  userName: string;
  userAvatar: string | null;
}) {
  if (slot === "border") {
    return <BorderedAvatar url={userAvatar} name={userName} size={48} visual={visual} signature={sig} />;
  }
  if (slot === "effect") {
    const icon = ENGINE_ICON[visual?.engine] ?? "M8 5v14l11-7z";
    return (
      <div
        className="prof-effect-icon"
        style={{ background: locked ? "#161923" : `${sig}22`, color: locked ? "#5f6982" : sig }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d={icon} />
        </svg>
      </div>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={locked ? "#3a4152" : sig} stroke="none">
      <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
    </svg>
  );
}
