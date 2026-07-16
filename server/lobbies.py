"""Lobbies en mémoire — l'endroit où on se pose entre les parties.

Comme la présence : un seul worker gunicorn (cf. Procfile), donc de simples
dicts suffisent. Un lobby meurt quand son dernier membre part ; un membre
déconnecté brutalement a un délai de grâce pour revenir avant d'être sorti.

Ce module ne parle PAS au réseau : app.py orchestre les événements socket
et appelle ces fonctions.
"""

import random
import time

GRACE_SECONDS = 120  # délai pour revenir après une coupure réseau
CHAT_HISTORY = 50    # messages conservés/envoyés aux arrivants

# code -> lobby ; lobby = {code, host_id, members: {uid: member}, chat: [...]}
# member = {"user": public_user, "connected": bool, "joined_at": float}
lobbies: dict[str, dict] = {}

# user_id -> code (un user est dans au plus un lobby)
user_lobby: dict[int, str] = {}

# Alphabet sans caractères ambigus (pas de O/0, I/1/L).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _new_code() -> str:
    while True:
        code = "".join(random.choices(_CODE_ALPHABET, k=4))
        if code not in lobbies:
            return code


def create(user: dict) -> dict:
    """Crée un lobby avec `user` (public_user) comme host. Il ne doit plus
    être dans un autre lobby (app.py l'en sort d'abord)."""
    uid = user["id"]
    code = _new_code()
    lobbies[code] = {
        "code": code,
        "host_id": uid,
        "members": {uid: {"user": user, "connected": True, "joined_at": time.time()}},
        "chat": [],
    }
    user_lobby[uid] = code
    return lobbies[code]


def join(user: dict, code: str) -> tuple[dict | None, str | None]:
    """Renvoie (lobby, None) ou (None, message d'erreur)."""
    code = code.strip().upper()
    lobby = lobbies.get(code)
    if not lobby:
        return None, "Aucun lobby avec ce code."
    uid = user["id"]
    if uid in lobby["members"]:  # déjà dedans (retour après coupure)
        lobby["members"][uid]["connected"] = True
        return lobby, None
    lobby["members"][uid] = {"user": user, "connected": True, "joined_at": time.time()}
    user_lobby[uid] = code
    return lobby, None


def leave(uid: int) -> dict | None:
    """Sort `uid` de son lobby. Renvoie le lobby restant (déjà mis à jour,
    host transféré au plus ancien si besoin), ou None s'il est mort/inexistant."""
    code = user_lobby.pop(uid, None)
    if not code:
        return None
    lobby = lobbies.get(code)
    if not lobby:
        return None
    lobby["members"].pop(uid, None)
    if not lobby["members"]:
        del lobbies[code]
        return None
    if lobby["host_id"] == uid:
        lobby["host_id"] = min(
            lobby["members"].items(), key=lambda kv: kv[1]["joined_at"]
        )[0]
    return lobby


def get(uid: int) -> dict | None:
    code = user_lobby.get(uid)
    return lobbies.get(code) if code else None


def set_connected(uid: int, connected: bool) -> dict | None:
    """Marque un membre (dé)connecté sans le sortir. Renvoie son lobby."""
    lobby = get(uid)
    if lobby and uid in lobby["members"]:
        lobby["members"][uid]["connected"] = connected
        return lobby
    return None


def add_chat(uid: int, text: str) -> tuple[dict | None, dict | None]:
    """Ajoute un message. Renvoie (lobby, message) ou (None, None)."""
    lobby = get(uid)
    if not lobby:
        return None, None
    message = {
        "from": lobby["members"][uid]["user"],
        "text": text[:500],
        "ts": int(time.time()),
    }
    lobby["chat"].append(message)
    del lobby["chat"][:-CHAT_HISTORY]
    return lobby, message


def serialize(lobby: dict) -> dict:
    """La vue du lobby envoyée aux clients."""
    return {
        "code": lobby["code"],
        "host_id": lobby["host_id"],
        "members": [
            {**m["user"], "connected": m["connected"]}
            for m in sorted(lobby["members"].values(), key=lambda m: m["joined_at"])
        ],
        "chat": lobby["chat"][-CHAT_HISTORY:],
    }
