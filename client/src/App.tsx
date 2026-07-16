import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import UpdateBanner from "./UpdateBanner";
import { PLAYABLE_GAMES, useSocial } from "./useSocial";
import FriendsPanel from "./FriendsPanel";
import LobbyScreen from "./LobbyScreen";
import ImpostorScreen from "./ImpostorScreen";
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
  const [version, setVersion] = useState("");
  // Jeu cliqué depuis l'accueil — mis en avant sur l'écran de groupe.
  const [pickedGame, setPickedGame] = useState<string | null>(null);
  const social = useSocial(screen.kind === "home");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

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

          <p className="version">yGAMES v{version} — Phase 2</p>
        </div>
      </main>
    );
  }

  // ------- connecté : reconnexion, lobby ou accueil -------
  const { user } = screen;

  // Un lobby nous attend (retour dans l'app) : on propose, on n'impose pas.
  if (social.pendingLobby && !social.lobby) {
    const pending = social.pendingLobby;
    return (
      <main className="screen">
        <UpdateBanner />
        <div className="card">
          <p className="muted">Ta table t'attend</p>
          <p className="pending-code">{pending.code}</p>
          <p className="muted small">
            {pending.members.map((m) => m.display_name).join(", ")}
          </p>
          <button
            className="discord-btn reconnect-btn"
            onClick={() => social.joinLobby(pending.code)}
          >
            Se reconnecter
          </button>
          <button className="ghost-btn" onClick={social.leaveLobby}>
            Quitter la table
          </button>
        </div>
      </main>
    );
  }

  // Partie en cours : l'écran de jeu prend toute la place.
  if (social.lobby && social.gameView) {
    return (
      <main className="screen screen-top">
        <UpdateBanner />
        <ImpostorScreen
          view={social.gameView}
          myPlayerId={String(user.id)}
          isHost={social.lobby.host_id === user.id}
          onAction={social.gameAction}
          onEnd={social.endGame}
        />
      </main>
    );
  }

  if (social.lobby) {
    return (
      <main className="screen screen-top">
        <UpdateBanner />
        <LobbyScreen
          lobby={social.lobby}
          meId={user.id}
          friends={social.friends}
          games={social.games}
          initialGameId={pickedGame}
          onInvite={social.inviteToLobby}
          onKick={social.kickFromLobby}
          onLeave={social.leaveLobby}
          onChat={social.sendChat}
          onStartGame={social.startGame}
        />
      </main>
    );
  }

  return (
    <main className="screen screen-top">
      <UpdateBanner />

      {social.invites.map((inv) => (
        <div key={inv.code} className="invite-banner">
          <span>
            🎮 <strong>{inv.from.display_name}</strong> t'invite dans son lobby
          </span>
          <button
            className="add-btn"
            onClick={() => social.joinLobby(inv.code)}
          >
            Rejoindre
          </button>
          <button
            className="mini-btn no ghost"
            onClick={() => social.dismissInvite(inv.code)}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="launcher">
        <header className="launcher-header">
          <div className="launcher-me">
            {user.avatar_url ? (
              <img className="online-avatar" src={user.avatar_url} alt="" />
            ) : (
              <span className="online-avatar online-avatar-fallback">
                {user.display_name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <div className="launcher-name">{user.display_name}</div>
              <div className="muted small">
                <span className={social.connected ? "dot dot-on" : "dot dot-off"} />
                {social.connected ? "En ligne" : "Reconnexion…"}
              </div>
            </div>
          </div>
          <div className="brand brand-small">
            y<span className="brand-accent">GAMES</span>
          </div>
          <button className="ghost-btn" onClick={handleLogout}>
            Se déconnecter
          </button>
        </header>

        <div className="launcher-body">
          <section className="launcher-main">
            <h2 className="online-title">Jouer</h2>
            <div className="launcher-grid">
              {social.games.map((g) => (
                <button
                  key={g.id}
                  className="game-card-lg"
                  disabled={!PLAYABLE_GAMES.has(g.id) || !social.connected}
                  title={g.description}
                  onClick={async () => {
                    setPickedGame(g.id);
                    await social.createLobby();
                  }}
                >
                  <span className="game-icon-lg">{g.icon}</span>
                  <span className="game-name">{g.name}</span>
                  <span className="muted small">
                    {PLAYABLE_GAMES.has(g.id)
                      ? `${g.min_players}–${g.max_players} joueurs`
                      : "bientôt"}
                  </span>
                </button>
              ))}
              {social.games.length === 0 && (
                <p className="muted small">Connexion au serveur…</p>
              )}
            </div>
            <p className="muted small launcher-hint">
              Choisis un jeu : ça ouvre une table, tu invites, vous enchaînez
              les parties sans vous disperser.
            </p>
            <JoinByCode onJoin={social.joinLobby} />
          </section>

          <aside className="launcher-side">
            <FriendsPanel
              friends={social.friends}
              incoming={social.incoming}
              outgoing={social.outgoing}
              onAdd={social.addFriend}
              onAccept={social.acceptFriend}
              onDecline={social.declineFriend}
              onRemove={social.removeFriend}
            />
          </aside>
        </div>

        <p className="version">yGAMES v{version}</p>
      </div>
    </main>
  );
}

/** Rejoindre la table d'un pote avec son code. */
function JoinByCode(props: { onJoin: (code: string) => Promise<string | null> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(await props.onJoin(code.trim()));
  }

  return (
    <form className="add-friend join-code" onSubmit={join}>
      <input
        className="add-input code-input"
        value={code}
        onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
        placeholder="CODE"
        maxLength={4}
        spellCheck={false}
      />
      <button className="add-btn" disabled={code.trim().length < 4}>
        Rejoindre une table
      </button>
      {error && <span className="error small">{error}</span>}
    </form>
  );
}

export default App;
