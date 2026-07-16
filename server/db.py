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
