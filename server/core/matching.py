"""Auto-correction des réponses objectives (drapeaux, animaux, célébrités…).

On compare la réponse tapée à la réponse de référence (et ses alternatives)
en ignorant la casse, les accents, la ponctuation, les articles, et en
tolérant les petites fautes de frappe. Objectif : que le serveur puisse
trancher bon/pas bon sans qu'un humain connaisse la réponse à l'avance.
"""
from __future__ import annotations

import difflib
import re
import unicodedata

_ARTICLES = {"le", "la", "les", "l", "un", "une", "des", "du", "de", "d",
             "the", "a", "an", "el", "los", "las"}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # retire les accents
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _key(s: str) -> str:
    """Forme normalisée, articles retirés — pour comparer 'La France' ~ 'france'."""
    words = [w for w in normalize(s).split() if w not in _ARTICLES]
    return " ".join(words) if words else normalize(s)


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _typo_tolerance(n: int) -> int:
    """Nombre de fautes tolérées selon la longueur de la réponse."""
    if n <= 4:
        return 1
    if n <= 8:
        return 2
    return round(n * 0.25)


def is_correct(answer: str, reference: str, alts: list[str] | None = None,
               ratio: float = 0.86) -> bool:
    """True si `answer` correspond à `reference` ou à une alternative acceptée,
    en tolérant casse/accents/articles et les petites fautes de frappe."""
    a = _key(answer)
    if not a:
        return False
    for cand in [reference, *(alts or [])]:
        c = _key(cand)
        if not c:
            continue
        if a == c:
            return True
        if _levenshtein(a, c) <= _typo_tolerance(max(len(a), len(c))):
            return True
        # filet supplémentaire pour les réponses multi-mots
        if difflib.SequenceMatcher(None, a, c).ratio() >= ratio:
            return True
    return False
