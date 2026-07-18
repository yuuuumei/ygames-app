import YMark from "./components/YMark";

/** Écran de démarrage : le temps de vérifier la session (keychain → /auth/me). */
export default function Splash({ version }: { version: string }) {
  return (
    <div className="splash">
      <div className="splash-grid" />
      <div className="splash-center">
        <div className="splash-logo">
          <div className="splash-halo" />
          <span className="splash-ring" />
          <div className="splash-float">
            <YMark variant="app" size={112} speed={7} />
          </div>
        </div>

        <div className="splash-title">yGAMES</div>
        <div className="splash-tagline">Les soirées jeux de la bande</div>

        <div className="splash-loader">
          <div className="splash-bar-track">
            <div className="splash-bar-fill" />
          </div>
          <div className="splash-tip">
            <span className="spinner" />
            Connexion aux serveurs de jeu…
          </div>
        </div>
      </div>

      <div className="splash-footer">
        <span className="mono">v{version}</span>
        <span className="splash-dot" />
        <span>Projet perso · entre potes</span>
      </div>
    </div>
  );
}
