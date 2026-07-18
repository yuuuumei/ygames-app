import { useEffect, useState } from "react";
import { sound } from "./sound";

/** Paramètres : son, infos, à propos. Écran simple accessible du menu compte. */
export default function SettingsScreen({ version, onClose }: { version: string; onClose: () => void }) {
  const [muted, setMuted] = useState(sound.muted);
  useEffect(() => sound.onMuteChange(setMuted), []);

  return (
    <div className="settings">
      <div className="ambient" />
      <div className="settings-card">
        <div className="settings-head">
          <button className="tbl-back" onClick={onClose} title="Retour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="settings-h1">Paramètres</h1>
        </div>

        <div className="settings-section">Son</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Effets sonores</div>
            <div className="settings-row-sub muted small">Sons de jeu, notifications et clics.</div>
          </div>
          <button
            className={"settings-toggle" + (muted ? "" : " on")}
            onClick={() => {
              sound.toggleMute();
              if (sound.muted === false) sound.play("click");
            }}
          >
            <span className="settings-knob" />
          </button>
        </div>

        <div className="settings-section">À propos</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Version</div>
            <div className="settings-row-sub muted small">Mises à jour automatiques via GitHub.</div>
          </div>
          <span className="mono settings-version">v{version}</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">yGAMES</div>
            <div className="settings-row-sub muted small">Les soirées jeux de la bande. Projet perso, entre potes.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
