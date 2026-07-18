"""Catalogue des cosmétiques (data-driven, géré depuis le back-office admin)
et logique de déblocage.

Le CLIENT ne décide jamais si un cosmétique est débloqué : c'est calculé ici
à partir des stats. Les visuels (bordure/effet) sont des PARAMÈTRES stockés en
base — l'admin peut en créer de nouveaux sans recoder, tant qu'ils réutilisent
un moteur de rendu connu du client.
"""

import json

import db

# Stats sur lesquelles une condition de déblocage peut porter.
KNOWN_STATS = {
    "games_played": "Parties jouées",
    "wins": "Victoires",
    "impostor_games": "Parties en imposteur",
    "impostor_wins": "Victoires en imposteur",
    "correct_votes": "Votes justes",
    "wins_without_clue": "Victoires sans indice",
    "wrong_vote_streak": "Votes ratés d'affilée",
    "games_hosted": "Tables hébergées",
}

# Moteurs de rendu connus du client (pour l'éditeur admin).
BORDER_STYLES = ["ring", "dashed", "conic"]
EFFECT_ENGINES = ["confetti", "rings", "sweep", "glitch", "rain"]
COLOR_MODES = ["signature", "fixed", "gold", "multi"]

# valeurs par défaut équipées (doivent exister & être gratuites dans le seed)
DEFAULTS = {"title": "nouveau", "border": "neon", "effect": "confettis"}


# --------------------------------------------------------------- seed initial

def _seed_rows() -> list[dict]:
    def v(d):
        return json.dumps(d)

    return [
        # --- titres (pas de visuel) ---
        {"id": "nouveau", "slot": "title", "name": "Nouveau venu", "sub": "Bienvenue dans la bande", "cond_stat": None},
        {"id": "cameleon", "slot": "title", "name": "Le Caméléon", "sub": "Gagne en imposteur sans être démasqué", "cond_stat": "impostor_wins", "cond_value": 1, "locked_sub": "Gagne 1 partie en imposteur"},
        {"id": "limier", "slot": "title", "name": "Fin limier", "sub": "5 imposteurs votés juste", "cond_stat": "correct_votes", "cond_value": 5, "locked_sub": "Vote juste 5 fois"},
        {"id": "meneur", "slot": "title", "name": "Meneur de la bande", "sub": "Hôte de 20 tables", "cond_stat": "games_hosted", "cond_value": 20, "locked_sub": "Héberge 20 parties"},
        {"id": "boulet", "slot": "title", "name": "Boulet de la soirée", "sub": "Voté à tort 3× de suite", "cond_stat": "wrong_vote_streak", "cond_value": 3, "locked_sub": "3 votes ratés d'affilée"},
        {"id": "fantome", "slot": "title", "name": "Le Fantôme", "sub": "Gagne sans donner d'indice", "cond_stat": "wins_without_clue", "cond_value": 1, "locked_sub": "Gagne sans donner d'indice"},
        {"id": "legende", "slot": "title", "name": "Légende yGAMES", "sub": "100 parties jouées", "cond_stat": "games_played", "cond_value": 100, "locked_sub": "Joue 100 parties"},
        # --- bordures (visuel paramétré) ---
        {"id": "sobre", "slot": "border", "name": "Sobre", "sub": "Liseré discret", "cond_stat": None,
         "visual": v({"style": "ring", "colorMode": "fixed", "color": "#3a4152", "thickness": 0.03, "glow": 0, "spin": False})},
        {"id": "neon", "slot": "border", "name": "Néon", "sub": "Prend ta couleur", "cond_stat": None,
         "visual": v({"style": "ring", "colorMode": "signature", "thickness": 0.035, "glow": 0.7, "spin": False})},
        {"id": "conique", "slot": "border", "name": "Anneau vivant", "sub": "Dégradé qui tourne", "cond_stat": None,
         "visual": v({"style": "conic", "colorMode": "signature", "thickness": 0.035, "glow": 0, "spin": True, "speed": 5})},
        {"id": "pointille", "slot": "border", "name": "Pointillé", "sub": "Contour segmenté", "cond_stat": None,
         "visual": v({"style": "dashed", "colorMode": "signature", "thickness": 0.035, "glow": 0, "spin": False})},
        {"id": "or", "slot": "border", "name": "Or vétéran", "sub": "50 parties jouées", "cond_stat": "games_played", "cond_value": 50, "locked_sub": "Joue 50 parties",
         "visual": v({"style": "conic", "colorMode": "gold", "thickness": 0.035, "glow": 0.4, "spin": True, "speed": 8})},
        {"id": "givre", "slot": "border", "name": "Givre", "sub": "Événement hivernal", "cond_stat": "event", "locked_sub": "Événement — bientôt",
         "visual": v({"style": "ring", "colorMode": "fixed", "color": "#dcf0ff", "thickness": 0.035, "glow": 0.5})},
        # --- effets de victoire ---
        {"id": "confettis", "slot": "effect", "name": "Confettis", "sub": "Le classique festif", "cond_stat": None,
         "visual": v({"engine": "confetti", "colorMode": "multi"})},
        {"id": "onde", "slot": "effect", "name": "Onde de choc", "sub": "Impact centré", "cond_stat": None,
         "visual": v({"engine": "rings", "colorMode": "signature"})},
        {"id": "spotlight", "slot": "effect", "name": "Spotlight", "sub": "Le projecteur sur toi", "cond_stat": None,
         "visual": v({"engine": "sweep", "colorMode": "signature"})},
        {"id": "glitch", "slot": "effect", "name": "Glitch", "sub": "10 victoires en imposteur", "cond_stat": "impostor_wins", "cond_value": 10, "locked_sub": "10 victoires en imposteur",
         "visual": v({"engine": "glitch", "colorMode": "signature"})},
        {"id": "goldrain", "slot": "effect", "name": "Pluie d'or", "sub": "50 parties jouées", "cond_stat": "games_played", "cond_value": 50, "locked_sub": "Joue 50 parties",
         "visual": v({"engine": "rain", "colorMode": "gold"})},
    ]


def ensure_seed() -> None:
    db.seed_catalog(_seed_rows())


# ------------------------------------------------------------ déblocages

def _row_unlocked(row: dict, stats: dict) -> bool:
    stat = row["cond_stat"]
    if not stat:
        return True
    if stat not in KNOWN_STATS:  # ex. 'event' → jamais débloqué automatiquement
        return False
    return stats.get(stat, 0) >= row["cond_value"]


def is_unlocked(slot: str, item_id: str, stats: dict) -> bool:
    row = db.catalog_get(item_id)
    if not row or row["slot"] != slot or not row["enabled"]:
        return False
    return _row_unlocked(row, stats)


def _visual(row: dict):
    if not row.get("visual"):
        return None
    try:
        return json.loads(row["visual"])
    except (ValueError, TypeError):
        return None


def _progress(row: dict, stats: dict) -> str | None:
    if not row["cond_stat"] or row["cond_stat"] not in KNOWN_STATS:
        return None
    return f"{min(stats.get(row['cond_stat'], 0), row['cond_value'])}/{row['cond_value']}"


def _serialize_item(row: dict, stats: dict) -> dict:
    unlocked = _row_unlocked(row, stats)
    return {
        "id": row["id"],
        "name": row["name"],
        "sub": row["sub"] if unlocked else (row["locked_sub"] or row["sub"]),
        "unlocked": unlocked,
        "progress": None if unlocked else _progress(row, stats),
        "visual": _visual(row),
    }


def serialize_catalog(slot: str, stats: dict) -> list[dict]:
    rows = [r for r in db.catalog_all() if r["slot"] == slot]
    return [_serialize_item(r, stats) for r in rows]


def title_name(title_id: str) -> str:
    row = db.catalog_get(title_id)
    return row["name"] if row and row["slot"] == "title" else ""


def visual_of(item_id: str):
    row = db.catalog_get(item_id)
    return _visual(row) if row else None


def full_profile(stats: dict, cosmetics: dict) -> dict:
    return {
        "stats": stats,
        "equipped": cosmetics,
        "catalog": {slot: serialize_catalog(slot, stats) for slot in ("title", "border", "effect")},
    }
