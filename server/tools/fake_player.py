"""Faux joueur pour tester la présence en local.

Crée (ou réutilise) un utilisateur factice en base, lui forge une session,
puis connecte un client Socket.IO authentifié — exactement comme le ferait
l'app Tauri. Affiche les événements de présence reçus.

Usage :  python tools/fake_player.py [nom]  (depuis le dossier server/)
Ctrl+C pour déconnecter le faux joueur.
"""

import sys
import secrets
import time

sys.path.insert(0, ".")  # pour importer db.py depuis server/

import socketio  # python-socketio (client)

import db

sys.stdout.reconfigure(encoding="utf-8")

SERVER = "http://127.0.0.1:8787"


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "TestBot"

    # Un user factice avec un discord_id impossible à confondre avec un vrai.
    fake_discord_user = {
        "id": f"fake-{name.lower()}",
        "username": name.lower(),
        "global_name": name,
        "avatar": None,
    }
    db.init_db()
    user = db.upsert_user(fake_discord_user)
    token = secrets.token_urlsafe(32)
    db.create_session(user["id"], token)
    print(f"🤖 {name} : user #{user['id']}, session forgée")

    sio = socketio.Client()

    @sio.event
    def connect():
        print(f"🟢 {name} connecté au serveur")

    @sio.event
    def disconnect():
        print(f"🔴 {name} déconnecté")

    @sio.on("presence_snapshot")
    def on_snapshot(data):
        names = ", ".join(u["display_name"] for u in data["users"])
        print(f"📋 snapshot : {len(data['users'])} en ligne → {names}")

    @sio.on("presence")
    def on_presence(data):
        state = "arrive" if data["online"] else "part"
        print(f"👤 {data['user']['display_name']} {state}")

    sio.connect(SERVER, auth={"token": token})
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sio.disconnect()


if __name__ == "__main__":
    main()
