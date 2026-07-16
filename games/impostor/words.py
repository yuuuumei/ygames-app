# ============================================================
#  games/impostor/words.py — Banque de paires de mots.
#
#  Format : catégorie → [(mot_A, mot_B, difficulté), ...]
#    easy   → paire très proche, l'imposteur passe inaperçu
#    medium → proche mais distinguable à l'oral
#    hard   → même thème mais éloigné, imposteur vite repéré
#
#  L'ordre A/B n'importe pas : au démarrage on tire une paire,
#  puis on choisit au hasard lequel est le mot "principal" et
#  lequel est le mot "imposteur".
#
#  NOTE : sous-ensemble représentatif pour la Phase 0. La banque
#  complète de l'ancien yGAMES (words_impostor.py) sera portée ici.
# ============================================================
from __future__ import annotations

import random

WORD_PAIRS: dict[str, list[tuple[str, str, str]]] = {
    "instruments": [
        ("Guitare", "Piano", "easy"),
        ("Violon", "Alto", "easy"),
        ("Trompette", "Trombone", "easy"),
        ("Saxophone", "Hautbois", "medium"),
        ("Guitare", "Harpe", "hard"),
    ],
    "sports": [
        ("Football", "Rugby", "easy"),
        ("Tennis", "Badminton", "easy"),
        ("Natation", "Plongeon", "medium"),
        ("Boxe", "Escrime", "hard"),
    ],
    "nourriture": [
        ("Pizza", "Quiche", "easy"),
        ("Sushi", "Maki", "easy"),
        ("Croissant", "Brioche", "medium"),
        ("Steak", "Yaourt", "hard"),
    ],
}

CATEGORIES = list(WORD_PAIRS.keys())
DIFFICULTIES = ("easy", "medium", "hard")


def pick_pair(
    category: str | None = None,
    difficulty: str | None = None,
) -> tuple[str, str, str, str]:
    """Tire une paire → (mot_principal, mot_imposteur, catégorie, difficulté).
    Le rôle principal/imposteur de chaque mot est randomisé."""
    cat = category if category in WORD_PAIRS else random.choice(CATEGORIES)
    pool = WORD_PAIRS[cat]
    if difficulty in DIFFICULTIES:
        filtered = [p for p in pool if p[2] == difficulty]
        pool = filtered or pool
    a, b, diff = random.choice(pool)
    if random.random() < 0.5:
        a, b = b, a
    return a, b, cat, diff
