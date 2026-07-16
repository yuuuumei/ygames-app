import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import UpdateBanner from "./UpdateBanner";
import "./App.css";

type User = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

// Les 3 écrans possibles du shell pour l'instant.
type Screen =
  | { kind: "loading" }              // démarrage : on vérifie le keychain
  | { kind: "login"; error?: string } // pas de session → bouton Discord
  | { kind: "home"; user: User };     // connecté → accueil

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Au démarrage : auto-login si un token valide dort dans le keychain.
  useEffect(() => {
    invoke<User | null>("get_session")
      .then((user) =>
        setScreen(user ? { kind: "home", user } : { kind: "login" }),
      )
      .catch((err) => setScreen({ kind: "login", error: String(err) }));
  }, []);

  async function handleLogin() {
    setBusy(true);
    try {
      const user = await invoke<User>("login_discord");
      setScreen({ kind: "home", user });
    } catch (err) {
      setScreen({ kind: "login", error: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await invoke("logout").catch(() => {});
    setScreen({ kind: "login" });
  }

  if (screen.kind === "loading") {
    return (
      <main className="screen">
        <p className="muted">Chargement…</p>
      </main>
    );
  }

  if (screen.kind === "login") {
    return (
      <main className="screen">
        <UpdateBanner />
        <div className="card">
          <h1 className="brand">
            y<span className="brand-accent">GAMES</span>
          </h1>
          <p className="tagline">Le salon de jeux, entre potes.</p>

          <button className="discord-btn" onClick={handleLogin} disabled={busy}>
            <svg className="discord-icon" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            {busy ? "En attente de Discord…" : "Se connecter avec Discord"}
          </button>

          {busy && (
            <p className="muted small">
              Autorise yGAMES dans l'onglet qui vient de s'ouvrir.
            </p>
          )}
          {screen.error && <p className="error">{screen.error}</p>}

          <p className="version">yGAMES v0.1.0 — Phase 1</p>
        </div>
      </main>
    );
  }

  // ------- écran d'accueil connecté -------
  const { user } = screen;
  return (
    <main className="screen">
      <UpdateBanner />
      <div className="card">
        {user.avatar_url ? (
          <img className="avatar" src={user.avatar_url} alt="" />
        ) : (
          <div className="avatar avatar-fallback">
            {user.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 className="welcome">
          Salut, <span className="brand-accent">{user.display_name}</span> !
        </h1>
        <p className="muted">@{user.username} — connecté via Discord</p>

        <p className="muted small next-up">
          Prochaine étape : la friendlist et le lobby. 🚧
        </p>

        <button className="ghost-btn" onClick={handleLogout}>
          Se déconnecter
        </button>

        <p className="version">yGAMES v0.1.0 — Phase 1</p>
      </div>
    </main>
  );
}

export default App;
