import { useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Vérifie silencieusement au démarrage si une mise à jour est publiée
 * sur GitHub Releases. Si oui, affiche une bannière en bas de la fenêtre.
 * En dev (`npm run tauri dev`), le check échoue simplement en silence.
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    check()
      .then((u) => {
        if (u) setUpdate(u);
      })
      .catch(() => {
        /* pas de réseau, ou build dev non signé : on ignore */
      });
  }, []);

  if (!update) return null;

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
    <div className="update-banner">
      {error ? (
        <span className="update-error">Échec de la mise à jour : {error}</span>
      ) : (
        <>
          <span>
            Mise à jour <strong>v{update.version}</strong> disponible
          </span>
          <button className="update-btn" onClick={install} disabled={installing}>
            {installing ? "Installation…" : "Installer et redémarrer"}
          </button>
        </>
      )}
    </div>
  );
}
