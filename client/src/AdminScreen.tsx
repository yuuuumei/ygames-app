import { useEffect, useState } from "react";
import { BorderedAvatar, VictoryEffect } from "./components/cosmetics";
import AdminQuiz from "./AdminQuiz";
import { toast } from "./toast";
import { sound } from "./sound";

type Ask = (event: string, data?: object) => Promise<any>;
type Upload = (file: File) => Promise<{ url?: string; kind?: string; error?: string }>;
type Slot = "title" | "border" | "effect";

type CatalogRow = {
  id: string;
  slot: Slot;
  name: string;
  sub: string;
  locked_sub: string;
  cond_stat: string | null;
  cond_value: number;
  visual: string | null;
  sort_order: number;
  enabled: number;
};

type Meta = {
  stats: Record<string, string>;
  border_styles: string[];
  effect_engines: string[];
  color_modes: string[];
};

type Draft = {
  isNew: boolean;
  id: string;
  slot: Slot;
  name: string;
  sub: string;
  locked_sub: string;
  cond_stat: string; // "" = gratuit, "event" = verrouillé, sinon une stat
  cond_value: number;
  visual: any;
  sort_order: number;
  enabled: boolean;
};

const SAMPLE_SIG = "#7c6cff";

function defaultVisual(slot: Slot): any {
  if (slot === "border")
    return { style: "ring", colorMode: "signature", color: "#7c6cff", thickness: 0.035, glow: 0.5, spin: false, speed: 5 };
  if (slot === "effect") return { engine: "confetti", colorMode: "multi", color: "#7c6cff" };
  return null;
}

function rowToDraft(r: CatalogRow): Draft {
  return {
    isNew: false,
    id: r.id,
    slot: r.slot,
    name: r.name,
    sub: r.sub,
    locked_sub: r.locked_sub,
    cond_stat: r.cond_stat ?? "",
    cond_value: r.cond_value,
    visual: r.visual ? JSON.parse(r.visual) : defaultVisual(r.slot),
    sort_order: r.sort_order,
    enabled: !!r.enabled,
  };
}

function newDraft(slot: Slot): Draft {
  return {
    isNew: true,
    id: "",
    slot,
    name: "",
    sub: "",
    locked_sub: "",
    cond_stat: "",
    cond_value: 1,
    visual: defaultVisual(slot),
    sort_order: 100,
    enabled: true,
  };
}

export default function AdminScreen({
  ask,
  onClose,
  uploadMedia,
}: {
  ask: Ask;
  onClose: () => void;
  uploadMedia: Upload;
}) {
  const [tab, setTab] = useState<"cosmetics" | "quiz">("cosmetics");
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    ask("admin_catalog").then((r) => r.catalog && setCatalog(r.catalog));
    ask("admin_meta").then((r) => r.stats && setMeta(r));
  }, [ask]);

  async function save() {
    if (!draft) return;
    const r = await ask("admin_catalog_save", { item: draft });
    if (r.error) {
      toast(r.error, "info");
    } else {
      setCatalog(r.catalog);
      setDraft(null);
      toast("Cosmétique enregistré");
      sound.play("click");
    }
  }
  async function remove(id: string) {
    const r = await ask("admin_catalog_delete", { id });
    if (r.error) toast(r.error, "info");
    else {
      setCatalog(r.catalog);
      if (draft?.id === id) setDraft(null);
      toast("Supprimé");
    }
  }

  const slots: { slot: Slot; label: string }[] = [
    { slot: "title", label: "Titres" },
    { slot: "border", label: "Bordures" },
    { slot: "effect", label: "Effets" },
  ];

  function upd(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function updV(patch: object) {
    setDraft((d) => (d ? { ...d, visual: { ...d.visual, ...patch } } : d));
  }

  const headerNode = (
    <div className="admin-head">
      <button className="tbl-back" onClick={onClose} data-tip="Retour" aria-label="Retour">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <div className="admin-tabs">
        <button className={"admin-tab" + (tab === "cosmetics" ? " active" : "")} onClick={() => setTab("cosmetics")}>
          Cosmétiques
        </button>
        <button className={"admin-tab" + (tab === "quiz" ? " active" : "")} onClick={() => setTab("quiz")}>
          Quiz
        </button>
      </div>
    </div>
  );

  if (tab === "quiz") {
    return (
      <div className="admin">
        <div className="ambient" />
        <AdminQuiz ask={ask} uploadMedia={uploadMedia} header={headerNode} />
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="ambient" />

      {/* liste */}
      <section className="admin-list">
        {headerNode}

        <div className="admin-scroll">
          {slots.map(({ slot, label }) => (
            <div key={slot} className="admin-group">
              <div className="admin-group-head">
                <span className="admin-group-title">{label}</span>
                <button className="admin-new" onClick={() => setDraft(newDraft(slot))}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Nouveau
                </button>
              </div>
              {catalog
                .filter((r) => r.slot === slot)
                .map((r) => (
                  <div
                    key={r.id}
                    className={"admin-row" + (draft?.id === r.id && !draft.isNew ? " active" : "")}
                    onClick={() => setDraft(rowToDraft(r))}
                  >
                    <div className="admin-row-main">
                      <span className="admin-row-name">
                        {r.name}
                        {!r.enabled && <span className="admin-off"> · désactivé</span>}
                      </span>
                      <span className="admin-row-cond mono">
                        {r.cond_stat ? `${r.cond_stat} ≥ ${r.cond_value}` : "gratuit"}
                      </span>
                    </div>
                    <button
                      className="admin-del"
                      data-tip="Supprimer" aria-label="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(r.id);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>

      {/* éditeur */}
      <section className="admin-editor">
        {!draft ? (
          <div className="admin-empty">
            <p className="muted">Sélectionne un cosmétique à gauche,</p>
            <p className="muted">ou crée-en un nouveau.</p>
          </div>
        ) : (
          <>
            <div className="admin-editor-head">
              <h2 className="admin-h2">{draft.isNew ? "Nouveau cosmétique" : "Éditer"}</h2>
              <label className="admin-enabled">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => upd({ enabled: e.target.checked })} />
                Actif
              </label>
            </div>

            {/* aperçu live */}
            <div className="admin-preview">
              {draft.slot === "border" && (
                <BorderedAvatar url={null} name="Y" size={72} visual={draft.visual} signature={SAMPLE_SIG} />
              )}
              {draft.slot === "effect" && (
                <div className="admin-effect-stage" onClick={() => setPlayKey((k) => k + 1)}>
                  <VictoryEffect visual={draft.visual} signature={SAMPLE_SIG} playKey={playKey} />
                  <span className="muted small">clic pour rejouer</span>
                </div>
              )}
              {draft.slot === "title" && (
                <div className="admin-title-preview" style={{ background: `${SAMPLE_SIG}22`, borderColor: `${SAMPLE_SIG}55` }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={SAMPLE_SIG} stroke="none">
                    <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
                  </svg>
                  {draft.name || "Titre"}
                </div>
              )}
            </div>

            <div className="admin-fields">
              <Field label="Identifiant (slug)">
                <input
                  className="admin-input mono"
                  value={draft.id}
                  disabled={!draft.isNew}
                  placeholder="mon-cosmetique"
                  onChange={(e) => upd({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                />
              </Field>
              <Field label="Nom affiché">
                <input className="admin-input" value={draft.name} onChange={(e) => upd({ name: e.target.value })} />
              </Field>
              <Field label="Description (débloqué)">
                <input className="admin-input" value={draft.sub} onChange={(e) => upd({ sub: e.target.value })} />
              </Field>
              <Field label="Indice (verrouillé)">
                <input className="admin-input" value={draft.locked_sub} onChange={(e) => upd({ locked_sub: e.target.value })} />
              </Field>

              {/* condition */}
              <Field label="Condition de déblocage">
                <div className="admin-cond">
                  <select
                    className="admin-input"
                    value={draft.cond_stat}
                    onChange={(e) => upd({ cond_stat: e.target.value })}
                  >
                    <option value="">Gratuit (débloqué d'office)</option>
                    <option value="event">Événement (verrouillé)</option>
                    {meta &&
                      Object.entries(meta.stats).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                  </select>
                  {draft.cond_stat && draft.cond_stat !== "event" && (
                    <>
                      <span className="muted">≥</span>
                      <input
                        className="admin-input admin-num"
                        type="number"
                        min={1}
                        value={draft.cond_value}
                        onChange={(e) => upd({ cond_value: parseInt(e.target.value) || 0 })}
                      />
                    </>
                  )}
                </div>
              </Field>

              {/* éditeur visuel */}
              {draft.slot === "border" && meta && (
                <BorderVisualEditor visual={draft.visual} styles={meta.border_styles} onChange={updV} />
              )}
              {draft.slot === "effect" && meta && (
                <EffectVisualEditor visual={draft.visual} engines={meta.effect_engines} onChange={updV} />
              )}
            </div>

            <div className="admin-actions">
              <button className="admin-cancel" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button className="admin-save" onClick={save} disabled={!draft.id || !draft.name}>
                Enregistrer
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  );
}

function BorderVisualEditor({
  visual,
  styles,
  onChange,
}: {
  visual: any;
  styles: string[];
  onChange: (patch: object) => void;
}) {
  return (
    <div className="admin-visual">
      <div className="admin-visual-title">Visuel · bordure</div>
      <Field label="Style">
        <select className="admin-input" value={visual.style} onChange={(e) => onChange({ style: e.target.value })}>
          {styles.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Couleur">
        <div className="admin-cond">
          <select className="admin-input" value={visual.colorMode} onChange={(e) => onChange({ colorMode: e.target.value })}>
            <option value="signature">Signature du joueur</option>
            <option value="fixed">Fixe</option>
            <option value="gold">Or</option>
          </select>
          {visual.colorMode === "fixed" && (
            <input type="color" className="admin-color" value={visual.color || "#7c6cff"} onChange={(e) => onChange({ color: e.target.value })} />
          )}
        </div>
      </Field>
      <Slider label="Épaisseur" value={visual.thickness ?? 0.035} min={0.02} max={0.08} step={0.005} onChange={(v) => onChange({ thickness: v })} />
      <Slider label="Lueur" value={visual.glow ?? 0} min={0} max={1} step={0.1} onChange={(v) => onChange({ glow: v })} />
      <label className="admin-check">
        <input type="checkbox" checked={!!visual.spin} onChange={(e) => onChange({ spin: e.target.checked })} />
        Rotation {visual.spin && `(${visual.speed ?? 5}s)`}
      </label>
      {visual.spin && (
        <Slider label="Vitesse (s)" value={visual.speed ?? 5} min={1} max={12} step={1} onChange={(v) => onChange({ speed: v })} />
      )}
    </div>
  );
}

function EffectVisualEditor({
  visual,
  engines,
  onChange,
}: {
  visual: any;
  engines: string[];
  onChange: (patch: object) => void;
}) {
  return (
    <div className="admin-visual">
      <div className="admin-visual-title">Visuel · effet</div>
      <Field label="Moteur">
        <select className="admin-input" value={visual.engine} onChange={(e) => onChange({ engine: e.target.value })}>
          {engines.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Couleur">
        <div className="admin-cond">
          <select className="admin-input" value={visual.colorMode} onChange={(e) => onChange({ colorMode: e.target.value })}>
            <option value="signature">Signature du joueur</option>
            <option value="multi">Multicolore</option>
            <option value="fixed">Fixe</option>
            <option value="gold">Or</option>
          </select>
          {visual.colorMode === "fixed" && (
            <input type="color" className="admin-color" value={visual.color || "#7c6cff"} onChange={(e) => onChange({ color: e.target.value })} />
          )}
        </div>
      </Field>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {label} <span className="mono muted">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}
