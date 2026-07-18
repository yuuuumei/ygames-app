import YMark from "./components/YMark";

type Props = {
  busy: boolean;
  error?: string;
  version: string;
  onLogin: () => void;
  onCancel: () => void;
};

function DiscordGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.25.5a18.3 18.3 0 0 1 4.3 1.36 15.9 15.9 0 0 0-15-.02A18.4 18.4 0 0 1 8.86 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 8.9-.24 13.3.18 17.6a20 20 0 0 0 6 3.03l.72-1a12.4 12.4 0 0 1-2.02-.98l.5-.38a14.2 14.2 0 0 0 12.24 0l.5.38c-.63.38-1.31.71-2.02.98l.72 1a19.9 19.9 0 0 0 6-3.03c.5-5-.84-9.36-3.94-13.2ZM8.3 15c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.8 2-1.79 2Zm7.4 0c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.79 2-1.79 2Z" />
    </svg>
  );
}

export default function LoginScreen({ busy, error, version, onLogin, onCancel }: Props) {
  return (
    <div className="login">
      <div className="login-grid" />

      <div className="login-center">
        <div className="login-brand">
          <div className="splash-float">
            <YMark variant="app" size={88} speed={7} />
          </div>
          <div className="login-title">yGAMES</div>
          <div className="login-tagline">Les soirées jeux de la bande. En un clic.</div>
        </div>

        <div className="login-auth">
          {busy ? (
            /* ---- attente ---- */
            <div className="login-state">
              <div className="login-waiting">
                <span className="spinner spinner-discord" />
                Connexion à Discord…
              </div>
              <p className="login-hint">
                Une fenêtre Discord s'est ouverte.
                <br />
                <span className="muted">Autorise yGAMES pour continuer.</span>
              </p>
              <button className="login-cancel" onClick={onCancel}>
                Annuler
              </button>
            </div>
          ) : error ? (
            /* ---- erreur ---- */
            <div className="login-state login-shake">
              <div className="login-error-box">
                <div className="login-error-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 9v4M12 17h.01" />
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                </div>
                <div>
                  <div className="login-error-title">Connexion impossible</div>
                  <div className="login-error-desc">{error}</div>
                </div>
              </div>
              <button className="login-discord-btn login-retry" onClick={onLogin}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Réessayer
              </button>
            </div>
          ) : (
            /* ---- au repos ---- */
            <div className="login-state">
              <button className="login-discord-btn" onClick={onLogin}>
                <DiscordGlyph size={26} />
                Se connecter avec Discord
              </button>
              <div className="login-privacy">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                On ne récupère que ton pseudo et ton avatar.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="login-footer mono">v{version}</div>
    </div>
  );
}
