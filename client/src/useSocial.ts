import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "./server";

export type Friend = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  online?: boolean;
};

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
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(() => {
    socketRef.current?.emit("friends", (resp: SocialState & { error?: string }) => {
      if (!resp.error) setSocial(resp);
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
      });
      socket.on("disconnect", () => setConnected(false));

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

  return {
    connected,
    ...social,
    addFriend: (username: string) => act("friend_request", { username }),
    acceptFriend: (userId: number) => act("friend_accept", { user_id: userId }),
    declineFriend: (userId: number) => act("friend_decline", { user_id: userId }),
    removeFriend: (userId: number) => act("friend_remove", { user_id: userId }),
  };
}
