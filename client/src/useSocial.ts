import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "./server";
import { sound } from "./sound";

export type Friend = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  online?: boolean;
};

export type ChatMessage = {
  from: Friend;
  text: string;
  ts: number;
};

// ---- profil / cosmétiques ----
export type Equipped = {
  title: string;
  border: string;
  effect: string;
  signature: string;
};
export type CatalogItem = {
  id: string;
  name: string;
  sub: string;
  unlocked: boolean;
  progress: string | null;
  visual: any | null;
};
export type Profile = {
  stats: Record<string, number>;
  equipped: Equipped;
  catalog: { title: CatalogItem[]; border: CatalogItem[]; effect: CatalogItem[] };
  is_admin?: boolean;
};

// user_id(str) -> cosmétiques à afficher sur son avatar
export type CosmeticInfo = { border_visual: any | null; signature: string; title: string };
export type CosmeticsMap = Record<string, CosmeticInfo>;

export type Lobby = {
  code: string;
  host_id: number;
  members: (Friend & { connected: boolean })[];
  chat: ChatMessage[];
};

export type LobbyInvite = {
  code: string;
  from: Friend;
};

export type GamePlayer = {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  has_clue: boolean;
  has_voted: boolean;
};

export type GameView = {
  phase: "clues" | "vote" | "over";
  category: string;
  your_word: string | null;
  players: GamePlayer[];
  clues: Record<string, string>;
  current_turn?: string;
  current_turn_id?: string;
  reveal?: {
    impostors: string[];
    word_main: string;
    word_impostor: string;
    votes: Record<string, string>;
    winners: string[];
  };
};

export type GameMeta = {
  id: string;
  name: string;
  icon: string;
  min_players: number;
  max_players: number;
  description: string;
};

/** Les jeux qui ont déjà leur écran côté client. */
export const PLAYABLE_GAMES = new Set(["impostor"]);

type SocialState = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
};

const EMPTY: SocialState = { friends: [], incoming: [], outgoing: [] };

/**
 * Gère la connexion WebSocket et tout le "social" :
 * friendlist, demandes reçues/envoyées, présence des amis.
 */
export function useSocial(loggedIn: boolean) {
  const [connected, setConnected] = useState(false);
  const [social, setSocial] = useState<SocialState>(EMPTY);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  // Lobby retrouvé au (re)démarrage : on PROPOSE d'y retourner au lieu
  // d'y téléporter l'utilisateur (écran "Se reconnecter").
  const [pendingLobby, setPendingLobby] = useState<Lobby | null>(null);
  const [invites, setInvites] = useState<LobbyInvite[]>([]);
  const [gameView, setGameView] = useState<GameView | null>(null);
  const [games, setGames] = useState<GameMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cosmetics, setCosmetics] = useState<CosmeticsMap>({});
  const socketRef = useRef<Socket | null>(null);
  const lobbyRef = useRef<Lobby | null>(null);
  const pendingRef = useRef<Lobby | null>(null);
  lobbyRef.current = lobby;
  pendingRef.current = pendingLobby;

  const refresh = useCallback(() => {
    socketRef.current?.emit("friends", (resp: SocialState & { error?: string }) => {
      if (!resp.error) setSocial(resp);
    });
  }, []);

  const refreshProfile = useCallback(() => {
    socketRef.current?.emit("profile_get", (resp: { profile?: Profile; error?: string }) => {
      if (resp?.profile) setProfile(resp.profile);
    });
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setConnected(false);
      setSocial(EMPTY);
      return;
    }

    let cancelled = false;

    invoke<string | null>("get_session_token").then((token) => {
      if (!token || cancelled) return;

      const socket = io(SERVER_URL, { auth: { token } });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        refresh(); // friendlist fraîche à chaque (re)connexion
        refreshProfile(); // cosmétiques + stats
        // Re-synchronise le lobby (on y est peut-être encore, délai de grâce).
        socket.emit("lobby_state", (resp: { lobby: Lobby | null }) => {
          const found = resp?.lobby ?? null;
          if (!found) {
            setLobby(null);
            setPendingLobby(null);
          } else if (lobbyRef.current) {
            // On était DÉJÀ sur l'écran lobby (micro-coupure) : resync silencieuse.
            setLobby(found);
          } else {
            // Retour dans l'app : on propose la reconnexion, sans forcer.
            setPendingLobby(found);
          }
        });
      });
      socket.on("disconnect", () => setConnected(false));

      // ------- lobby -------
      socket.on("lobby_update", (data: { lobby: Lobby; cosmetics?: CosmeticsMap }) => {
        if (data.cosmetics) setCosmetics(data.cosmetics);
        // Tant que la reconnexion n'est pas choisie, on met à jour la
        // proposition, pas l'écran.
        if (pendingRef.current) {
          setPendingLobby(data.lobby);
        } else {
          setLobby(data.lobby);
        }
      });
      socket.on("lobby_chat", (msg: ChatMessage) => {
        setLobby((prev) =>
          prev ? { ...prev, chat: [...prev.chat, msg] } : prev,
        );
      });
      socket.on("lobby_invited", (inv: LobbyInvite) => {
        setInvites((prev) => [...prev.filter((i) => i.code !== inv.code), inv]);
        sound.play("your_turn");
      });
      socket.on("lobby_kicked", () => {
        setLobby(null);
        setPendingLobby(null);
        setGameView(null);
      });

      // ------- jeux -------
      socket.on("game_view", (data: { view: GameView; cosmetics?: CosmeticsMap }) => {
        if (data.cosmetics) setCosmetics(data.cosmetics);
        setGameView(data.view);
      });
      socket.on("game_ended", () => setGameView(null));

      // stats mises à jour (fin de partie) → recharge le profil
      socket.on("profile_stale", () => refreshProfile());

      socket.emit("game_list", (resp: { games: GameMeta[] }) => {
        if (resp?.games) setGames(resp.games);
      });
      // Une partie en cours ? (reconnexion en plein jeu)
      socket.emit("game_state", (resp: { view: GameView | null; cosmetics?: CosmeticsMap }) => {
        if (resp?.cosmetics) setCosmetics(resp.cosmetics);
        setGameView(resp?.view ?? null);
      });

      // Un ami se connecte / se déconnecte.
      socket.on("presence", (data: { user: Friend; online: boolean }) => {
        setSocial((prev) => ({
          ...prev,
          friends: prev.friends.map((f) =>
            f.discord_id === data.user.discord_id
              ? { ...f, online: data.online }
              : f,
          ),
        }));
      });

      // Ma friendlist a changé côté serveur (demande, acceptation…).
      socket.on("friends_changed", refresh);
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [loggedIn, refresh]);

  /** Émet un événement avec ack et renvoie l'erreur éventuelle (null = succès). */
  const act = useCallback(
    (event: string, data: object) =>
      new Promise<string | null>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve("Pas de connexion au serveur.");
          return;
        }
        socket.emit(event, data, (resp: { error?: string }) => {
          if (resp?.error) {
            resolve(resp.error);
          } else {
            refresh();
            resolve(null);
          }
        });
      }),
    [refresh],
  );

  /** Émet un événement dont l'ack contient {lobby} et met l'état à jour. */
  const lobbyAct = useCallback(
    (event: string, data: object = {}) =>
      new Promise<string | null>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve("Pas de connexion au serveur.");
          return;
        }
        socket.emit(event, data, (resp: { lobby?: Lobby; error?: string }) => {
          if (resp?.error) {
            resolve(resp.error);
          } else {
            if (resp?.lobby !== undefined) setLobby(resp.lobby);
            if (resp?.lobby) sound.play("join"); // on entre dans une table
            resolve(null);
          }
        });
      }),
    [],
  );

  return {
    connected,
    ...social,
    addFriend: (username: string) => act("friend_request", { username }),
    acceptFriend: (userId: number) => act("friend_accept", { user_id: userId }),
    declineFriend: (userId: number) => act("friend_decline", { user_id: userId }),
    removeFriend: (userId: number) => act("friend_remove", { user_id: userId }),

    lobby,
    pendingLobby,
    invites,
    cosmetics,
    createLobby: () => lobbyAct("lobby_create"),
    joinLobby: (code: string) => {
      setInvites((prev) => prev.filter((i) => i.code !== code));
      setPendingLobby(null);
      return lobbyAct("lobby_join", { code });
    },
    leaveLobby: async () => {
      const err = await act("lobby_leave", {});
      if (!err) {
        setLobby(null);
        setPendingLobby(null);
      }
      return err;
    },
    dismissInvite: (code: string) =>
      setInvites((prev) => prev.filter((i) => i.code !== code)),
    inviteToLobby: (userId: number) => act("lobby_invite", { user_id: userId }),
    kickFromLobby: (userId: number) => act("lobby_kick", { user_id: userId }),
    sendChat: (text: string) => act("lobby_chat", { text }),

    gameView,
    games,
    startGame: (gameId: string) =>
      act("game_start", { game_id: gameId, config: {} }),
    gameAction: (action: object) => act("game_action", { action }),
    endGame: async () => {
      const err = await act("game_end", {});
      if (!err) setGameView(null);
      return err;
    },

    profile,
    // requête générique avec ack (renvoie toute la réponse) — pour l'admin
    ask: (event: string, data: object = {}) =>
      new Promise<any>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ error: "Pas de connexion au serveur." });
          return;
        }
        socket.emit(event, data, (resp: any) => resolve(resp ?? {}));
      }),
    setCosmetic: (slot: string, value: string) =>
      new Promise<string | null>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve("Pas de connexion au serveur.");
          return;
        }
        socket.emit("profile_set", { slot, value }, (resp: { equipped?: Equipped; error?: string }) => {
          if (resp?.error) {
            resolve(resp.error);
          } else {
            if (resp?.equipped) {
              setProfile((p) => (p ? { ...p, equipped: resp.equipped! } : p));
            }
            resolve(null);
          }
        });
      }),
  };
}
