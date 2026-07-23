"""Serveur yGAMES — Phase 1 : auth Discord · Phase 2 : présence temps réel.

HTTP (Flask)        : /auth/* — login, session, logout (voir plus bas).
WebSocket (SocketIO): connexion permanente de chaque client connecté.
    Le client s'authentifie à la connexion avec son token de session
    (auth: {token}). Le serveur tient le registre de qui est en ligne
    et le diffuse à tout le monde :
      → "presence_snapshot" {users: [...]}     à l'arrivant
      → "presence" {user, online: true|false}  à tous, à chaque changement
"""

import mimetypes
import os
import random
import secrets

mimetypes.add_type("image/svg+xml", ".svg")  # servir les drapeaux comme du SVG

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO

load_dotenv()  # charge server/.env

import db  # noqa: E402  (après load_dotenv pour que DATABASE_PATH soit lu)
import lobbies as lb  # noqa: E402
import game_sessions as gs  # noqa: E402
import profiles  # noqa: E402
import bots  # noqa: E402

DISCORD_API = "https://discord.com/api/v10"
CLIENT_ID = os.environ["DISCORD_CLIENT_ID"]
CLIENT_SECRET = os.environ["DISCORD_CLIENT_SECRET"]
ADMIN_DISCORD_IDS = {
    x.strip() for x in os.environ.get("ADMIN_DISCORD_IDS", "").split(",") if x.strip()
}

app = Flask(__name__)
db.init_db()
profiles.ensure_seed()  # remplit le catalogue par défaut au 1er lancement

from games.quiz.data import (  # noqa: E402
    SEED_QUESTIONS as _QUIZ_SEED,
    TIMELINE_QUESTIONS as _TL_SEED,
    PETITBAC_QUESTIONS as _PB_SEED,
    ANIMAL_QUESTIONS as _ANIMAL_SEED,
)
db.seed_quiz(_QUIZ_SEED)  # remplit la banque du Quiz au 1er lancement
db.seed_quiz_type(_TL_SEED, "timeline")  # catégorie Frise chrono au 1er lancement
db.seed_quiz_type(_PB_SEED, "petitbac")  # manches Petit Bac au 1er lancement
db.seed_quiz_type(_ANIMAL_SEED, "audio")  # catégorie Bruits d'animaux au 1er lancement
from games.quiz.flags_data import FLAG_QUESTIONS as _FLAG_SEED  # noqa: E402
db.seed_quiz_flags(_FLAG_SEED)  # catégorie Drapeaux (auto) au 1er lancement
from games.quiz.culture_data import CULTURE_QUESTIONS as _CULTURE_SEED  # noqa: E402
db.seed_quiz_batch(_CULTURE_SEED, "culture_v1")  # gros lot culture (mangas/séries/films…)
from games.quiz.culture2_data import CULTURE_QUESTIONS_V2 as _CULTURE2_SEED  # noqa: E402
db.seed_quiz_batch(_CULTURE2_SEED, "culture_g_v2")  # lot culture G (histoire/politique/maths…)
from games.quiz.languages_data import LANGUAGE_QUESTIONS as _LANG_SEED  # noqa: E402
# v2 : 1 phrase unique par langue, 36 langues — remplace l'ancien lot v1.
db.seed_quiz_replace(_LANG_SEED, "languages_v2", "Langue étrangère")

# Médias des questions : drapeaux BUNDLÉS (server/media) + UPLOADS (volume).
_MEDIA_BUNDLED = os.path.join(os.path.dirname(__file__), "media")
# Les uploads vivent à côté de la base (volume Railway = /data, ou dossier local).
_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.environ.get("DATABASE_PATH", "")) or os.path.dirname(__file__),
    "media_uploads",
)
os.makedirs(_UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE = {"png", "jpg", "jpeg", "webp", "gif", "svg"}
ALLOWED_AUDIO = {"mp3", "ogg", "wav", "m4a"}
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 Mo max par upload


@app.after_request
def _cors(resp):
    """CORS pour les routes HTTP appelées depuis la webview (upload, médias)."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Session-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.route("/media/<path:filename>")
def serve_media(filename):
    """Sert un média : d'abord les fichiers bundlés (drapeaux…), sinon les uploads."""
    if os.path.isfile(os.path.join(_MEDIA_BUNDLED, filename)):
        return send_from_directory(_MEDIA_BUNDLED, filename)
    return send_from_directory(_UPLOAD_DIR, filename)


@app.route("/admin/upload", methods=["POST", "OPTIONS"])
def admin_upload():
    """Upload d'un média de question (admin). Renvoie {url, kind}."""
    if request.method == "OPTIONS":
        return ("", 204)
    user = db.get_user_by_token(request.headers.get("X-Session-Token", ""))
    if not is_admin(user):
        return jsonify({"error": "réservé aux admins"}), 403
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "aucun fichier"}), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext in ALLOWED_IMAGE:
        kind = "image"
    elif ext in ALLOWED_AUDIO:
        kind = "audio"
    else:
        return jsonify({"error": "type de fichier non autorisé"}), 400
    name = f"{secrets.token_hex(16)}.{ext}"
    f.save(os.path.join(_UPLOAD_DIR, name))
    return jsonify({"url": f"/media/{name}", "kind": kind})


def is_admin(user: dict | None) -> bool:
    return bool(user) and user.get("discord_id") in ADMIN_DISCORD_IDS

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
            # Une partie en cours ? Le runner resynchronise sa vue.
            session = gs.get(lobby["code"])
            if session and uid in session["user_ids"]:
                session["runner"].reconnect(str(uid))


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
            # Le jeu en cours gère l'absence (passe son tour, etc.).
            session = gs.get(lobby["code"])
            if session and uid in session["user_ids"]:
                session["runner"].disconnect(str(uid))


def _grace_timeout(uid: int, code: str) -> None:
    """Si l'utilisateur n'est pas revenu après le délai de grâce, il sort."""
    socketio.sleep(lb.GRACE_SECONDS)
    if uid in online:  # revenu entre-temps
        return
    lobby = lb.lobbies.get(code)
    if not lobby or uid not in lobby["members"]:
        return
    remaining = lb.leave(uid)
    if remaining and lb.only_bots(remaining):
        lb.purge(code)
        remaining = None
    if remaining:
        broadcast_lobby(remaining)
    else:
        gs.end(code)


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


def cosmetics_map(user_ids) -> dict:
    """{ user_id(str) -> {border_visual, signature, title} } pour les avatars.
    On envoie le VISUEL résolu de la bordure (params), pas juste son id."""
    out = {}
    for uid in user_ids:
        c = db.get_cosmetics(uid)
        out[str(uid)] = {
            "border_visual": profiles.visual_of(c["border"]),
            "signature": c["signature"],
            "title": profiles.title_name(c["title"]),
        }
    return out


def broadcast_lobby(lobby: dict) -> None:
    """Pousse l'état du lobby à tous ses membres (toutes leurs connexions)."""
    data = {"lobby": lb.serialize(lobby), "cosmetics": cosmetics_map(lobby["members"].keys())}
    for uid in lobby["members"]:
        emit_to_user("lobby_update", data, uid)


def _leave_current_lobby(uid: int) -> None:
    """Sort `uid` de son lobby actuel (s'il en a un) et prévient les restants."""
    lobby = lb.get(uid)
    if not lobby:
        return
    code = lobby["code"]
    remaining = lb.leave(uid)
    # S'il ne reste que des bots, la table meurt aussi (les bots ne jouent pas seuls).
    if remaining and lb.only_bots(remaining):
        lb.purge(code)
        remaining = None
    if remaining:
        broadcast_lobby(remaining)
    else:
        gs.end(code)  # lobby mort → la partie avec


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


@socketio.on("lobby_add_bot")
def ws_lobby_add_bot(_data=None):
    """Ajoute un bot à la table (admin + host uniquement, hors partie)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    if not is_admin(me):
        return {"error": "Réservé à l'admin."}
    lobby = lb.get(me["id"])
    if not lobby:
        return {"error": "Tu n'es pas dans un lobby."}
    if lobby["host_id"] != me["id"]:
        return {"error": "Seul l'hôte peut ajouter un bot."}
    if gs.get(lobby["code"]):
        return {"error": "Impossible pendant une partie."}
    if len(lobby["members"]) >= 12:
        return {"error": "La table est pleine."}
    bot = _acquire_bot_user()
    if not bot:
        return {"error": "Plus de bot disponible."}
    lb.add_bot(lobby["code"], bot)
    broadcast_lobby(lobby)
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


# ============================================================= jeux (WS)
# Le GameRunner (core/) pilote la partie ; ses deux callbacks deviennent
# ici des messages socket. public_view filtre l'info côté serveur : chaque
# joueur ne reçoit QUE sa vue. L'état complet ne voyage jamais.


def _game_callbacks(lobby_code: str):
    """Fabrique les callbacks on_event/on_sync du runner pour ce lobby."""

    def on_event(event):
        session = gs.get(lobby_code)
        if not session:
            return
        payload = {"type": event.type, "payload": event.payload}
        if event.to == "all":
            for uid in session["user_ids"]:
                emit_to_user("game_event", payload, uid)
        else:
            emit_to_user("game_event", payload, int(event.to))

    def on_sync(player_id, view):
        session = gs.get(lobby_code)
        cos = cosmetics_map(session["user_ids"]) if session else {}
        emit_to_user("game_view", {"view": view, "cosmetics": cos}, int(player_id))
        # Un membre bot n'a pas de socket : le serveur le fait jouer.
        if session and _is_bot(lobby_code, player_id):
            socketio.start_background_task(_bot_tick, lobby_code, str(player_id))

    return on_event, on_sync


def _is_bot(code: str, player_id) -> bool:
    lobby = lb.lobbies.get(code)
    if not lobby:
        return False
    member = lobby["members"].get(int(player_id))
    return bool(member and member.get("is_bot"))


def _bot_tick(code: str, pid: str) -> None:
    """Fait jouer un bot : petite latence naturelle, puis une action si besoin.
    Idempotent (rejoué à chaque sync) : ne fait rien s'il a déjà agi."""
    socketio.sleep(random.uniform(0.5, 1.4))
    session = gs.get(code)
    if not session:
        return
    game = session["runner"].game
    if game.is_over():
        return
    action = bots.decide(session["game_id"], game.public_view(pid), pid)
    if not action:
        return
    session["runner"].action(pid, action)
    if gs.maybe_record_stats(code):
        for uid in session["user_ids"]:
            emit_to_user("profile_stale", {}, uid)


BOT_NAMES = ["Robo", "Botina", "Zap", "Nova", "Pixel", "Gizmo", "Turbo", "Volt"]


def _acquire_bot_user() -> dict | None:
    """Un user bot pas déjà attablé ailleurs (les bots sont réutilisés)."""
    for name in BOT_NAMES:
        row = db.upsert_user({
            "id": f"bot-{name.lower()}",
            "username": f"{name.lower()}bot",
            "global_name": f"{name} 🤖",
            "avatar": None,
        })
        if row["id"] not in lb.user_lobby:
            return public_user(row)
    return None


@socketio.on("game_list")
def ws_game_list(_data=None):
    return {"games": gs.list_games()}


@socketio.on("game_start")
def ws_game_start(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    if not lobby:
        return {"error": "Tu n'es pas dans un lobby."}
    if lobby["host_id"] != me["id"]:
        return {"error": "Seul le host lance une partie."}
    game_id = str((data or {}).get("game_id", ""))
    config = (data or {}).get("config") or {}
    on_event, on_sync = _game_callbacks(lobby["code"])
    error = gs.start(lobby, game_id, config, on_event, on_sync)
    if error:
        return error
    return {"ok": True}


@socketio.on("game_action")
def ws_game_action(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    session = gs.get(lobby["code"]) if lobby else None
    if not session or me["id"] not in session["user_ids"]:
        return {"error": "Pas de partie en cours."}
    action = (data or {}).get("action") or {}
    # open_vote est réservé au host du lobby.
    if action.get("type") == "open_vote" and lobby["host_id"] != me["id"]:
        return {"error": "Seul le host peut ouvrir le vote."}
    session["runner"].action(str(me["id"]), action)
    # Partie qui vient de se terminer → on compte les stats une seule fois.
    if gs.maybe_record_stats(lobby["code"]):
        for uid in session["user_ids"]:
            emit_to_user("profile_stale", {}, uid)
    return {"ok": True}


@socketio.on("game_state")
def ws_game_state(_data=None):
    """Resync : la vue actuelle du joueur, ou null si pas de partie."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    if not lobby:
        return {"view": None}
    session = gs.get(lobby["code"])
    cos = cosmetics_map(session["user_ids"]) if session else {}
    return {"view": gs.view_for(lobby["code"], me["id"]), "cosmetics": cos}


@socketio.on("game_end")
def ws_game_end(_data=None):
    """Retour au lobby (host uniquement, une fois la partie finie ou pour abandonner)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    if not lobby:
        return {"error": "Tu n'es pas dans un lobby."}
    if lobby["host_id"] != me["id"]:
        return {"error": "Seul le host peut clore la partie."}
    session = gs.get(lobby["code"])
    if not session:
        return {"error": "Pas de partie en cours."}
    gs.end(lobby["code"])
    for uid in session["user_ids"]:
        emit_to_user("game_ended", {}, uid)
    return {"ok": True}


# ============================================================ profil (WS)


def build_profile(uid: int, is_me: bool) -> dict | None:
    """La vitrine d'un joueur : identité, stats, cosmétiques, historique."""
    urow = db.get_user_by_id(uid)
    if not urow:
        return None
    stats = db.get_stats(uid)
    cosmetics = db.get_cosmetics(uid)
    prof = profiles.full_profile(stats, cosmetics)
    prof["user"] = public_user(urow)
    prof["member_since"] = urow["created_at"]
    prof["online"] = uid in online
    prof["history"] = db.get_history(uid)
    prof["breakdown"] = db.game_breakdown(uid)
    prof["is_me"] = is_me
    return prof


def _can_view_profile(me_id: int, uid: int) -> bool:
    if uid == me_id:
        return True
    if uid in db.get_friend_ids(me_id):
        return True
    lobby = lb.get(me_id)  # co-membres d'une même table
    return bool(lobby and uid in lobby["members"])


@socketio.on("profile_get")
def ws_profile_get(_data=None):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    prof = build_profile(me["id"], is_me=True)
    prof["is_admin"] = is_admin(me)
    return {"profile": prof}


@socketio.on("profile_view")
def ws_profile_view(data):
    """La vitrine d'un AUTRE joueur (ami ou co-membre d'une table)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    uid = int((data or {}).get("user_id", 0))
    if not _can_view_profile(me["id"], uid):
        return {"error": "Ce profil n'est pas accessible."}
    prof = build_profile(uid, is_me=(uid == me["id"]))
    if not prof:
        return {"error": "Joueur introuvable."}
    return {"profile": prof}


@socketio.on("profile_set")
def ws_profile_set(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    slot = str((data or {}).get("slot", ""))
    value = str((data or {}).get("value", ""))

    if slot == "signature":
        # couleur libre parmi la palette proposée
        if not (value.startswith("#") and len(value) == 7):
            return {"error": "Couleur invalide."}
        db.set_cosmetic(me["id"], "signature", value)
    elif slot in ("title", "border", "effect"):
        stats = db.get_stats(me["id"])
        if not profiles.is_unlocked(slot, value, stats):
            return {"error": "Ce cosmétique n'est pas encore débloqué."}
        db.set_cosmetic(me["id"], slot, value)
    else:
        return {"error": "Slot inconnu."}

    cosmetics = db.get_cosmetics(me["id"])
    # Prévenir les tables où le user est présent (avatar/bordure à rafraîchir).
    lobby = lb.get(me["id"])
    if lobby:
        broadcast_lobby(lobby)
    return {"equipped": cosmetics}


# ==================================================== défis du jour (WS)
# Jeux SOLO asynchrones : pas de lobby, pas de GameRunner. Le défi du jour
# est figé en base (identique pour tous), la progression est sauvegardée,
# et une fois fini on voit le résultat de ses potes.

from games import dailies as dl  # noqa: E402


def _daily_payload(mod, day: str) -> dict:
    """Le défi figé du jour : on le crée à la première demande."""
    payload = db.daily_puzzle_get(mod.ID, day)
    if payload is None:
        db.daily_puzzle_put(mod.ID, day, mod.new_puzzle(day))
        payload = db.daily_puzzle_get(mod.ID, day) or mod.new_puzzle(day)
    return payload


@socketio.on("daily_list")
def ws_daily_list(_data=None):
    """La liste des défis du jour + mon avancement sur chacun."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    day = dl.today()
    friend_ids = db.get_friend_ids(me["id"])
    out = []
    for mod in dl.DAILIES.values():
        play = db.daily_play_get(me["id"], mod.ID, day)
        # qui a déjà joué aujourd'hui (moi + mes potes), pour la comparaison
        results = db.daily_results(mod.ID, day, [me["id"], *friend_ids])
        others = [r for r in results if r["id"] != me["id"]]
        my_rank = next((i + 1 for i, r in enumerate(results) if r["id"] == me["id"]), None)
        out.append({
            "id": mod.ID, "name": mod.NAME, "icon": mod.ICON, "desc": mod.DESC,
            "finished": play["finished"], "solved": play["solved"],
            "score": play["score"],
            "streak": db.daily_streak(me["id"], mod.ID, day),
            "friends_done": len(others),
            "friends": [
                {"display_name": public_user(r)["display_name"],
                 "avatar_url": public_user(r)["avatar_url"]}
                for r in others[:3]
            ],
            "my_rank": my_rank,
            "total_done": len(results),
        })
    return {"day": day, "dailies": out}


@socketio.on("daily_state")
def ws_daily_state(data):
    """Mon état actuel sur un défi (reprise de partie)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    mod = dl.get(str((data or {}).get("game", "")))
    if not mod:
        return {"error": "Défi inconnu."}
    day = dl.today()
    payload = _daily_payload(mod, day)
    play = db.daily_play_get(me["id"], mod.ID, day)
    return {"day": day, "state": mod.public(payload, play)}


@socketio.on("daily_guess")
def ws_daily_guess(data):
    """Joue un essai sur un défi du jour."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    mod = dl.get(str((data or {}).get("game", "")))
    if not mod:
        return {"error": "Défi inconnu."}
    day = dl.today()
    payload = _daily_payload(mod, day)
    play = db.daily_play_get(me["id"], mod.ID, day)
    error, new_play = mod.guess(payload, play, str((data or {}).get("text", "")))
    if error:
        return {"error": error, "state": mod.public(payload, play)}
    db.daily_play_put(me["id"], mod.ID, day, new_play["guesses"],
                      new_play["solved"], new_play["finished"], new_play["score"])
    # un défi qui vient de se terminer entre dans l'historique du profil
    if new_play["finished"] and not play["finished"]:
        final = mod.public(payload, new_play)
        db.record_history([{
            "user_id": me["id"], "game_id": mod.ID, "won": new_play["solved"],
            "detail": {
                "daily": True,
                "day": day,
                "tries": new_play["score"],
                "summary": {
                    "answer": final.get("answer"),
                    "url": final.get("url"),
                    # wordle stocke des chaînes, wikidle des dicts
                    "guesses": [g if isinstance(g, str) else g.get("word")
                                for g in new_play["guesses"]],
                },
            },
        }])
    return {"state": mod.public(payload, new_play),
            "streak": db.daily_streak(me["id"], mod.ID, day)}


@socketio.on("daily_scores")
def ws_daily_scores(data):
    """Les résultats du jour : moi + mes potes (parties terminées)."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    game = str((data or {}).get("game", ""))
    if not dl.get(game):
        return {"error": "Défi inconnu."}
    day = dl.today()
    ids = [me["id"], *db.get_friend_ids(me["id"])]
    rows = db.daily_results(game, day, ids)
    return {
        "day": day,
        "results": [
            {**public_user(r), "solved": bool(r["solved"]), "score": r["score"]}
            for r in rows
        ],
    }


# ========================================================== SKRIBBL (WS)
# Canal dédié au dessin.
#
# Un trait NE PEUT PAS passer par `game_action` : le GameRunner
# resynchronise TOUS les joueurs après chaque action, et chaque sync
# recalcule au passage la table des cosmétiques. À 20 traits/seconde
# et 8 joueurs, ça ferait 160 vues complètes par seconde pour dessiner
# une ligne. Ici on écrit le trait dans le tampon du jeu et on le
# rediffuse tel quel : rien d'autre ne bouge.

@socketio.on("skribbl_draw")
def ws_skribbl_draw(data):
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    lobby = lb.get(me["id"])
    session = gs.get(lobby["code"]) if lobby else None
    if not session or session["game_id"] != "skribbl":
        return {"error": "Pas de partie de dessin en cours."}

    game = session["runner"].game
    stroke = (data or {}).get("stroke") or {}
    # add_stroke refuse si l'émetteur n'est pas le dessinateur du moment :
    # c'est LA garantie qu'un joueur ne peut pas vandaliser la toile.
    if not game.add_stroke(str(me["id"]), stroke):
        return {"ok": False}

    for uid in session["user_ids"]:
        if uid != me["id"]:                   # l'auteur a déjà tracé chez lui
            emit_to_user("skribbl_stroke", stroke, uid)
    return {"ok": True}


# =========================================================== STAIRS (WS)
# Jeu d'arcade solo : on grimpe une tour aléatoire, 1 marche = 1 point.
#
# La simulation tourne sur le PC du joueur (impossible d'arbitrer du 60 fps
# depuis Railway). Le serveur ne fait donc pas confiance au score brut : il
# chronomètre lui-même la run entre `stairs_start` et `stairs_submit`, et
# refuse tout ce qui est humainement infaisable. Entre potes ça suffit.

import time as _time  # noqa: E402

#: token -> {user_id, started}. En mémoire : une run perdue au redéploiement
#: n'est pas grave, le joueur relance.
_stairs_open: dict[str, dict] = {}

# Seuil volontairement large : il doit bloquer un score fabriqué (« 99999
# marches en 2 s »), jamais un joueur très rapide. Mieux vaut laisser passer
# un tricheur discret que refuser le record légitime de quelqu'un.
STAIRS_MIN_MS_PER_STEP = 60     # ~16 marches/s, au-delà c'est un script
STAIRS_MAX_RUN_S = 3600         # une run ouverte depuis 1 h est périmée


def _stairs_boards(me_id: int) -> dict:
    ids = [me_id, *db.get_friend_ids(me_id)]
    return {
        scope: [
            {**public_user(r), "score": r["score"], "runs": r["runs"],
             "is_me": r["id"] == me_id}
            for r in db.stairs_board(ids, scope)
        ]
        for scope in ("day", "week", "all")
    }


@socketio.on("stairs_start")
def ws_stairs_start(_data=None):
    """Ouvre une run : le serveur note l'heure de départ et rend un jeton."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    now = _time.time()
    # ménage des runs abandonnées
    for tok in [t for t, r in _stairs_open.items() if now - r["started"] > STAIRS_MAX_RUN_S]:
        _stairs_open.pop(tok, None)
    token = secrets.token_urlsafe(12)
    _stairs_open[token] = {"user_id": me["id"], "started": now}
    return {"token": token}


@socketio.on("stairs_submit")
def ws_stairs_submit(data):
    """Clôt une run et l'enregistre si le score est plausible."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    d = data or {}
    run = _stairs_open.pop(str(d.get("token", "")), None)
    if not run or run["user_id"] != me["id"]:
        return {"error": "Run inconnue — relance une partie."}

    score = max(0, int(d.get("score", 0)))
    coins = max(0, int(d.get("coins", 0)))
    elapsed_ms = int((_time.time() - run["started"]) * 1000)

    # plausibilité : le temps mesuré PAR LE SERVEUR doit tenir la route
    if score and elapsed_ms < score * STAIRS_MIN_MS_PER_STEP:
        return {"error": "Score refusé : trop rapide pour être vrai."}
    # les gemmes ne tombent que sur une marche sur quelques-unes
    coins = min(coins, score // 3 + 5)

    db.stairs_record(me["id"], score, coins, elapsed_ms)
    db.record_history([{
        "user_id": me["id"], "game_id": "stairs", "won": False,
        "detail": {
            "score": score, "solo": True,
            "summary": {"score": score, "coins": coins,
                        "duration_ms": elapsed_ms},
        },
    }])
    return {
        "score": score, "coins": coins, "duration_ms": elapsed_ms,
        "personal": db.stairs_personal(me["id"]),
        "boards": _stairs_boards(me["id"]),
    }


@socketio.on("stairs_home")
def ws_stairs_home(_data=None):
    """Records perso + les trois classements, pour l'écran d'accueil du jeu."""
    me = current_user()
    if not me:
        return {"error": "non authentifié"}
    return {
        "personal": db.stairs_personal(me["id"]),
        "boards": _stairs_boards(me["id"]),
    }


# ============================================================ admin (WS)
# Back-office : gestion du catalogue de cosmétiques. Réservé aux admins.

import json as _json  # noqa: E402

VALID_SLOTS = ("title", "border", "effect")


@socketio.on("admin_meta")
def ws_admin_meta(_data=None):
    """Vocabulaire pour l'éditeur admin (stats, styles, moteurs)."""
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    return {
        "stats": profiles.KNOWN_STATS,
        "border_styles": profiles.BORDER_STYLES,
        "effect_engines": profiles.EFFECT_ENGINES,
        "color_modes": profiles.COLOR_MODES,
    }


@socketio.on("admin_catalog")
def ws_admin_catalog(_data=None):
    """Catalogue complet (y compris désactivés) pour l'admin."""
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    return {"catalog": db.catalog_all(include_disabled=True)}


@socketio.on("admin_catalog_save")
def ws_admin_catalog_save(data):
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    item = (data or {}).get("item") or {}
    item_id = str(item.get("id", "")).strip().lower()
    if not item_id or not item_id.replace("-", "").replace("_", "").isalnum():
        return {"error": "id invalide (lettres/chiffres/-/_ uniquement)"}
    if item.get("slot") not in VALID_SLOTS:
        return {"error": "type invalide"}
    if not str(item.get("name", "")).strip():
        return {"error": "nom requis"}

    # visual : accepte un dict → on le sérialise en JSON pour la DB
    visual = item.get("visual")
    if isinstance(visual, (dict, list)):
        visual = _json.dumps(visual)

    db.catalog_upsert({
        "id": item_id,
        "slot": item["slot"],
        "name": str(item["name"]).strip(),
        "sub": str(item.get("sub", "")).strip(),
        "locked_sub": str(item.get("locked_sub", "")).strip(),
        "cond_stat": item.get("cond_stat") or None,
        "cond_value": int(item.get("cond_value") or 0),
        "visual": visual,
        "sort_order": int(item.get("sort_order") or 0),
        "enabled": bool(item.get("enabled", True)),
    })
    return {"ok": True, "catalog": db.catalog_all(include_disabled=True)}


@socketio.on("admin_catalog_delete")
def ws_admin_catalog_delete(data):
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    item_id = str((data or {}).get("id", ""))
    if item_id in profiles.DEFAULTS.values():
        return {"error": "Impossible de supprimer un cosmétique par défaut."}
    db.catalog_delete(item_id)
    return {"ok": True, "catalog": db.catalog_all(include_disabled=True)}


# ---- Banque de questions du Quiz (admin) ----

VALID_QTYPES = ("text", "image", "audio", "images", "flag", "timeline", "petitbac")


@socketio.on("admin_quiz_list")
def ws_admin_quiz_list(_data=None):
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    return {"questions": db.quiz_all()}


@socketio.on("admin_quiz_save")
def ws_admin_quiz_save(data):
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    item = (data or {}).get("item") or {}
    cat = str(item.get("category", "")).strip()
    ans = str(item.get("answer", "")).strip()
    qtype = item.get("type", "text")
    question = str(item.get("question", "")).strip()
    media = item.get("media") or ""
    if qtype not in VALID_QTYPES:
        return {"error": "type invalide"}
    if not cat:
        return {"error": "catégorie requise"}
    if qtype != "petitbac" and not ans:
        return {"error": "réponse requise"}
    if qtype == "petitbac":
        m = media if isinstance(media, dict) else {}
        if not m.get("categories"):
            return {"error": "au moins une catégorie requise"}
    elif not question and not media:
        return {"error": "texte de question ou média requis"}
    alts = item.get("alt_answers", [])
    if isinstance(alts, str):
        alts = [a.strip() for a in alts.split(",") if a.strip()]
    db.quiz_upsert({
        "id": item.get("id"),
        "category": cat,
        "question": question,
        "answer": ans,
        "type": qtype,
        "media": media,
        "alt_answers": alts,
        "auto": bool(item.get("auto")),
        "enabled": bool(item.get("enabled", True)),
    })
    return {"ok": True, "questions": db.quiz_all()}


@socketio.on("admin_quiz_delete")
def ws_admin_quiz_delete(data):
    me = current_user()
    if not is_admin(me):
        return {"error": "réservé aux admins"}
    qid = (data or {}).get("id")
    if qid:
        db.quiz_delete(int(qid))
    return {"ok": True, "questions": db.quiz_all()}


if __name__ == "__main__":
    # Dev local uniquement (la prod passe par gunicorn, cf. Procfile).
    socketio.run(app, host="127.0.0.1", port=8787, debug=True)
