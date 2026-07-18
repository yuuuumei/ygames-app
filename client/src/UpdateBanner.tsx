import { useEffect, useState } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Vérifie au démarrage si une mise à jour est publiée sur GitHub Releases.
 * Le téléchargement se fait DANS l'app avec une barre de progression ; une
 * fois fini, l'installation est silencieuse (config updater installMode:quiet)
 * puis l'app redémarre. Plus de fenêtre "yGAMES Setup".
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<"idle" | "downloading" | "installing">("idle");
  const [progress, setProgress] = useState(0); // 0..1
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
    setError(null);
    setPhase("downloading");
    try {
      let downloaded = 0;
      let total = 0;
      // Téléchargement avec progression (reste dans l'app).
      await update.download((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) setProgress(Math.min(1, downloaded / total));
            break;
          case "Finished":
            setProgress(1);
            break;
        }
      });
      // Installation silencieuse puis redémarrage.
      setPhase("installing");
      await update.install();
      await relaunch();
    } catch (e) {
      setError(String(e));
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const pct = Math.round(progress * 100);

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
          <span className="update-title">
            {phase === "downloading"
              ? "Téléchargement…"
              : phase === "installing"
                ? "Installation…"
                : "Mise à jour disponible"}
          </span>
          <span className="update-version">v{update.version}</span>
        </div>
        {busy ? (
          <div className="update-progress">
            <div className="update-progress-track">
              <div
                className={"update-progress-fill" + (phase === "installing" ? " indet" : "")}
                style={phase === "downloading" ? { width: `${pct}%` } : undefined}
              />
            </div>
            {phase === "downloading" && <span className="update-pct mono">{pct}%</span>}
          </div>
        ) : (
          <div className="update-desc">
            {error ? (
              <span className="update-err">Échec : {error}</span>
            ) : (
              "Nouveautés et correctifs. L'app se met à jour toute seule."
            )}
          </div>
        )}
      </div>
      {!busy && (
        <div className="update-actions">
          <button className="update-later" onClick={() => setDismissed(true)}>
            Plus tard
          </button>
          <button className="update-restart" onClick={install}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M12 3v12M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Mettre à jour
          </button>
        </div>
      )}
    </div>
  );
}
