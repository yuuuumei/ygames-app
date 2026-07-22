"""Défis du jour : jeux SOLO asynchrones (hors lobby / GameRunner).

Chaque module de daily expose la même interface :
    ID, NAME, ICON, DESC
    new_puzzle(day)            -> payload figé du jour (dict)
    public(payload, play)      -> ce que le client voit
    guess(payload, play, text) -> (erreur|None, nouvelle partie)

Le socle (db + app.py) ne connaît que cette interface : ajouter un daily =
écrire un module et l'ajouter à DAILIES.
"""
from datetime import date, timezone, datetime

from games.dailies import wordle, wikidle

DAILIES = {m.ID: m for m in (wordle, wikidle)}


def today() -> str:
    """La date du jour en UTC (même défi pour tout le monde, bascule à minuit UTC)."""
    return datetime.now(timezone.utc).date().isoformat()


def get(game_id: str):
    return DAILIES.get(game_id)


def meta_list() -> list[dict]:
    return [
        {"id": m.ID, "name": m.NAME, "icon": m.ICON, "desc": m.DESC}
        for m in DAILIES.values()
    ]


__all__ = ["DAILIES", "today", "get", "meta_list", "date"]
