"""Faux joueur pour tester présence + friendlist en local.

Crée (ou réutilise) un utilisateur factice en base, lui forge une session,
puis connecte un client Socket.IO authentifié — exactement comme le ferait
l'app Tauri.

Usage (depuis server/) :
    python tools/fake_player.py Alice
    python tools/fake_player.py Alice --add itsyuumei   # envoie une demande d'ami
Le faux joueur ACCEPTE automatiquement toute demande d'ami reçue.
Ctrl+C pour le déconnecter.
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
    args = sys.argv[1:]
    name = args[0] if args else "TestBot"
    add_target = args[args.index("--add") + 1] if "--add" in args else None

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
    print(f"🤖 {name} : user #{user['id']} (pseudo « {name.lower()} »), session forgée")

    sio = socketio.Client()

    def show_friends(resp):
        friends = ", ".join(
            f"{f['display_name']}{'🟢' if f.get('online') else '⚫'}"
            for f in resp.get("friends", [])
        )
        print(f"👥 amis : {friends or '(aucun)'}")
        # Auto-accepte toute demande reçue.
        for u in resp.get("incoming", []):
            print(f"🤝 demande de {u['display_name']} → j'accepte")
            sio.emit("friend_accept", {"user_id": u["id"]})

    @sio.event
    def connect():
        print(f"🟢 {name} connecté")
        if add_target:
            def on_add(resp):
                msg = resp.get("error") or (
                    "acceptée direct !" if resp.get("auto_accepted") else "envoyée."
                )
                print(f"📨 demande d'ami vers {add_target} : {msg}")
            sio.emit("friend_request", {"username": add_target}, callback=on_add)
        sio.emit("friends", callback=show_friends)

    @sio.on("friends_changed")
    def on_friends_changed(_=None):
        sio.emit("friends", callback=show_friends)

    @sio.on("presence")
    def on_presence(data):
        state = "en ligne" if data["online"] else "hors ligne"
        print(f"👤 ami {data['user']['display_name']} passe {state}")

    @sio.event
    def disconnect():
        print(f"🔴 {name} déconnecté")

    sio.connect(SERVER, auth={"token": token})
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        sio.disconnect()


if __name__ == "__main__":
    main()
