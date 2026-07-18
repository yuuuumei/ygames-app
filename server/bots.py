"""Cerveau des bots serveur-side.

Un bot est un membre du lobby sans socket : le serveur le fait jouer en
appelant `decide(...)` après chaque changement d'état, à partir de SA vue
filtrée (la même que celle d'un vrai joueur). `decide` renvoie une action
(dict) à jouer, ou None s'il n'a rien à faire pour l'instant.

Volontairement idempotent : tant que le bot a déjà agi pour l'état courant,
il renvoie None (évite les actions en double).
"""

import random

CLUE_WORDS = ["truc", "machin", "vibe", "genre", "style", "concept", "délire"]
QUIZ_ANSWERS = ["42", "Paris", "Napoléon", "je sais pas", "le chat", "1789",
                "bleu", "Zidane", "au pif", "banane", "l'amour", "Google"]


def decide(game_id: str, view: dict, pid: str) -> dict | None:
    """Décide l'action du bot `pid` d'après sa vue. None = rien à faire."""
    if game_id == "quiz":
        return _quiz(view, pid)
    if game_id == "impostor":
        return _impostor(view, pid)
    # Jeux sans IA de bot : le bot reste spectateur.
    return None


def _quiz(view: dict, pid: str) -> dict | None:
    phase = view.get("phase")
    if phase == "answering" and view.get("question"):
        # répond une seule fois par question (your_answer se remplit ensuite)
        if view.get("your_answer") is None:
            idx = view["question"]["number"] - 1
            return {"type": "answer", "index": idx, "text": random.choice(QUIZ_ANSWERS)}
    elif phase == "correcting":
        # vote-doute en cours : le bot vote oui/non (majorité bienveillante)
        vote = (view.get("correction") or {}).get("vote")
        if vote and vote.get("your_vote") is None:
            return {"type": "doubt_vote", "yes": random.random() < 0.65}
    # La correction (révélation/notation) est pilotée par l'hôte humain.
    return None


def _impostor(view: dict, pid: str) -> dict | None:
    phase = view.get("phase")
    me = next((p for p in view.get("players", []) if p["id"] == pid), None)
    if not me:
        return None
    if phase == "clues":
        if view.get("current_turn_id") == pid and not me.get("has_clue"):
            return {"type": "clue", "text": random.choice(CLUE_WORDS)}
    elif phase == "vote":
        if not me.get("has_voted"):
            others = [p for p in view["players"] if p["id"] != pid]
            if others:
                return {"type": "vote", "target": random.choice(others)["id"]}
    return None
