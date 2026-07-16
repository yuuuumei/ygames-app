"""Accès SQLite : users + sessions.

Deux tables :
- users    : un enregistrement par compte Discord connu.
- sessions : les tokens de session maison. On ne stocke JAMAIS le token
             en clair, seulement son empreinte SHA-256 — si quelqu'un
             vole la base, il ne peut pas se connecter avec.
"""

import hashlib
import os
import sqlite3
import time

DATABASE_PATH = os.environ.get("DATABASE_PATH", "ygames.db")

# Durée de vie d'une session : 30 jours (en secondes)
SESSION_LIFETIME = 30 * 24 * 3600


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # accès aux colonnes par nom
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id  TEXT NOT NULL UNIQUE,
            username    TEXT NOT NULL,
            global_name TEXT,
            avatar      TEXT,
            created_at  INTEGER NOT NULL,
            last_login  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        -- Une ligne par relation. status: 'pending' (en attente de
        -- l'accepté par addressee) ou 'accepted'. Jamais deux lignes
        -- pour la même paire (on vérifie les deux sens à l'insertion).
        CREATE TABLE IF NOT EXISTS friendships (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status       TEXT NOT NULL DEFAULT 'pending',
            created_at   INTEGER NOT NULL,
            UNIQUE(requester_id, addressee_id)
        );
        """
    )
    conn.commit()
    conn.close()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def upsert_user(discord_user: dict) -> dict:
    """Crée ou met à jour un user à partir de la réponse Discord /users/@me."""
    now = int(time.time())
    conn = get_db()
    conn.execute(
        """
        INSERT INTO users (discord_id, username, global_name, avatar, created_at, last_login)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
            username    = excluded.username,
            global_name = excluded.global_name,
            avatar      = excluded.avatar,
            last_login  = excluded.last_login
        """,
        (
            discord_user["id"],
            discord_user["username"],
            discord_user.get("global_name"),
            discord_user.get("avatar"),
            now,
            now,
        ),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM users WHERE discord_id = ?", (discord_user["id"],)
    ).fetchone()
    conn.close()
    return dict(row)


def create_session(user_id: int, token: str) -> None:
    now = int(time.time())
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (user_id, _hash_token(token), now, now + SESSION_LIFETIME),
    )
    conn.commit()
    conn.close()


def get_user_by_token(token: str) -> dict | None:
    """Renvoie le user associé à un token de session valide, sinon None."""
    now = int(time.time())
    conn = get_db()
    row = conn.execute(
        """
        SELECT u.* FROM users u
        JOIN sessions s ON s.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > ?
        """,
        (_hash_token(token), now),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_session(token: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))
    conn.commit()
    conn.close()


# ------------------------------------------------------------- friendships


def send_friend_request(requester_id: int, username: str) -> dict:
    """Envoie une demande d'ami vers `username`.

    Renvoie {"ok": ..., "auto_accepted": bool} ou {"error": message}.
    Cas particulier sympa : si l'autre m'avait déjà demandé, on accepte
    directement sa demande au lieu d'en créer une croisée.
    """
    conn = get_db()
    target = conn.execute(
        "SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,)
    ).fetchone()
    if not target:
        conn.close()
        return {"error": "Aucun joueur avec ce pseudo (il doit avoir lancé yGAMES au moins une fois)."}
    if target["id"] == requester_id:
        conn.close()
        return {"error": "On ne s'ajoute pas soi-même 🙂"}

    existing = conn.execute(
        """
        SELECT * FROM friendships
        WHERE (requester_id = ? AND addressee_id = ?)
           OR (requester_id = ? AND addressee_id = ?)
        """,
        (requester_id, target["id"], target["id"], requester_id),
    ).fetchone()

    if existing:
        if existing["status"] == "accepted":
            conn.close()
            return {"error": "Vous êtes déjà amis."}
        if existing["requester_id"] == requester_id:
            conn.close()
            return {"error": "Demande déjà envoyée, patience !"}
        # L'autre m'avait déjà demandé → on accepte sa demande.
        conn.execute(
            "UPDATE friendships SET status = 'accepted' WHERE id = ?",
            (existing["id"],),
        )
        conn.commit()
        conn.close()
        return {"ok": True, "auto_accepted": True, "other_id": target["id"]}

    conn.execute(
        "INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)",
        (requester_id, target["id"], int(time.time())),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "auto_accepted": False, "other_id": target["id"]}


def respond_friend_request(user_id: int, other_id: int, accept: bool) -> bool:
    """Accepte ou refuse la demande de `other_id` vers `user_id`."""
    conn = get_db()
    if accept:
        cur = conn.execute(
            "UPDATE friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
            (other_id, user_id),
        )
    else:
        cur = conn.execute(
            "DELETE FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
            (other_id, user_id),
        )
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed


def remove_friend(user_id: int, other_id: int) -> bool:
    """Supprime une amitié acceptée (dans un sens ou l'autre)."""
    conn = get_db()
    cur = conn.execute(
        """
        DELETE FROM friendships
        WHERE status = 'accepted'
          AND ((requester_id = ? AND addressee_id = ?)
            OR (requester_id = ? AND addressee_id = ?))
        """,
        (user_id, other_id, other_id, user_id),
    )
    conn.commit()
    changed = cur.rowcount > 0
    conn.close()
    return changed


def get_friend_ids(user_id: int) -> list[int]:
    """Les ids des amis acceptés de user_id."""
    conn = get_db()
    rows = conn.execute(
        """
        SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS fid
        FROM friendships
        WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)
        """,
        (user_id, user_id, user_id),
    ).fetchall()
    conn.close()
    return [r["fid"] for r in rows]


def get_social(user_id: int) -> dict:
    """Tout le social d'un user : amis, demandes reçues, demandes envoyées."""
    conn = get_db()
    friends = conn.execute(
        """
        SELECT u.* FROM users u
        JOIN friendships f ON f.status = 'accepted'
            AND ((f.requester_id = ? AND u.id = f.addressee_id)
              OR (f.addressee_id = ? AND u.id = f.requester_id))
        """,
        (user_id, user_id),
    ).fetchall()
    incoming = conn.execute(
        """
        SELECT u.* FROM users u
        JOIN friendships f ON f.status = 'pending'
            AND f.addressee_id = ? AND u.id = f.requester_id
        """,
        (user_id,),
    ).fetchall()
    outgoing = conn.execute(
        """
        SELECT u.* FROM users u
        JOIN friendships f ON f.status = 'pending'
            AND f.requester_id = ? AND u.id = f.addressee_id
        """,
        (user_id,),
    ).fetchall()
    conn.close()
    return {
        "friends": [dict(r) for r in friends],
        "incoming": [dict(r) for r in incoming],
        "outgoing": [dict(r) for r in outgoing],
    }
