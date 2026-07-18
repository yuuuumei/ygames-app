import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
};

/** Menu déroulant custom, dans la DA de l'app. Le menu est rendu en position
 *  fixe (calé sur le bouton) pour ne jamais être rogné par un conteneur qui
 *  défile ni masqué par un empilement. */
export default function Dropdown({
  value,
  options,
  onChange,
  disabled,
  size = "normal",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "normal" | "small";
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 6, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={"dd" + (size === "small" ? " dd-small" : "")}>
      <button
        ref={triggerRef}
        className={"dd-trigger" + (open ? " open" : "")}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dd-value">{current?.label ?? "—"}</span>
        <svg className={"dd-chevron" + (open ? " up" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && !disabled && rect &&
        createPortal(
          <>
            <div className="dd-backdrop" onClick={() => setOpen(false)} />
            <div
              className="dd-menu"
              style={{ left: rect.left, top: rect.top, minWidth: rect.width }}
            >
              {options.map((o) => (
                <button
                  key={o.value}
                  className={"dd-option" + (o.value === value ? " selected" : "") + (o.disabled ? " disabled" : "")}
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="dd-option-label">{o.label}</span>
                  {o.hint && <span className="dd-option-hint">{o.hint}</span>}
                  {o.value === value && !o.hint && (
                    <svg className="dd-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
