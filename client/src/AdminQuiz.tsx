import { useEffect, useMemo, useRef, useState } from "react";
import { QuizMedia } from "./useSocial";
import QuizPrompt from "./components/QuizPrompt";
import { toast } from "./toast";
import { sound } from "./sound";

type Ask = (event: string, data?: object) => Promise<any>;
type Upload = (file: File) => Promise<{ url?: string; kind?: string; error?: string }>;

type QRow = {
  id: number;
  category: string;
  question: string;
  answer: string;
  enabled: number;
  type: string;
  media: string;
  alt_answers: string;
  auto: number;
};

type Draft = {
  isNew: boolean;
  id?: number;
  category: string;
  type: string;
  question: string;
  answer: string;
  alt: string; // séparé par virgules
  auto: boolean;
  enabled: boolean;
  media: QuizMedia;
};

type MediaKind = "none" | "image" | "audio" | "images" | "timeline" | "petitbac";
const TYPES: { value: string; label: string; media: MediaKind }[] = [
  { value: "text", label: "Texte / musique traduite", media: "none" },
  { value: "image", label: "Image (célébrité, etc.)", media: "image" },
  { value: "images", label: "Rébus (4 images)", media: "images" },
  { value: "audio", label: "Son (bruit d'animal)", media: "audio" },
  { value: "flag", label: "Drapeau", media: "image" },
  { value: "timeline", label: "Frise chronologique (année)", media: "timeline" },
  { value: "petitbac", label: "Petit Bac (catégories)", media: "petitbac" },
];

function mediaKindOf(type: string) {
  return TYPES.find((t) => t.value === type)?.media ?? "none";
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToDraft(r: QRow): Draft {
  const alts = parseJson<string[] | string>(r.alt_answers, []);
  return {
    isNew: false,
    id: r.id,
    category: r.category,
    type: r.type || "text",
    question: r.question,
    answer: r.answer,
    alt: Array.isArray(alts) ? alts.join(", ") : String(alts),
    auto: !!r.auto,
    enabled: !!r.enabled,
    media: parseJson<QuizMedia>(r.media, null),
  };
}

function newDraft(category: string): Draft {
  return {
    isNew: true,
    category: category || "",
    type: "text",
    question: "",
    answer: "",
    alt: "",
    auto: false,
    enabled: true,
    media: null,
  };
}

export default function AdminQuiz({
  ask,
  uploadMedia,
  header,
}: {
  ask: Ask;
  uploadMedia: Upload;
  header: React.ReactNode;
}) {
  const [rows, setRows] = useState<QRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rebusSlot = useRef(0);

  useEffect(() => {
    ask("admin_quiz_list").then((r) => r.questions && setRows(r.questions));
  }, [ask]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort(),
    [rows],
  );

  function upd(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function onTypeChange(type: string) {
    // en changeant de type, on réinitialise le média + un défaut d'auto sensé
    const auto = type === "flag" || type === "image" || type === "audio" || type === "timeline";
    let media: QuizMedia = null;
    if (type === "timeline") media = { kind: "timeline", min: 1000, max: 2025 };
    if (type === "petitbac")
      media = { kind: "petitbac", categories: ["Prénom", "Métier", "Sport", "Objet", "Pays", "Animal"] };
    upd({ type, media, auto });
  }

  async function pickFile(forRebusSlot = -1) {
    rebusSlot.current = forRebusSlot;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    setUploading(true);
    const res = await uploadMedia(file);
    setUploading(false);
    if (res.error || !res.url) {
      toast(res.error || "Upload échoué", "info");
      return;
    }
    const kind = mediaKindOf(draft.type);
    if (kind === "images") {
      const urls = (draft.media?.kind === "images" ? draft.media.urls ?? [] : []).slice();
      const slot = rebusSlot.current >= 0 ? rebusSlot.current : urls.length;
      urls[slot] = res.url;
      upd({ media: { kind: "images", urls } });
    } else if (kind === "audio") {
      upd({ media: { kind: "audio", url: res.url } });
    } else {
      upd({ media: { kind: "image", url: res.url } });
    }
    sound.play("click");
  }

  async function save() {
    if (!draft) return;
    const r = await ask("admin_quiz_save", { item: { ...draft, alt_answers: draft.alt } });
    if (r.error) {
      toast(r.error, "info");
    } else {
      setRows(r.questions);
      setDraft(null);
      toast("Question enregistrée");
      sound.play("click");
    }
  }

  async function remove(id: number) {
    const r = await ask("admin_quiz_delete", { id });
    if (r.error) toast(r.error, "info");
    else {
      setRows(r.questions);
      if (draft?.id === id) setDraft(null);
      toast("Supprimée");
    }
  }

  const mediaKind = draft ? mediaKindOf(draft.type) : "none";
  const canSave =
    !!draft &&
    !!draft.category.trim() &&
    (draft.type === "petitbac"
      ? (draft.media?.categories?.length ?? 0) > 0
      : !!draft.answer.trim() && (!!draft.question.trim() || !!draft.media));

  return (
    <>
      <input ref={fileRef} type="file" hidden accept="image/*,audio/*" onChange={onFile} />

      {/* liste */}
      <section className="admin-list">
        {header}
        <div className="admin-scroll">
          <div className="admin-group">
            <div className="admin-group-head">
              <span className="admin-group-title">
                {rows.length} question{rows.length > 1 ? "s" : ""}
              </span>
              <button className="admin-new" onClick={() => setDraft(newDraft(categories[0] ?? ""))}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Nouvelle
              </button>
            </div>
          </div>

          {categories.map((cat) => (
            <div key={cat} className="admin-group">
              <div className="admin-group-head">
                <span className="admin-group-title">{cat}</span>
                <span className="muted small">{rows.filter((r) => r.category === cat).length}</span>
              </div>
              {rows
                .filter((r) => r.category === cat)
                .map((r) => (
                  <div
                    key={r.id}
                    className={"admin-row" + (draft?.id === r.id ? " active" : "")}
                    onClick={() => setDraft(rowToDraft(r))}
                  >
                    <div className="admin-row-main">
                      <span className="admin-row-name">
                        {r.type !== "text" && <span className="admin-qtype">{r.type}</span>}
                        {r.question || r.answer}
                        {!r.enabled && <span className="admin-off"> · off</span>}
                      </span>
                      <span className="admin-row-cond mono">→ {r.answer}</span>
                    </div>
                    <button
                      className="admin-del"
                      title="Supprimer"
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
            <p className="muted">Sélectionne une question à gauche,</p>
            <p className="muted">ou crée-en une nouvelle.</p>
          </div>
        ) : (
          <>
            <div className="admin-editor-head">
              <h2 className="admin-h2">{draft.isNew ? "Nouvelle question" : "Éditer"}</h2>
              <label className="admin-enabled">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => upd({ enabled: e.target.checked })} />
                Active
              </label>
            </div>

            <div className="admin-fields">
              <label className="admin-field">
                <span className="admin-field-label">Catégorie</span>
                <input
                  className="admin-input"
                  list="quiz-cats"
                  value={draft.category}
                  placeholder="ex : Cinéma"
                  onChange={(e) => upd({ category: e.target.value })}
                />
                <datalist id="quiz-cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>

              <label className="admin-field">
                <span className="admin-field-label">Type</span>
                <select className="admin-input" value={draft.type} onChange={(e) => onTypeChange(e.target.value)}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span className="admin-field-label">
                  Question {mediaKind !== "none" && <span className="muted small">(consigne, ex : « Quel pays ? »)</span>}
                </span>
                <input
                  className="admin-input"
                  value={draft.question}
                  placeholder={mediaKind !== "none" ? "Consigne au-dessus du média" : "L'énoncé de la question"}
                  onChange={(e) => upd({ question: e.target.value })}
                />
              </label>

              {/* frise : plage d'années au lieu d'un média */}
              {mediaKind === "timeline" && (
                <div className="admin-media">
                  <div className="admin-field-label">Plage de la frise (années)</div>
                  <div className="admin-cond">
                    <input
                      className="admin-input admin-num"
                      type="number"
                      value={draft.media?.min ?? 1000}
                      onChange={(e) =>
                        upd({ media: { kind: "timeline", min: parseInt(e.target.value) || 0, max: draft.media?.max ?? 2025 } })
                      }
                    />
                    <span className="muted">→</span>
                    <input
                      className="admin-input admin-num"
                      type="number"
                      value={draft.media?.max ?? 2025}
                      onChange={(e) =>
                        upd({ media: { kind: "timeline", min: draft.media?.min ?? 1000, max: parseInt(e.target.value) || 0 } })
                      }
                    />
                  </div>
                </div>
              )}

              {/* petit bac : liste de catégories */}
              {mediaKind === "petitbac" && (
                <div className="admin-media">
                  <div className="admin-field-label">Catégories (séparées par des virgules)</div>
                  <input
                    className="admin-input"
                    value={(draft.media?.categories ?? []).join(", ")}
                    placeholder="Prénom, Métier, Sport, Objet, Pays, Animal"
                    onChange={(e) =>
                      upd({
                        media: {
                          kind: "petitbac",
                          categories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
              )}

              {/* média selon le type */}
              {mediaKind !== "none" && mediaKind !== "timeline" && mediaKind !== "petitbac" && (
                <div className="admin-media">
                  <div className="admin-field-label">Média</div>
                  {mediaKind === "images" ? (
                    <div className="admin-rebus-grid">
                      {[0, 1, 2, 3].map((i) => {
                        const url = draft.media?.kind === "images" ? draft.media.urls?.[i] : undefined;
                        return (
                          <button key={i} className="admin-rebus-slot" onClick={() => pickFile(i)}>
                            {url ? (
                              <QuizPrompt media={{ kind: "image", url }} size="small" />
                            ) : (
                              <span className="muted">+ image {i + 1}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="admin-media-drop">
                      {draft.media ? (
                        <QuizPrompt media={draft.media} size="small" />
                      ) : (
                        <span className="muted small">Aucun média</span>
                      )}
                      <button className="admin-upload-btn" onClick={() => pickFile(-1)} disabled={uploading}>
                        {uploading ? "Envoi…" : draft.media ? "Remplacer" : "Choisir un fichier"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {draft.type !== "petitbac" && (
                <>
                  <label className="admin-field">
                    <span className="admin-field-label">Réponse attendue</span>
                    <input
                      className="admin-input"
                      value={draft.answer}
                      placeholder={draft.type === "timeline" ? "L'année (ex : 1789)" : "La bonne réponse"}
                      onChange={(e) => upd({ answer: e.target.value })}
                    />
                  </label>

                  <label className="admin-field">
                    <span className="admin-field-label">
                      Réponses alternatives <span className="muted small">(séparées par des virgules)</span>
                    </span>
                    <input
                      className="admin-input"
                      value={draft.alt}
                      placeholder="USA, Amérique, Etats-Unis"
                      onChange={(e) => upd({ alt: e.target.value })}
                    />
                  </label>

                  <label className="admin-check">
                    <input type="checkbox" checked={draft.auto} onChange={(e) => upd({ auto: e.target.checked })} />
                    Suggérer la correction à l'hôte (réponse objective)
                  </label>
                </>
              )}
            </div>

            <div className="admin-actions">
              <button className="admin-cancel" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button className="admin-save" onClick={save} disabled={!canSave}>
                Enregistrer
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
