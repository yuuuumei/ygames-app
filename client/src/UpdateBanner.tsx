import { useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Vérifie au démarrage si une mise à jour est publiée sur GitHub Releases.
 * Si oui, affiche un dock discret en bas de la fenêtre. En dev, le check
 * échoue silencieusement.
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check()
      .then((u) => {
        if (u) setUpdate(u);
      })
      .catch(() => {});
  }, []);

  if (!update || dismissed) return null;

  async function install() {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setError(String(e));
      setInstalling(false);
    }
  }

  return (
    <div className="update-dock">
      <div className="update-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 3v12M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </div>
      <div className="update-info">
        <div className="update-title-row">
          <span className="update-title">Mise à jour disponible</span>
          <span className="update-version">v{update.version}</span>
        </div>
        <div className="update-desc">
          {error ? (
            <span className="update-err">Échec : {error}</span>
          ) : (
            "Nouveautés et correctifs. Redémarre pour installer."
          )}
        </div>
      </div>
      <div className="update-actions">
        <button className="update-later" onClick={() => setDismissed(true)} disabled={installing}>
          Plus tard
        </button>
        <button className="update-restart" onClick={install} disabled={installing}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {installing ? "Installation…" : "Redémarrer"}
        </button>
      </div>
    </div>
  );
}
