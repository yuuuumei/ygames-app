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

        -- Stats cumulées par joueur (alimentent les déblocages cosmétiques).
        CREATE TABLE IF NOT EXISTS stats (
            user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            games_played       INTEGER NOT NULL DEFAULT 0,
            wins               INTEGER NOT NULL DEFAULT 0,
            impostor_games     INTEGER NOT NULL DEFAULT 0,
            impostor_wins      INTEGER NOT NULL DEFAULT 0,
            correct_votes      INTEGER NOT NULL DEFAULT 0,
            wins_without_clue  INTEGER NOT NULL DEFAULT 0,
            wrong_vote_streak  INTEGER NOT NULL DEFAULT 0,
            games_hosted       INTEGER NOT NULL DEFAULT 0
        );

        -- Cosmétiques équipés par joueur.
        CREATE TABLE IF NOT EXISTS cosmetics (
            user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            title     TEXT NOT NULL DEFAULT 'nouveau',
            border    TEXT NOT NULL DEFAULT 'neon',
            effect    TEXT NOT NULL DEFAULT 'confettis',
            signature TEXT NOT NULL DEFAULT '#7c6cff'
        );

        -- Catalogue des cosmétiques, géré depuis le back-office admin.
        -- cond_stat NULL = débloqué d'office ; sinon déblocage si
        -- stats[cond_stat] >= cond_value. visual = JSON (bordure/effet).
        CREATE TABLE IF NOT EXISTS catalog (
            id         TEXT PRIMARY KEY,
            slot       TEXT NOT NULL,
            name       TEXT NOT NULL,
            sub        TEXT NOT NULL DEFAULT '',
            locked_sub TEXT NOT NULL DEFAULT '',
            cond_stat  TEXT,
            cond_value INTEGER NOT NULL DEFAULT 0,
            visual     TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            enabled    INTEGER NOT NULL DEFAULT 1
        );

        -- Banque de questions du Quiz Culture. `answer` = réponse de
        -- référence (aide l'hôte à corriger ; réponses libres jugées à la main).
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL DEFAULT 'Général',
            question TEXT NOT NULL,
            answer   TEXT NOT NULL DEFAULT '',
            enabled  INTEGER NOT NULL DEFAULT 1
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


# --------------------------------------------------------- stats & cosmétiques

STAT_FIELDS = (
    "games_played",
    "wins",
    "impostor_games",
    "impostor_wins",
    "correct_votes",
    "wins_without_clue",
    "wrong_vote_streak",
    "games_hosted",
)


def _ensure_profile(conn, user_id: int) -> None:
    """Crée les lignes stats/cosmetics du user si absentes."""
    conn.execute("INSERT OR IGNORE INTO stats (user_id) VALUES (?)", (user_id,))
    conn.execute("INSERT OR IGNORE INTO cosmetics (user_id) VALUES (?)", (user_id,))


def get_stats(user_id: int) -> dict:
    conn = get_db()
    _ensure_profile(conn, user_id)
    conn.commit()
    row = conn.execute("SELECT * FROM stats WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    return {k: row[k] for k in STAT_FIELDS}


def get_cosmetics(user_id: int) -> dict:
    conn = get_db()
    _ensure_profile(conn, user_id)
    conn.commit()
    row = conn.execute(
        "SELECT title, border, effect, signature FROM cosmetics WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    return dict(row)


def set_cosmetic(user_id: int, slot: str, value: str) -> None:
    if slot not in ("title", "border", "effect", "signature"):
        raise ValueError(f"slot inconnu : {slot}")
    conn = get_db()
    _ensure_profile(conn, user_id)
    conn.execute(f"UPDATE cosmetics SET {slot} = ? WHERE user_id = ?", (value, user_id))
    conn.commit()
    conn.close()


def record_game_stats(reports: list[dict]) -> None:
    """Applique les faits d'une partie terminée aux stats de chaque joueur.

    Chaque report : {user_id, won, was_impostor, voted_correctly, gave_clue, hosted}.
    wrong_vote_streak : remis à 0 si le joueur a bien voté, +1 sinon.
    """
    conn = get_db()
    for r in reports:
        uid = r["user_id"]
        _ensure_profile(conn, uid)
        won = bool(r.get("won"))
        was_imp = bool(r.get("was_impostor"))
        voted_ok = bool(r.get("voted_correctly"))
        gave_clue = bool(r.get("gave_clue"))
        hosted = bool(r.get("hosted"))
        conn.execute(
            """
            UPDATE stats SET
                games_played      = games_played + 1,
                wins              = wins + ?,
                impostor_games    = impostor_games + ?,
                impostor_wins     = impostor_wins + ?,
                correct_votes     = correct_votes + ?,
                wins_without_clue = wins_without_clue + ?,
                games_hosted      = games_hosted + ?,
                wrong_vote_streak = CASE WHEN ? THEN 0 ELSE wrong_vote_streak + ? END
            WHERE user_id = ?
            """,
            (
                1 if won else 0,
                1 if was_imp else 0,
                1 if (was_imp and won) else 0,
                1 if voted_ok else 0,
                1 if (won and not gave_clue) else 0,
                1 if hosted else 0,
                1 if voted_ok else 0,          # remet la série à 0
                0 if voted_ok else 1,          # sinon +1
                uid,
            ),
        )
    conn.commit()
    conn.close()


# ------------------------------------------------------------- catalogue

CATALOG_FIELDS = (
    "id", "slot", "name", "sub", "locked_sub",
    "cond_stat", "cond_value", "visual", "sort_order", "enabled",
)


def catalog_all(include_disabled: bool = False) -> list[dict]:
    conn = get_db()
    q = "SELECT * FROM catalog"
    if not include_disabled:
        q += " WHERE enabled = 1"
    q += " ORDER BY slot, sort_order, name"
    rows = conn.execute(q).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def catalog_get(item_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM catalog WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def catalog_upsert(item: dict) -> None:
    conn = get_db()
    conn.execute(
        """
        INSERT INTO catalog (id, slot, name, sub, locked_sub, cond_stat,
                             cond_value, visual, sort_order, enabled)
        VALUES (:id, :slot, :name, :sub, :locked_sub, :cond_stat,
                :cond_value, :visual, :sort_order, :enabled)
        ON CONFLICT(id) DO UPDATE SET
            slot=excluded.slot, name=excluded.name, sub=excluded.sub,
            locked_sub=excluded.locked_sub, cond_stat=excluded.cond_stat,
            cond_value=excluded.cond_value, visual=excluded.visual,
            sort_order=excluded.sort_order, enabled=excluded.enabled
        """,
        {
            "id": item["id"],
            "slot": item["slot"],
            "name": item["name"],
            "sub": item.get("sub", ""),
            "locked_sub": item.get("locked_sub", ""),
            "cond_stat": item.get("cond_stat"),
            "cond_value": int(item.get("cond_value", 0)),
            "visual": item.get("visual"),
            "sort_order": int(item.get("sort_order", 0)),
            "enabled": 1 if item.get("enabled", True) else 0,
        },
    )
    conn.commit()
    conn.close()


def catalog_delete(item_id: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM catalog WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()


def seed_catalog(seed_rows: list[dict]) -> None:
    """Insère le catalogue par défaut si la table est vide (1re init)."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) AS n FROM catalog").fetchone()["n"]
    conn.close()
    if count == 0:
        for i, row in enumerate(seed_rows):
            row.setdefault("sort_order", i)
            catalog_upsert(row)


# ---------------------------------------------------- banque de questions quiz


def quiz_count() -> int:
    conn = get_db()
    n = conn.execute("SELECT COUNT(*) AS n FROM quiz_questions WHERE enabled = 1").fetchone()["n"]
    conn.close()
    return n


def quiz_categories() -> list[str]:
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT category FROM quiz_questions WHERE enabled = 1 ORDER BY category"
    ).fetchall()
    conn.close()
    return [r["category"] for r in rows]


def quiz_random(n: int, category: str | None = None) -> list[dict]:
    """Tire n questions au hasard (optionnellement d'une catégorie)."""
    conn = get_db()
    if category:
        rows = conn.execute(
            "SELECT * FROM quiz_questions WHERE enabled = 1 AND category = ? ORDER BY RANDOM() LIMIT ?",
            (category, n),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM quiz_questions WHERE enabled = 1 ORDER BY RANDOM() LIMIT ?",
            (n,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def quiz_all() -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM quiz_questions ORDER BY category, id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def quiz_upsert(item: dict) -> None:
    conn = get_db()
    if item.get("id"):
        conn.execute(
            "UPDATE quiz_questions SET category=?, question=?, answer=?, enabled=? WHERE id=?",
            (item["category"], item["question"], item.get("answer", ""),
             1 if item.get("enabled", True) else 0, item["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO quiz_questions (category, question, answer, enabled) VALUES (?, ?, ?, ?)",
            (item["category"], item["question"], item.get("answer", ""),
             1 if item.get("enabled", True) else 0),
        )
    conn.commit()
    conn.close()


def quiz_delete(qid: int) -> None:
    conn = get_db()
    conn.execute("DELETE FROM quiz_questions WHERE id = ?", (qid,))
    conn.commit()
    conn.close()


def seed_quiz(rows: list[dict]) -> None:
    """Remplit la banque si vide (1re init)."""
    if quiz_count() == 0 and rows:
        for r in rows:
            quiz_upsert(r)
