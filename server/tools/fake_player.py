"""Faux joueur pour tester présence + friendlist en local.

Crée (ou réutilise) un utilisateur factice en base, lui forge une session,
puis connecte un client Socket.IO authentifié — exactement comme le ferait
l'app Tauri.

Usage (depuis server/) :
    python tools/fake_player.py Alice
    python tools/fake_player.py Alice --add itsyuumei   # demande d'ami
    python tools/fake_player.py Alice --join 4F2K       # rejoint un lobby
Le faux joueur ACCEPTE automatiquement les demandes d'ami ET les
invitations de lobby, et dit bonjour dans le chat en arrivant.
Ctrl+C pour le déconnecter.
"""

import random
import sys
import secrets
import time

sys.path.insert(0, ".")  # pour importer db.py depuis server/

import socketio  # python-socketio (client)

import db

CLUE_WORDS = ["truc", "machin", "vibe", "genre", "style", "concept", "délire"]
QUIZ_ANSWERS = ["42", "Paris", "Napoléon", "je sais pas", "le chat", "1789",
                "bleu", "Zidane", "au pif", "banane"]

sys.stdout.reconfigure(encoding="utf-8")

SERVER = "http://127.0.0.1:8787"


def main() -> None:
    args = sys.argv[1:]
    name = args[0] if args else "TestBot"
    add_target = args[args.index("--add") + 1] if "--add" in args else None
    join_code = args[args.index("--join") + 1] if "--join" in args else None
    create_lobby = "--create" in args
    # --start impostor 3 : lance L'Imposteur dès que 3 joueurs sont là (host)
    start_game = args[args.index("--start") + 1] if "--start" in args else None
    start_when = int(args[args.index("--start") + 2]) if "--start" in args else 3
    game_started = {"done": False}

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

    def join_lobby(code):
        def on_join(resp):
            if resp.get("error"):
                print(f"🚪 impossible de rejoindre {code} : {resp['error']}")
            else:
                members = ", ".join(
                    m["display_name"] for m in resp["lobby"]["members"]
                )
                print(f"🚪 dans le lobby {resp['lobby']['code']} avec : {members}")
                sio.emit("lobby_chat", {"text": f"Salut, c'est {name} ! 🤖"})
        sio.emit("lobby_join", {"code": code}, callback=on_join)

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
        if join_code:
            join_lobby(join_code)
        if create_lobby:
            def on_create(resp):
                print(f"🏗️ lobby créé : CODE={resp['lobby']['code']}")
            # {} explicite : c'est ce que l'UI envoie (même chemin de code).
            sio.emit("lobby_create", {}, callback=on_create)
        sio.emit("friends", callback=show_friends)

    @sio.on("lobby_invited")
    def on_invited(data):
        print(f"💌 {data['from']['display_name']} m'invite dans {data['code']} → j'y vais")
        join_lobby(data["code"])

    @sio.on("lobby_update")
    def on_lobby_update(data):
        members = ", ".join(
            f"{m['display_name']}{'👑' if m['id'] == data['lobby']['host_id'] else ''}{'' if m['connected'] else '💤'}"
            for m in data["lobby"]["members"]
        )
        print(f"🏠 lobby {data['lobby']['code']} : {members}")
        # Host bot : lance le jeu quand il y a assez de monde.
        if (start_game and not game_started["done"]
                and len(data["lobby"]["members"]) >= start_when):
            game_started["done"] = True
            def on_start(resp):
                print(f"🎲 lancement de {start_game} : {resp.get('error', 'OK !')}")
            print(f"🎲 {start_when} joueurs présents → je lance {start_game}")
            sio.emit("game_start", {"game_id": start_game, "config": {}},
                     callback=on_start)

    # ------- le bot joue ! -------
    my_pid = {"v": None}
    quiz_graded = set()  # index de correction déjà traités (bot hôte)

    @sio.on("game_view")
    def on_game_view(data):
        view = data["view"]
        pid = my_pid["v"] = str(user["id"])
        phase = view["phase"]

        # ---- Quiz Culture ----
        if view.get("game") == "quiz":
            if phase == "answering" and view.get("question"):
                if view.get("your_answer") is None:
                    idx = view["question"]["number"] - 1
                    ans = random.choice(QUIZ_ANSWERS)
                    print(f"✍️ Q{idx + 1} → je réponds « {ans} »")
                    sio.emit("game_action",
                             {"action": {"type": "answer", "index": idx, "text": ans}})
            elif phase == "correcting" and view.get("is_host"):
                # bot hôte (test auto) : corrige au pif puis avance, 1x par question
                c = view["correction"]
                idx = c["number"] - 1
                if idx not in quiz_graded:
                    quiz_graded.add(idx)
                    for e in c["entries"]:
                        if e["answer"] and e["grade"] is None:
                            sio.emit("game_action", {"action": {
                                "type": "grade", "index": idx,
                                "player_id": e["id"], "correct": random.random() < 0.6}})
                    sio.emit("game_action", {"action": {"type": "next_correction"}})
            elif phase == "over" and view.get("ranking"):
                top = view["ranking"][0]
                print(f"🏁 quiz fini ! 1er : {top['name']} ({top['score']} pts)")
            return

        if phase == "clues":
            me_in_game = next(p for p in view["players"] if p["id"] == pid)
            if view.get("current_turn_id") == pid and not me_in_game["has_clue"]:
                clue = random.choice(CLUE_WORDS)
                print(f"💡 mon mot est « {view['your_word']} », mon tour → indice : {clue}")
                sio.emit("game_action", {"action": {"type": "clue", "text": clue}})
            # Host : tout le monde a parlé → ouvre le vote.
            elif start_game and all(p["has_clue"] or not p["connected"]
                                    for p in view["players"]):
                print("🗳️ tous les indices sont là → j'ouvre le vote")
                sio.emit("game_action", {"action": {"type": "open_vote"}})

        elif phase == "vote":
            me_in_game = next(p for p in view["players"] if p["id"] == pid)
            if not me_in_game["has_voted"]:
                target = random.choice(
                    [p for p in view["players"] if p["id"] != pid])
                print(f"🗳️ je vote contre {target['name']}")
                sio.emit("game_action",
                         {"action": {"type": "vote", "target": target["id"]}})

        elif phase == "over" and view.get("reveal"):
            r = view["reveal"]
            print(f"🏁 fini ! imposteur(s) : {', '.join(r['impostors'])} | "
                  f"mots : {r['word_main']} vs {r['word_impostor']} | "
                  f"gagnants : {', '.join(r['winners'])}")

    @sio.on("game_ended")
    def on_game_ended(_=None):
        print("↩️ retour au lobby")

    @sio.on("lobby_chat")
    def on_chat(msg):
        print(f"💬 {msg['from']['display_name']} : {msg['text']}")

    @sio.on("lobby_kicked")
    def on_kicked(_=None):
        print("👢 je me suis fait exclure du lobby !")

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
