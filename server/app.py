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

    # Snapshot de qui est en ligne pour l'arrivant…
    socketio.emit(
        "presence_snapshot",
        {"users": [e["user"] for e in online.values()]},
        to=request.sid,
    )
    # …et annonce aux autres s'il vient réellement d'arriver.
    if first_connection:
        socketio.emit("presence", {"user": entry["user"], "online": True})


@socketio.on("disconnect")
def ws_disconnect(reason=None):
    uid = sid_index.pop(request.sid, None)
    if uid is None or uid not in online:
        return
    entry = online[uid]
    entry["sids"].discard(request.sid)
    if not entry["sids"]:  # dernière connexion de ce compte
        del online[uid]
        socketio.emit("presence", {"user": entry["user"], "online": False})


if __name__ == "__main__":
    # Dev local uniquement (la prod passe par gunicorn, cf. Procfile).
    socketio.run(app, host="127.0.0.1", port=8787, debug=True)
