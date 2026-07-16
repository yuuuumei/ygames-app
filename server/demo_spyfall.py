# ============================================================
#  demo_spyfall.py — Phase 0 : Spyfall dans le terminal.
#
#  Prouve que le MÊME contrat encaisse une info cachée inversée
#  (l'espion sait moins mais connaît son rôle) et un 2e chemin
#  de victoire (l'espion devine le lieu).
#
#  Lancer :  python demo_spyfall.py
# ============================================================
from __future__ import annotations

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from core.contract import Player
from core.runner import GameRunner
from core.registry import get
import games.spyfall.game  # noqa: F401  (enregistre le jeu)


def rule(title: str = "") -> None:
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def show_all_views(runner: GameRunner) -> None:
    for pid, p in runner.players.items():
        v = runner.game.public_view(pid)
        if v["you_are_spy"]:
            print(f"  📱 {p.avatar} {p.name:<8} → 🕵️  ESPION "
                  f"(aucun lieu, aucun rôle)")
        else:
            print(f"  📱 {p.avatar} {p.name:<8} → lieu « {v['location']} », "
                  f"rôle « {v['your_role']} »")


def new_players():
    return [
        Player("tok_lucas", "Lucas", "🦊"),
        Player("tok_marie", "Marie", "🐱"),
        Player("tok_theo",  "Théo",  "🐻"),
        Player("tok_sara",  "Sara",  "🦉"),
    ]


def on_event(e):
    print(f"     ⚡ {e.type} {e.payload if e.payload else ''}")


def print_reveal(runner):
    # on lit la vue d'un innocent (l'espion aussi voit tout une fois fini)
    reveal = runner.game.public_view("tok_lucas")["reveal"]
    print(f"  Lieu         : {reveal['location']}")
    print(f"  Espion(s)    : {', '.join(reveal['spies'])}")
    print(f"  Raison       : {reveal['reason']}")
    print(f"  🏆 Gagnants  : {', '.join(reveal['winners'])}")


# ------------------------------------------------------------
#  SCÉNARIO 1 — les innocents démasquent l'espion au vote
# ------------------------------------------------------------
def scenario_vote():
    rule("SCÉNARIO 1 — les innocents démasquent l'espion")
    runner = GameRunner(get("spyfall")(), new_players(), on_event=on_event)
    runner.start(config={"n_spies": 1})

    print("\n  Ce que voit chaque joueur (info cachée inversée) :\n")
    show_all_views(runner)

    print("\n  Tour de questions...")
    clues = {"tok_lucas": "j'y vais souvent le week-end",
             "tok_marie": "il faut faire attention au bruit",
             "tok_theo":  "on y croise du monde",
             "tok_sara":  "euh... c'est sympa l'ambiance"}
    for pid in runner.game.turn_order:
        runner.action(pid, {"type": "clue", "text": clues[pid]})

    runner.action("tok_lucas", {"type": "open_vote"})

    spy = next(iter(runner.game.spy_ids))
    for pid in runner.players:
        target = spy if pid != spy else "tok_lucas"
        runner.action(pid, {"type": "vote", "target": target})

    print()
    print_reveal(runner)


# ------------------------------------------------------------
#  SCÉNARIO 2 — l'espion devine le lieu et gagne d'un coup
# ------------------------------------------------------------
def scenario_spy_guess():
    rule("SCÉNARIO 2 — l'espion devine le lieu")
    runner = GameRunner(get("spyfall")(), new_players(), on_event=on_event)
    runner.start(config={"n_spies": 1})

    spy = next(iter(runner.game.spy_ids))
    true_location = runner.game.location  # (le core "triche" juste pour la démo)
    print(f"\n  L'espion est {runner.players[spy].name}. Il tente le lieu...")
    runner.action(spy, {"type": "guess_location", "location": true_location})

    print()
    print_reveal(runner)


if __name__ == "__main__":
    scenario_vote()
    scenario_spy_guess()
