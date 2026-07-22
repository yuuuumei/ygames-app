import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import UpdateBanner from "./UpdateBanner";
import { useSocial, Profile } from "./useSocial";
import LobbyScreen from "./LobbyScreen";
import ImpostorScreen from "./ImpostorScreen";
import QuizScreen from "./QuizScreen";
import FriendsRail from "./FriendsRail";
import LoginScreen from "./LoginScreen";
import ProfileScreen from "./ProfileScreen";
import ProfileShowcase from "./ProfileShowcase";
import DailyScreen from "./DailyScreen";
import AdminScreen from "./AdminScreen";
import SettingsScreen from "./SettingsScreen";
import Splash from "./Splash";
import TitleBar from "./components/TitleBar";
import YMark from "./components/YMark";
import Avatar from "./components/Avatar";
import imposteurIcon from "./assets/imposteur-icon.png";
import imposteurHero from "./assets/imposteur-hero.png";
import quizIcon from "./assets/quiz-icon.jpg";
import quizHero from "./assets/quiz-hero.jpg";
import { ToastHost } from "./toast";
import "./theme.css";
import "./_legacy.css";
import "./App.css";

type User = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Screen =
  | { kind: "loading" }
  | { kind: "login"; error?: string }
  | { kind: "home"; user: User };

function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState("");
  const [pickedGame, setPickedGame] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [showDailies, setShowDailies] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const social = useSocial(screen.kind === "home");

  async function openProfile(userId: number) {
    const resp = await social.viewProfile(userId);
    if (resp.profile) setViewedProfile(resp.profile);
  }

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    invoke<User | null>("get_session")
      .then((user) => setScreen(user ? { kind: "home", user } : { kind: "login" }))
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

  function handleCancelLogin() {
    // On repasse l'UI au repos ; le flow Rust en cours sera simplement ignoré.
    setBusy(false);
  }

  return (
    <div className="app-shell">
      <div className="ambient" />
      <TitleBar />
      <div className="content">
        <Body
          screen={screen}
          busy={busy}
          version={version}
          social={social}
          pickedGame={pickedGame}
          setPickedGame={setPickedGame}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onCancelLogin={handleCancelLogin}
          showProfile={showProfile}
          setShowProfile={setShowProfile}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          adminOpen={adminOpen}
          setAdminOpen={setAdminOpen}
          onViewProfile={openProfile}
          showDailies={showDailies}
          setShowDailies={setShowDailies}
        />
      </div>

      {/* vitrine d'un autre joueur (overlay global) */}
      {viewedProfile && (
        <div
          className="pv-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewedProfile(null);
          }}
        >
          <div className="pv-modal">
            <ProfileShowcase
              profile={viewedProfile}
              isMe={!!viewedProfile.is_me}
              onClose={() => setViewedProfile(null)}
            />
          </div>
        </div>
      )}

      {/* invitations reçues (overlay global, non bloquant) */}
      {screen.kind === "home" && social.invites.length > 0 && (
        <div className="invites-stack">
          {social.invites.map((inv) => (
            <div key={inv.code} className="invite-toast">
              <div className="invite-toast-inner">
                <div className="invite-toast-top">
                  <div className="invite-toast-avatar">
                    <Avatar url={inv.from.avatar_url} name={inv.from.display_name} />
                    <span className="invite-toast-dot" />
                  </div>
                  <div className="invite-toast-text">
                    <div className="invite-toast-line">
                      <strong>{inv.from.display_name}</strong>{" "}
                      <span className="muted">t'invite à sa table</span>
                    </div>
                    <div className="invite-toast-meta">
                      <span className="invite-toast-game">
                        <span />
                        L'Imposteur
                      </span>
                      <span className="invite-toast-sep" />
                      <span className="invite-toast-code">{inv.code}</span>
                    </div>
                  </div>
                </div>
                <div className="invite-toast-actions">
                  <button className="invite-join" onClick={() => social.joinLobby(inv.code)}>
                    <span className="hero-cta-sheen" />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    Rejoindre
                  </button>
                  <button className="invite-ignore" onClick={() => social.dismissInvite(inv.code)}>
                    Ignorer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpdateBanner />
      <ToastHost />
    </div>
  );
}

type BodyProps = {
  screen: Screen;
  busy: boolean;
  version: string;
  social: ReturnType<typeof useSocial>;
  pickedGame: string | null;
  setPickedGame: (id: string | null) => void;
  onLogin: () => void;
  onLogout: () => void;
  onCancelLogin: () => void;
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  adminOpen: boolean;
  setAdminOpen: (v: boolean) => void;
  onViewProfile: (userId: number) => void;
  showDailies: boolean;
  setShowDailies: (v: boolean) => void;
};

function Body({ screen, busy, version, social, pickedGame, setPickedGame, onLogin, onLogout, onCancelLogin, showProfile, setShowProfile, showSettings, setShowSettings, adminOpen, setAdminOpen, onViewProfile, showDailies, setShowDailies }: BodyProps) {
  if (screen.kind === "loading") {
    return <Splash version={version} />;
  }

  if (screen.kind === "login") {
    return (
      <LoginScreen
        busy={busy}
        error={screen.error}
        version={version}
        onLogin={onLogin}
        onCancel={onCancelLogin}
      />
    );
  }

  const { user } = screen;

  // Défis du jour (jeux solo asynchrones).
  if (showDailies && !social.lobby && !social.gameView) {
    return <DailyScreen ask={social.ask} onClose={() => setShowDailies(false)} />;
  }

  // Paramètres (accessible depuis le menu compte).
  if (showSettings && !social.lobby && !social.gameView) {
    return <SettingsScreen version={version} onClose={() => setShowSettings(false)} />;
  }

  // Back-office admin (réservé, accessible depuis Mon profil).
  if (showProfile && adminOpen && social.profile?.is_admin && !social.lobby && !social.gameView) {
    return <AdminScreen ask={social.ask} uploadMedia={social.uploadMedia} onClose={() => setAdminOpen(false)} />;
  }

  // Mon profil (accessible depuis l'accueil).
  if (showProfile && !social.lobby && !social.gameView) {
    if (!social.profile) {
      return (
        <div className="centered">
          <YMark variant="app" size={56} speed={4} />
        </div>
      );
    }
    return (
      <ProfileScreen
        user={user}
        profile={social.profile}
        onSet={social.setCosmetic}
        onClose={() => setShowProfile(false)}
        onOpenAdmin={() => setAdminOpen(true)}
        onLogout={onLogout}
      />
    );
  }

  // Partie en cours : on route selon le jeu.
  if (social.lobby && social.gameView) {
    const gameProps = {
      myPlayerId: String(user.id),
      isHost: social.lobby.host_id === user.id,
      code: social.lobby.code,
      cosmetics: social.cosmetics,
      myEffectVisual:
        social.profile?.catalog.effect.find((e) => e.id === social.profile!.equipped.effect)?.visual ?? null,
      mySignature: social.profile?.equipped.signature ?? "#7c6cff",
      onAction: social.gameAction,
      onEnd: social.endGame,
    };
    if ((social.gameView as any).game === "quiz") {
      return <QuizScreen view={social.gameView as any} {...gameProps} />;
    }
    return <ImpostorScreen view={social.gameView as any} {...gameProps} />;
  }

  // Reconnexion proposée : on propose, on n'impose pas.
  if (social.pendingLobby && !social.lobby) {
    const pending = social.pendingLobby;
    const host = pending.members.find((m) => m.id === pending.host_id);
    const present = pending.members.filter((m) => m.connected).length;
    return (
      <div className="reconnect">
        <div className="bg-grid" />
        <div className="reconnect-card">
          <div className="reconnect-badge">
            <span className="reconnect-ping">
              <span />
              <span />
            </span>
            Partie en cours
          </div>

          <div className="reconnect-emblem">?</div>

          <div className="reconnect-titles">
            <div className="reconnect-title">Ta table t'attend</div>
            <div className="reconnect-sub">
              Tu as quitté en pleine partie de <strong>L'Imposteur</strong>.
              <br />
              La bande joue encore — reviens vite.
            </div>
          </div>

          <div className="reconnect-meta">
            <div className="tbl-emblem" style={{ width: 44, height: 44 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#98a1b6" strokeWidth="2">
                <path d="M3 11h18M6 15h.01M10 15h.01" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>La table de {host?.display_name ?? "…"}</div>
              <div className="reconnect-meta-sub">
                <span className="mono">{pending.code}</span>
                <span className="reconnect-meta-dot" />
                <span className="muted small">
                  <span style={{ color: "var(--online)", fontWeight: 700 }}>{present}</span> présent{present > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="reconnect-avatars">
              {pending.members.slice(0, 4).map((m) => (
                <Avatar key={m.id} url={m.avatar_url} name={m.display_name} size={30} className="reconnect-mini" />
              ))}
            </div>
          </div>

          <button className="reconnect-btn" onClick={() => social.joinLobby(pending.code)}>
            <span className="hero-cta-sheen" />
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Me reconnecter
          </button>
          <button className="reconnect-leave" onClick={social.leaveLobby}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5M21 12H9" />
            </svg>
            Quitter la table
          </button>
        </div>
      </div>
    );
  }

  // Table (styles legacy — refonte à la tâche Table).
  if (social.lobby) {
    return (
      <LobbyScreen
        lobby={social.lobby}
        meId={user.id}
        friends={social.friends}
        games={social.games}
        cosmetics={social.cosmetics}
        initialGameId={pickedGame}
        isAdmin={social.profile?.is_admin}
        onInvite={social.inviteToLobby}
        onKick={social.kickFromLobby}
        onAddBot={social.addBot}
        onLeave={social.leaveLobby}
        onChat={social.sendChat}
        onStartGame={social.startGame}
        onViewProfile={onViewProfile}
      />
    );
  }

  // ----- ACCUEIL LAUNCHER (nouveau design) -----
  return (
    <Launcher
      user={user}
      social={social}
      version={version}
      onPickGame={async (id) => {
        setPickedGame(id);
        await social.createLobby();
      }}
      onOpenProfile={() => setShowProfile(true)}
      onOpenSettings={() => setShowSettings(true)}
      onLogout={onLogout}
      onViewProfile={onViewProfile}
      onOpenDailies={() => setShowDailies(true)}
    />
  );
}

/* ============================ LAUNCHER ============================ */

function Launcher({
  user,
  social,
  version,
  onPickGame,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  onViewProfile,
  onOpenDailies,
}: {
  user: User;
  social: ReturnType<typeof useSocial>;
  version: string;
  onPickGame: (id: string) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onViewProfile: (userId: number) => void;
  onOpenDailies: () => void;
}) {
  const [code, setCode] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const impostor = social.games.find((g) => g.id === "impostor");
  const onlineCount = social.friends.filter((f) => f.online).length;

  // état des défis du jour, pour le bandeau (série + avancement)
  const [daily, setDaily] = useState<{ done: number; total: number; streak: number } | null>(null);
  useEffect(() => {
    if (!social.connected) return;
    social.ask("daily_list").then((r: any) => {
      if (!r?.dailies) return;
      const l = r.dailies as { finished: boolean; streak: number }[];
      setDaily({
        done: l.filter((d) => d.finished).length,
        total: l.length,
        streak: Math.max(0, ...l.map((d) => d.streak)),
      });
    });
  }, [social.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) return;
    await social.joinLobby(code.trim());
  }

  return (
    <div className="launcher-root">
      <div className="launcher-left">
        {/* header */}
        <div className="launcher-header">
          <div className="brand-block">
            <YMark variant="app" size={40} speed={7} />
            <div>
              <div className="brand-word">yGAMES</div>
              <div className="brand-sub">Soirées entre potes</div>
            </div>
          </div>

          <div className="header-right">
            <form className="joincode" onSubmit={joinByCode}>
              <span className="joincode-label">Rejoindre</span>
              <input
                className="joincode-input"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
                placeholder="CODE"
                maxLength={4}
                spellCheck={false}
              />
              <button className="joincode-go" disabled={code.trim().length < 4} title="Rejoindre">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>

            <div className="header-sep" />

            <div className="profile-menu-wrap">
              <button
                className={"profile-chip" + (menuOpen ? " open" : "")}
                onClick={() => setMenuOpen((v) => !v)}
                title="Mon compte"
              >
                <div className="profile-avatar-wrap">
                  <Avatar url={user.avatar_url} name={user.display_name} size={36} />
                  <span
                    className="profile-status-dot"
                    style={{ background: social.connected ? "var(--online)" : "var(--danger)" }}
                  />
                </div>
                <div className="profile-text">
                  <div className="profile-name">{user.display_name}</div>
                  <div className="profile-state" style={{ color: social.connected ? "var(--online)" : "var(--danger)" }}>
                    {social.connected ? "En ligne" : "Reconnexion…"}
                  </div>
                </div>
                <svg className={"profile-chevron" + (menuOpen ? " up" : "")} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="profile-menu">
                    <button className="menu-item" onClick={() => { setMenuOpen(false); onOpenProfile(); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                      </svg>
                      Mon profil
                    </button>
                    <button className="menu-item" onClick={() => { setMenuOpen(false); onOpenSettings(); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.8 19.5l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8Z" />
                      </svg>
                      Paramètres
                    </button>
                    <div className="menu-sep" />
                    <button className="menu-item danger" onClick={() => { setMenuOpen(false); onLogout(); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="m16 17 5-5-5-5M21 12H9" />
                      </svg>
                      Déconnexion
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* corps */}
        <div className="launcher-body">
          <div className="launcher-main">
          <div className="launcher-greet">
            <h1>Salut {user.display_name.split(" ")[0]}.</h1>
            <p>On joue à quoi ce soir ?</p>
          </div>

          {/* barre de jeux (raccourcis) */}
          <div className="games-bar">
            <span className="games-bar-label">Jeux</span>
            <div className="games-bar-sep" />
            <button
              className="gt-icon gt-icon-game"
              title="L'Imposteur"
              disabled={!social.connected}
              onClick={() => onPickGame("impostor")}
            >
              <img className="gt-icon-img" src={imposteurIcon} alt="L'Imposteur" />
            </button>
            <button
              className="gt-icon gt-icon-game"
              title="Quiz Culture"
              disabled={!social.connected}
              onClick={() => onPickGame("quiz")}
            >
              <img className="gt-icon-img" src={quizIcon} alt="Quiz Culture" />
            </button>
            <div className="gt-icon locked" title="Spyfall — bientôt">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="6" y1="11" x2="10" y2="11" />
                <line x1="8" y1="9" x2="8" y2="13" />
                <line x1="15" y1="12" x2="15.01" y2="12" />
                <line x1="18" y1="10" x2="18.01" y2="10" />
                <rect x="2" y="6" width="20" height="12" rx="4" />
              </svg>
              <span className="gt-lock">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="3">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            </div>
            <div className="games-bar-spacer" />
            <span className="games-bar-count">1 à venir</span>
          </div>

          {/* hero : L'Imposteur */}
          <button
            className="hero"
            disabled={!social.connected}
            onClick={() => onPickGame("impostor")}
          >
            <div className="hero-bg" />
            <img className="hero-poster" src={imposteurHero} alt="" />
            <div className="hero-scrim" />
            <div className="hero-content">
              <div className="hero-top">
                <span className="badge-live">
                  <span />
                  Jouable
                </span>
                <span className="muted small" style={{ fontWeight: 600 }}>
                  {impostor ? `${impostor.min_players} – ${impostor.max_players} joueurs` : "4 – 10 joueurs"} · ~15 min
                </span>
              </div>
              <div>
                <div className="hero-kicker">Jeu à info cachée</div>
                <div className="hero-title">L'Imposteur</div>
                <div className="hero-desc">
                  Tout le monde reçoit un mot. Un seul en a un autre — et il ne le sait pas. Indices,
                  doutes, vote. Démasque le menteur.
                </div>
                <div className="hero-cta-row">
                  <span className="hero-cta">
                    <span className="hero-cta-sheen" />
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Ouvrir une table
                  </span>
                  <span className="muted small" style={{ fontWeight: 500 }}>
                    {onlineCount > 0
                      ? `${onlineCount} pote${onlineCount > 1 ? "s" : ""} en ligne`
                      : "Invite tes potes à rejoindre"}
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* catégorie : défis du jour (solo) */}
          <button className="daily-strip" onClick={onOpenDailies} disabled={!social.connected}>
            <span className="daily-strip-sheen" />
            <span className="daily-strip-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <div className="daily-strip-text">
              <div className="daily-strip-top">
                <span className="daily-strip-title">Défis du jour</span>
                {(daily?.streak ?? 0) > 0 && (
                  <span className="dl-mini-streak">
                    <span className="dl-flame">🔥</span>
                    <b className="mono">{daily!.streak}</b>
                  </span>
                )}
              </div>
              <div className="daily-strip-sub">
                Le Mot du jour · Wikidle — en solo, et tu compares avec tes potes
              </div>
            </div>
            {daily && daily.total > 0 && (
              <span className="daily-strip-state">
                <span className="daily-strip-dot" />
                {daily.total} défis · {daily.done} terminé{daily.done > 1 ? "s" : ""}
              </span>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b93a7" strokeWidth="2.2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* rangée : Quiz jouable + Spyfall à venir */}
          <div className="soon-row">
            <button
              className="game-card"
              disabled={!social.connected}
              onClick={() => onPickGame("quiz")}
              style={{ animationDelay: "0.12s" }}
            >
              <img className="game-card-art" src={quizHero} alt="" />
              <div className="game-card-scrim" />
              <div className="game-card-content">
                <span className="badge-live">
                  <span />
                  Jouable
                </span>
                <div>
                  <div className="game-card-title">Quiz Culture</div>
                  <div className="game-card-desc">
                    Drapeaux, sons, langues, frise, Petit Bac… l'hôte corrige, le classement tranche.
                  </div>
                </div>
              </div>
            </button>
            <SoonCard
              name="Spyfall"
              desc="Un espion, un lieu secret, des questions qui piègent."
              glow="radial-gradient(80% 100% at 85% 0%, rgba(34,211,238,.14), transparent 60%)"
              delay="0.18s"
            />
          </div>

          <p className="version">yGAMES v{version}</p>
          </div>
        </div>
      </div>

      <FriendsRail
        friends={social.friends}
        incoming={social.incoming}
        outgoing={social.outgoing}
        onAdd={social.addFriend}
        onAccept={social.acceptFriend}
        onDecline={social.declineFriend}
        onRemove={social.removeFriend}
        onViewProfile={onViewProfile}
      />
    </div>
  );
}

function SoonCard({ name, desc, glow, delay }: { name: string; desc: string; glow: string; delay: string }) {
  return (
    <div className="soon-card" style={{ animationDelay: delay }}>
      <div className="soon-glow" style={{ background: glow }} />
      <div className="soon-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="badge-soon">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Bientôt
          </span>
        </div>
        <div>
          <div className="soon-name">{name}</div>
          <div className="soon-desc">{desc}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
