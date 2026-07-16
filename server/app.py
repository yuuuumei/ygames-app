"""Serveur yGAMES — Phase 1 : authentification Discord.

Flow :
1. Le client Tauri obtient un `code` OAuth via le navigateur (loopback).
2. Il POST ce code ici (/auth/discord).
3. NOUS (et personne d'autre) l'échangeons contre un access token Discord,
   grâce au client_secret qui ne vit que dans le .env de ce serveur.
4. On récupère l'identité (/users/@me), on upsert le user en SQLite,
   et on renvoie un token de session MAISON au client.
5. Ensuite le client ne parle plus jamais à Discord : il présente son
   token maison (header Authorization: Bearer ...).
"""

import os
import secrets

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()  # charge server/.env

import db  # noqa: E402  (après load_dotenv pour que DATABASE_PATH soit lu)

DISCORD_API = "https://discord.com/api/v10"
CLIENT_ID = os.environ["DISCORD_CLIENT_ID"]
CLIENT_SECRET = os.environ["DISCORD_CLIENT_SECRET"]

app = Flask(__name__)
db.init_db()


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8787, debug=True)
