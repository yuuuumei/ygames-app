import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { io, Socket } from "socket.io-client";
import { SERVER_URL } from "./server";

export type PresenceUser = {
  id: number;
  discord_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

/**
 * Maintient la connexion WebSocket au serveur tant que `loggedIn` est vrai.
 * Renvoie l'état de la connexion et la liste des joueurs en ligne.
 * socket.io gère seul les reconnexions (réseau qui saute, redéploiement…).
 */
export function usePresence(loggedIn: boolean) {
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!loggedIn) {
      setConnected(false);
      setOnline([]);
      return;
    }

    let socket: Socket | undefined;
    let cancelled = false;

    invoke<string | null>("get_session_token").then((token) => {
      if (!token || cancelled) return;

      socket = io(SERVER_URL, { auth: { token } });

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => {
        setConnected(false);
        setOnline([]);
      });

      socket.on("presence_snapshot", (data: { users: PresenceUser[] }) => {
        setOnline(data.users);
      });

      socket.on(
        "presence",
        (data: { user: PresenceUser; online: boolean }) => {
          setOnline((prev) => {
            const without = prev.filter(
              (u) => u.discord_id !== data.user.discord_id,
            );
            return data.online ? [...without, data.user] : without;
          });
        },
      );
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [loggedIn]);

  return { connected, online };
}
