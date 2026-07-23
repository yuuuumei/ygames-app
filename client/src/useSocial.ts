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
export type PublicUser = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};
export type HistoryEntry = {
  game_id: string;
  won: boolean;
  detail: Record<string, any>;
  played_at: number;
};
export type GameBreakdown = Record<string, { played: number; wins: number }>;

export type Profile = {
  stats: Record<string, number>;
  equipped: Equipped;
  catalog: { title: CatalogItem[]; border: CatalogItem[]; effect: CatalogItem[] };
  is_admin?: boolean;
  // vitrine
  user?: PublicUser;
  member_since?: number;
  online?: boolean;
  history?: HistoryEntry[];
  breakdown?: GameBreakdown;
  is_me?: boolean;
};

// user_id(str) -> cosmétiques à afficher sur son avatar
export type CosmeticInfo = { border_visual: any | null; signature: string; title: string };
export type CosmeticsMap = Record<string, CosmeticInfo>;

export type Lobby = {
  code: string;
  host_id: number;
  members: (Friend & { connected: boolean; is_bot?: boolean })[];
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
  game?: string;
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

// ---- Quiz Culture ----
export type QuizPlayer = { id: string; name: string; avatar: string; connected: boolean };
export type QuizMedia = {
  kind: "image" | "audio" | "images" | "timeline" | "petitbac";
  url?: string;
  urls?: string[];
  min?: number; // frise chronologique
  max?: number;
  categories?: string[]; // petit bac
} | null;
export type QuizEntry = {
  id: string;
  name: string;
  avatar: string;
  answer: string | null;
  has_answer: boolean;
  revealed: boolean;
  grade: boolean | null;
  suggested?: boolean; // aide de l'hôte (auto-correction), l'hôte décide
};
export type QuizDoubt = {
  player_id: string;
  yes: number;
  no: number;
  voted_ids: string[];
  your_vote: boolean | null;
  total: number;
};
export type PBPlayer = {
  id: string;
  name: string;
  avatar: string;
  grid: Record<string, string>;
  grades: Record<string, boolean | null>;
};
export type QuizRankRow = { id: string; name: string; avatar: string; score: number; rank: number };
export type QuizReviewRow = {
  number: number;
  category: string;
  text: string;
  reference: string;
  results: { id: string; name: string; answer: string | null; correct: boolean }[];
};
export type QuizView = {
  game: "quiz";
  phase: "answering" | "correcting" | "over";
  total: number;
  is_host: boolean;
  host_id: string;
  players: QuizPlayer[];
  scores: Record<string, number>;
  // answering
  question?: {
    number: number; category: string; text: string; type?: string; media?: QuizMedia;
    letter?: string; categories?: string[]; // petit bac
  };
  duration?: number;
  time_left?: number;
  your_answer?: string | null;
  answered_ids?: string[];
  answered_count?: number;
  waiting_count?: number;
  // correcting
  correction?: {
    number: number;
    category: string;
    text: string;
    reference: string;
    type?: string;
    media?: QuizMedia;
    entries: QuizEntry[];
    revealed_count: number;
    answerable_count: number;
    all_revealed: boolean;
    vote?: QuizDoubt;
    // petit bac
    letter?: string;
    categories?: string[];
    pb_players?: PBPlayer[];
  };
  // over
  ranking?: QuizRankRow[];
  review?: QuizReviewRow[];
};

/** Vue générique côté client : discriminée par `game` / `phase`. */
export type AnyGameView = GameView | QuizView;

export type GameOption = {
  key: string;
  label: string;
  default: any;
  choices: string[] | null;
  min?: number | null;
  max?: number | null;
  step?: number | null;
};
export type GameMeta = {
  id: string;
  name: string;
  icon: string;
  min_players: number;
  max_players: number;
  description: string;
  options: GameOption[];
};

/** Les jeux qui ont déjà leur écran côté client. */
export const PLAYABLE_GAMES = new Set(["impostor", "quiz", "stairs", "skribbl"]);

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
  const [gameView, setGameView] = useState<AnyGameView | null>(null);
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
      socket.on("game_view", (data: { view: AnyGameView; cosmetics?: CosmeticsMap }) => {
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
      socket.emit("game_state", (resp: { view: AnyGameView | null; cosmetics?: CosmeticsMap }) => {
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
    addBot: () => act("lobby_add_bot", {}),
    sendChat: (text: string) => act("lobby_chat", { text }),

    gameView,
    games,
    startGame: (gameId: string, config: Record<string, any> = {}) =>
      act("game_start", { game_id: gameId, config }),
    gameAction: (action: object) => act("game_action", { action }),
    endGame: async () => {
      const err = await act("game_end", {});
      if (!err) setGameView(null);
      return err;
    },

    profile,
    // upload d'un média de question (admin) → {url, kind} ou {error}
    uploadMedia: async (file: File): Promise<{ url?: string; kind?: string; error?: string }> => {
      try {
        const token = await invoke<string | null>("get_session_token");
        if (!token) return { error: "Non authentifié" };
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(SERVER_URL.replace(/\/$/, "") + "/admin/upload", {
          method: "POST",
          headers: { "X-Session-Token": token },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data.error || "Upload échoué" };
        return data;
      } catch (e) {
        return { error: String(e) };
      }
    },
    // vitrine d'un autre joueur (ami / co-membre d'une table)
    viewProfile: (userId: number) =>
      new Promise<{ profile?: Profile; error?: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ error: "Pas de connexion au serveur." });
          return;
        }
        socket.emit("profile_view", { user_id: userId }, (resp: any) => resolve(resp ?? {}));
      }),
    /** Émission « tire et oublie », sans attendre d'accusé de réception.
     *  Pour les flux très fréquents (les traits de Skribbl) : attendre un ack
     *  à chaque trait ajouterait un aller-retour par segment de ligne. */
    push: (event: string, data: object = {}) => {
      socketRef.current?.emit(event, data);
    },
    /** S'abonne à un événement serveur. Retourne la fonction de désabonnement,
     *  à appeler au démontage — sinon les écrans fantômes continuent d'écouter. */
    on: (event: string, handler: (data: any) => void) => {
      const socket = socketRef.current;
      socket?.on(event, handler);
      return () => {
        socket?.off(event, handler);
      };
    },
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
