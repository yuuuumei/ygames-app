import { useEffect, useState } from "react";

/** Toasts globaux : confirmations non-bloquantes en bas de l'écran.
 *  Appelable de n'importe où via toast("..."). */

export type ToastKind = "ok" | "info";
type Toast = { id: number; text: string; kind: ToastKind };

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<(t: Toast[]) => void>();

function emit() {
  listeners.forEach((fn) => fn(toasts));
}

export function toast(text: string, kind: ToastKind = "ok") {
  const t: Toast = { id: nextId++, text, kind };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, 2600);
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="toast-host">
      {items.map((t) => (
        <div key={t.id} className={"toast " + t.kind}>
          <span className="toast-icon">
            {t.kind === "ok" ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            )}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
