# ============================================================
#  demo_impostor.py — Phase 0 : une partie complète d'Imposteur
#  qui se joue dans le terminal, SANS réseau ni UI.
#
#  But : prouver que le contrat marche, et surtout VOIR l'info
#  cachée en action — chaque joueur ne voit que SON mot, et
#  personne n'est jamais désigné comme "l'imposteur" avant la fin.
#
#  Lancer :  python demo_impostor.py
# ============================================================
from __future__ import annotations

import sys

# Console Windows : forcer l'UTF-8 pour afficher les emoji.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from core.contract import Player
from core.runner import GameRunner
from core.registry import get
import games.impostor.game  # noqa: F401  (enregistre le jeu dans le registre)


def rule(title: str = "") -> None:
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def show_all_views(runner: GameRunner) -> None:
    """Affiche ce que voit CHAQUE joueur — la preuve de l'info cachée."""
    for pid, p in runner.players.items():
        v = runner.game.public_view(pid)
        extra = ""
        if v["phase"] == "clues":
            extra = f"  (au tour de : {v['current_turn']})"
        print(f"  📱 {p.avatar} {p.name:<8} voit son mot → "
              f"« {v['your_word']} »{extra}")


def main() -> None:
    players = [
        Player("tok_lucas", "Lucas", "🦊"),
        Player("tok_marie", "Marie", "🐱"),
        Player("tok_theo",  "Théo",  "🐻"),
        Player("tok_sara",  "Sara",  "🦉"),
    ]

    # Le core instancie le jeu depuis le registre — il ne connaît
    # pas "ImpostorGame", juste son id "impostor".
    GameCls = get("impostor")

    # Callbacks : en Phase 0 on imprime. En Phase 3, ce sera du WebSocket.
    def on_event(e):
        print(f"     ⚡ {e.type} {e.payload if e.payload else ''}")

    runner = GameRunner(GameCls(), players, on_event=on_event)

    rule("DÉMARRAGE DE LA PARTIE")
    runner.start(config={"category": "instruments", "n_impostors": 1})

    rule("CE QUE VOIT CHAQUE JOUEUR (info cachée en action)")
    print("  Remarque : personne ne sait qui est l'imposteur.")
    print("  Un seul joueur a un mot différent... saura-t-il que c'est lui ?\n")
    show_all_views(runner)

    rule("TOUR DE TABLE — chacun donne un indice")
    scripted = {
        "tok_lucas": "un truc à cordes",
        "tok_marie": "on en joue assis",
        "tok_theo":  "il y a des touches",
        "tok_sara":  "c'est encombrant",
    }
    # on suit l'ordre de jeu tiré au hasard par le jeu
    for pid in runner.game.turn_order:
        runner.action(pid, {"type": "clue", "text": scripted[pid]})

    rule("OUVERTURE DES VOTES (action de l'host)")
    runner.action("tok_lucas", {"type": "open_vote"})

    rule("LES VOTES TOMBENT")
    # tout le monde soupçonne le vrai imposteur (pour la démo)
    impostor = next(iter(runner.game.impostor_ids))
    for pid in runner.players:
        # chaque joueur vote pour l'imposteur (sauf l'imposteur qui vote au pif)
        target = impostor if pid != impostor else "tok_lucas"
        over = runner.action(pid, {"type": "vote", "target": target})

    rule("RÉVÉLATION")
    reveal = runner.game.public_view("tok_lucas")["reveal"]
    print(f"  Mot principal  : {reveal['word_main']}")
    print(f"  Mot imposteur  : {reveal['word_impostor']}")
    print(f"  Imposteur(s)   : {', '.join(reveal['impostors'])}")
    print(f"  Votes          : {reveal['votes']}")
    print(f"  🏆 Gagnants    : {', '.join(reveal['winners'])}")
    print(f"\n  Partie terminée ? {runner.game.is_over()}")


if __name__ == "__main__":
    main()
