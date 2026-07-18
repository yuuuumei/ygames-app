/** Barre de titre custom (la fenêtre Tauri est sans décorations).
 *  Zone de drag pour déplacer, boutons minimiser / maximiser / fermer. */

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import YMark from "./YMark";
import { sound } from "../sound";

const win = getCurrentWindow();

function Ctrl({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={"titlebar-ctrl" + (danger ? " titlebar-ctrl-danger" : "")}
      onClick={onClick}
      tabIndex={-1}
    >
      {children}
    </button>
  );
}

export default function TitleBar() {
  const [muted, setMuted] = useState(sound.muted);
  useEffect(() => sound.onMuteChange(setMuted), []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <YMark variant="app" size={20} speed={9} glow={false} />
        <span className="titlebar-title">YGAMES</span>
      </div>
      <div className="titlebar-ctrls">
        <Ctrl onClick={() => sound.toggleMute()}>
          {muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="m23 9-6 6M17 9l6 6" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </svg>
          )}
        </Ctrl>
        <Ctrl onClick={() => win.minimize()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </Ctrl>
        <Ctrl onClick={() => win.toggleMaximize()}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </Ctrl>
        <Ctrl onClick={() => win.close()} danger>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Ctrl>
      </div>
    </div>
  );
}
