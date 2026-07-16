"""Serveur yGAMES — Phase 1 : auth Discord · Phase 2 : présence temps réel.

HTTP (Flask)        : /auth/* — login, session, logout (voir plus bas).
WebSocket (SocketIO): connexion permanente de chaque client connecté.
    Le client s'authentifie à la connexion avec son token de session
    (auth: {token}). Le serveur tient le registre de qui est en ligne
    et le diffuse à tout le monde :
      → "presence_snapshot" {users: [...]}     à l'arrivant
      → "presence" {user, online: true|false}  à tous, à chaque changement
"""

import os
import secrets

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_socketio import SocketIO

load_dotenv()  # charge server/.env

import db  # noqa: E402  (après load_dotenv pour que DATABASE_PATH soit lu)
import lobbies as lb  # noqa: E402

DISCORD_API = "https://discord.com/api/v10"
CLIENT_ID = os.environ["DISCORD_CLIENT_ID"]
CLIENT_SECRET = os.environ["DISCORD_CLIENT_SECRET"]

app = Flask(__name__)
db.init_db()

# cors "*" : le client est une app Tauri (origine tauri://), pas un site web.
socketio = SocketIO(app, cors_allowed_origins="*")


def public_user(user: dict) -> dict:
    """La forme du user qu'on renvoie au client (pas les colonnes internes)."""
    avatar_url = None
    if user["avatar"]:
        avatar_url = (
            f"https://cdn.discordapp.com/avatars/{user['discord_id']}/{user['avatar']}.png?size=128"
        )
    return {
        "id": user["id"],
        "discord_id": user["discord_id"],
        "username": user["username"],
        "display_name": user["global_name"] or user["username"],
        "avatar_url": avatar_url,
    }


def user_from_request() -> dict | None:
    """Extrait le user du header Authorization: Bearer <token>."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return db.get_user_by_token(auth.removeprefix("Bearer "))


# ================================================================ HTTP auth


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "ygames-server"})


@app.post("/auth/discord")
def auth_discord():
    """Échange un code OAuth Discord contre une session yGAMES."""
    data = request.get_json(silent=True) or {}
    code = data.get("code")
    redirect_uri = data.get("redirect_uri")
    if not code or not redirect_uri:
        return jsonify({"error": "code et redirect_uri requis"}), 400

    # 1. code -> access token (c'est ici que le client_secret sert)
    token_resp = requests.post(
        f"{DISCORD_API}/oauth2/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if token_resp.status_code != 200:
        return jsonify({"error": "échange du code refusé par Discord"}), 401
    access_token = token_resp.json()["access_token"]

    # 2. access token -> identité
    me_resp = requests.get(
        f"{DISCORD_API}/users/@me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if me_resp.status_code != 200:
        return jsonify({"error": "impossible de récupérer le profil Discord"}), 502
    discord_user = me_resp.json()

    # 3. upsert + session maison
    user = db.upsert_user(discord_user)
    session_token = secrets.token_urlsafe(32)
    db.create_session(user["id"], session_token)

    return jsonify({"token": session_token, "user": public_user(user)})


@app.get("/auth/me")
def auth_me():
    """Auto-login : le client vérifie que son token du keychain est encore bon."""
    user = user_from_request()
    if not user:
        return jsonify({"error": "session invalide ou expirée"}), 401
    return jsonify({"user": public_user(user)})


@app.post("/auth/logout")
def auth_logout():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        db.delete_session(auth.removeprefix("Bearer "))
    return jsonify({"ok": True})


# ========================================================= présence (WS)

# user_id -> {"user": public_user, "sids": {sid, ...}}
# Un même compte peut avoir plusieurs connexions (2 PC, dev + installé...) :
# il n'est "hors ligne" que quand sa DERNIÈRE connexion tombe.
# 1 seul worker gunicorn (voir Procfile) → un dict en mémoire suffit.
online: dict[int, dict] = {}

# sid -> user_id, pour retrouver qui se déconnecte
sid_index: dict[str, int] = {}


def emit_to_user(event: str, data, uid: int) -> None:
    """Envoie un événement à TOUTES les connexions d'un user (s'il est en ligne)."""
    entry = online.get(uid)
    if entry:
        for sid in entry["sids"]:
            socketio.emit(event, data, to=sid)


def current_user() -> dict | None:
    """Le user derrière le socket courant (via le registre des sids)."""
    uid = sid_index.get(request.sid)
    if uid is None:
        return None
    entry = online.get(uid)
    return {"id": uid, **entry["user"]} if entry else None


def social_payload(uid: int) -> dict:
    """La friendlist complète d'un user, avec l'état en ligne de chaque ami."""
    social = db.get_social(uid)
    return {
        "friends": [
            {**public_user(f), "online": f["id"] in online}
            for f in social["friends"]
        ],
        "incoming": [public_user(u) for u in social["incoming"]],
        "outgoing": [public_user(u) for u in social["outgoing"]],
    }


@socketio.on("connect")
def ws_connect(auth):
    token = (auth or {}).get("token", "")
    user = db.get_user_by_token(token)
    if not user:
        return False  # refuse la connexion : socket non authentifié

    uid = user["id"]
    sid_index[request.sid] = uid

    first_connection = uid not in online
    entry = online.setdefault(uid, {"user": public_user(user), "sids": set()})
    entry["sids"].add(request.sid)

    if first_connection:
        # Annonce l'arrivée aux AMIS en ligne uniquement.
        for fid in db.get_friend_ids(uid):
            emit_to_user("presence", {"user": entry["user"], "online": True}, fid)
        # De retour dans son lobby après une coupure ? On le re-marque présent.
        lobby = lb.set_connected(uid, True)
        if lobby:
            broadcast_lobby(lobby)


@socketio.on("disconnect")
def ws_disconnect(reason=None):
    uid = sid_index.pop(request.sid, None)
    if uid is None or uid not in online:
        return
    entry = online[uid]
    entry["sids"].discard(request.sid)
    if not entry["sids"]:  # dernière connexion de ce compte
        del online[uid]
        for fid in db.get_friend_ids(uid):
            emit_to_user("presence", {"user": entry["user"], "online": False}, fid)
        # S'il était dans un lobby : marqué déconnecté + délai de grâce.
        lobby = lb.set_connected(uid, False)
        if lobby:
            broadcast_lobby(lobby)
            socketio.start_background_task(_grace_timeout, uid, lobby["code"])


def _grace_timeout(uid: int, code: str) -> None:
    """Si l'utilisateur n'est pas revenu après le délai de grâce, il sort."""
    socketio.sleep(lb.GRACE_SECONDS)
    if uid in online:  # revenu entre-temps
        return
    lobby = lb.lobbies.get(code)
    if not lobby or uid not in lobby["members"]:
        return
    remaining = lb.leave(uid)
    if remaining:
        broadcast_lobby(remaining)


# ======================================================== friendlist (WS)
# Chaque handler renvoie un dict = ack socket.io, reçu par le callback client.
# Après tout changement, on pousse "friends_changed" aux deux intéressés :
# leurs clients re-demandent alors leur friendlist à jour.


@socketio.on("friends")
def ws_friends(_data=None):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    return social_payload(me["id"])


@socketio.on("friend_request")
def ws_friend_request(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    username = str((data or {}).get("username", "")).strip().lstrip("@")
    if not username:
        return {"error": "Pseudo vide."}
    result = db.send_friend_request(me["id"], username)
    if "error" in result:
        return result
    emit_to_user("friends_changed", {}, result["other_id"])
    return result


@socketio.on("friend_accept")
def ws_friend_accept(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    other_id = int((data or {}).get("user_id", 0))
    if not db.respond_friend_request(me["id"], other_id, accept=True):
        return {"error": "Demande introuvable."}
    emit_to_user("friends_changed", {}, other_id)
    return {"ok": True}


@socketio.on("friend_decline")
def ws_friend_decline(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    other_id = int((data or {}).get("user_id", 0))
    if not db.respond_friend_request(me["id"], other_id, accept=False):
        return {"error": "Demande introuvable."}
    emit_to_user("friends_changed", {}, other_id)
    return {"ok": True}


@socketio.on("friend_remove")
def ws_friend_remove(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    other_id = int((data or {}).get("user_id", 0))
    if not db.remove_friend(me["id"], other_id):
        return {"error": "Ami introuvable."}
    emit_to_user("friends_changed", {}, other_id)
    return {"ok": True}


# ============================================================ lobby (WS)


def broadcast_lobby(lobby: dict) -> None:
    """Pousse l'état du lobby à tous ses membres (toutes leurs connexions)."""
    data = {"lobby": lb.serialize(lobby)}
    for uid in lobby["members"]:
        emit_to_user("lobby_update", data, uid)


def _leave_current_lobby(uid: int) -> None:
    """Sort `uid` de son lobby actuel (s'il en a un) et prévient les restants."""
    remaining = lb.leave(uid)
    if remaining:
        broadcast_lobby(remaining)


@socketio.on("lobby_state")
def ws_lobby_state(_data=None):
    """Re-synchronisation (après reconnexion, au montage de l'écran...)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    return {"lobby": lb.serialize(lobby) if lobby else None}


@socketio.on("lobby_create")
def ws_lobby_create(_data=None):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    _leave_current_lobby(me["id"])
    lobby = lb.create(me)
    return {"lobby": lb.serialize(lobby)}


@socketio.on("lobby_join")
def ws_lobby_join(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    code = str((data or {}).get("code", ""))
    current = lb.get(me["id"])
    if current and current["code"] != code.strip().upper():
        _leave_current_lobby(me["id"])
    lobby, error = lb.join(me, code)
    if error:
        return {"error": error}
    broadcast_lobby(lobby)
    return {"lobby": lb.serialize(lobby)}


@socketio.on("lobby_leave")
def ws_lobby_leave(_data=None):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    _leave_current_lobby(me["id"])
    return {"ok": True}


@socketio.on("lobby_invite")
def ws_lobby_invite(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    if not lobby:
        return {"error": "Tu n'es pas dans un lobby."}
    target_id = int((data or {}).get("user_id", 0))
    if target_id not in db.get_friend_ids(me["id"]):
        return {"error": "Tu ne peux inviter que tes amis."}
    if target_id not in online:
        return {"error": "Cet ami n'est pas en ligne."}
    emit_to_user(
        "lobby_invited",
        {"code": lobby["code"], "from": online[me["id"]]["user"]},
        target_id,
    )
    return {"ok": True}


@socketio.on("lobby_kick")
def ws_lobby_kick(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    if not lobby or lobby["host_id"] != me["id"]:
        return {"error": "Seul le host peut exclure."}
    target_id = int((data or {}).get("user_id", 0))
    if target_id == me["id"] or target_id not in lobby["members"]:
        return {"error": "Membre introuvable."}
    remaining = lb.leave(target_id)
    emit_to_user("lobby_kicked", {}, target_id)
    if remaining:
        broadcast_lobby(remaining)
    return {"ok": True}


@socketio.on("lobby_chat")
def ws_lobby_chat(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    text = str((data or {}).get("text", "")).strip()
    if not text:
        return {"error": "Message vide."}
    lobby, message = lb.add_chat(me["id"], text)
    if not lobby:
        return {"error": "Tu n'es pas dans un lobby."}
    for uid in lobby["members"]:
        emit_to_user("lobby_chat", message, uid)
    return {"ok": True}


if __name__ == "__main__":
    # Dev local uniquement (la prod passe par gunicorn, cf. Procfile).
    socketio.run(app, host="127.0.0.1", port=8787, debug=True)
