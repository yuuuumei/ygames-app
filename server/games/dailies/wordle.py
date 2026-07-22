"""Wordle du jour (français, 5 lettres, 6 essais).

Le mot du jour est tiré de façon déterministe à partir de la date : tout le
monde a le même mot, et il reste stable si le serveur redémarre.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata

from games.dailies.words_fr import WORDS_5

ID = "wordle"
NAME = "Le Mot du jour"
ICON = "🔤"
DESC = "Trouve le mot de 5 lettres en 6 essais."
MAX_TRIES = 6
LENGTH = 5

_DICT = set(WORDS_5)


def normalize(s: str) -> str:
    """Majuscules, sans accents, lettres seulement."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Za-z]", "", s).upper()


def new_puzzle(day: str) -> dict:
    """Mot du jour : déterministe à partir de la date."""
    h = hashlib.sha256(f"wordle:{day}".encode()).hexdigest()
    return {"word": WORDS_5[int(h, 16) % len(WORDS_5)]}


def score_guess(guess: str, word: str) -> list[str]:
    """Feedback façon Wordle : correct / present / absent (gère les doublons)."""
    res = ["absent"] * len(guess)
    rest = list(word)
    for i, c in enumerate(guess):          # 1) bien placées
        if i < len(word) and c == word[i]:
            res[i] = "correct"
            rest[i] = None
    for i, c in enumerate(guess):          # 2) présentes ailleurs
        if res[i] == "correct":
            continue
        if c in rest:
            res[i] = "present"
            rest[rest.index(c)] = None
    return res


def public(payload: dict, play: dict) -> dict:
    """Ce que le client voit. Le mot secret n'est révélé qu'une fois fini."""
    rows = [
        {"word": g, "score": score_guess(g, payload["word"])}
        for g in play["guesses"]
    ]
    return {
        "id": ID, "name": NAME, "icon": ICON, "desc": DESC,
        "length": LENGTH, "max_tries": MAX_TRIES,
        "rows": rows,
        "solved": play["solved"],
        "finished": play["finished"],
        "tries_left": max(0, MAX_TRIES - len(play["guesses"])),
        "answer": payload["word"] if play["finished"] else None,
    }


def guess(payload: dict, play: dict, text: str) -> tuple[str | None, dict]:
    """Joue un essai. Renvoie (erreur|None, nouvelle partie)."""
    if play["finished"]:
        return "Défi déjà terminé pour aujourd'hui.", play
    g = normalize(text)
    if len(g) != LENGTH:
        return f"Le mot doit faire {LENGTH} lettres.", play
    if g not in _DICT:
        return "Ce mot n'est pas dans le dictionnaire.", play

    guesses = [*play["guesses"], g]
    solved = g == payload["word"]
    finished = solved or len(guesses) >= MAX_TRIES
    return None, {
        "guesses": guesses,
        "solved": solved,
        "finished": finished,
        # score = nb d'essais utilisés (plus c'est bas, mieux c'est)
        "score": len(guesses),
    }
