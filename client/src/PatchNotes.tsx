import { useEffect, useState } from "react";
import { CHANGELOG, KIND_LABEL, LATEST, ReleaseNote } from "./changelog";

/** Clé locale : la dernière version dont l'utilisateur a vu les notes. */
const SEEN_KEY = "ygames:seen-version";

/** Y a-t-il du neuf à montrer ? (rien au tout premier lancement : on ne
 *  souhaite pas assommer un nouveau venu avec l'historique du projet) */
export function hasUnseenNotes(): boolean {
  const seen = localStorage.getItem(SEEN_KEY);
  if (!seen) {
    localStorage.setItem(SEEN_KEY, LATEST.version);
    return false;
  }
  return seen !== LATEST.version;
}

export function markNotesSeen() {
  localStorage.setItem(SEEN_KEY, LATEST.version);
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PatchNotes({
  onClose,
  version,
}: {
  onClose: () => void;
  /** La version réellement installée, pour repérer celle qu'on utilise. */
  version: string;
}) {
  const [open, setOpen] = useState<string>(LATEST.version);

  useEffect(() => {
    markNotesSeen();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="pn-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pn-modal">
        <div className="pn-head">
          <div>
            <div className="pn-kicker">Quoi de neuf</div>
            <h1 className="pn-h1">Notes de version</h1>
          </div>
          <button className="pn-close" onClick={onClose} data-tip="Fermer" aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pn-scroll">
          {CHANGELOG.map((r) => (
            <Release
              key={r.version}
              note={r}
              open={open === r.version}
              installed={r.version === version}
              onToggle={() => setOpen(open === r.version ? "" : r.version)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Release({
  note,
  open,
  installed,
  onToggle,
}: {
  note: ReleaseNote;
  open: boolean;
  installed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={"pn-release" + (open ? " open" : "")}>
      <button className="pn-release-head" onClick={onToggle}>
        <span className="pn-version mono">v{note.version}</span>
        <div className="pn-release-text">
          <div className="pn-release-title">{note.title}</div>
          <div className="pn-release-date">{frDate(note.date)}</div>
        </div>
        {installed && <span className="pn-installed">Ta version</span>}
        <svg
          className="pn-chev"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="pn-body">
          {note.headline && <p className="pn-headline">{note.headline}</p>}
          {note.sections.map((s, i) => (
            <div key={i} className="pn-section">
              <div className={"pn-tag " + s.kind}>{KIND_LABEL[s.kind]}</div>
              <ul className="pn-list">
                {s.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
