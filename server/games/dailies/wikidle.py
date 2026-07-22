"""Wikidle : devine l'article Wikipédia caché (façon Pédantix).

Un article du jour est tiré au sort (déterministe par date). Tout le texte est
masqué : le joueur propose des mots, et chaque mot trouvé se dévoile PARTOUT
dans l'article. On gagne quand le TITRE est entièrement dévoilé (ou en tapant
le titre complet d'un coup). Nombre d'essais illimité — le score, c'est le
nombre de propositions.

Texte sous licence CC BY-SA (Wikipédia) : l'app affiche la source et le lien.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata

ID = "wikidle"
NAME = "Wikidle"
ICON = "📖"
DESC = "Devine l'article Wikipédia caché, mot par mot."

_PAGES_FILE = os.path.join(os.path.dirname(__file__), "wikidle_pages.json")
with open(_PAGES_FILE, encoding="utf-8") as _f:
    PAGES = json.load(_f)

# Mots outils : PAS dévoilés (tout est masqué), mais exclus des mots du titre
# à trouver — inutile d'exiger « de » ou « la » pour valider la victoire.
STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "d", "et", "ou", "a",
    "au", "aux", "en", "dans", "sur", "sous", "pour", "par", "avec", "sans",
    "est", "sont", "etait", "etaient", "ete", "etre", "fut", "furent", "sera",
    "ce", "cet", "cette", "ces", "qui", "que", "quoi", "dont", "ou", "il",
    "elle", "ils", "elles", "on", "se", "sa", "son", "ses", "leur", "leurs",
    "plus", "moins", "tres", "aussi", "mais", "donc", "or", "ni", "car",
    "y", "l", "s", "n", "ne", "pas", "comme", "entre", "depuis", "apres",
    "avant", "lors", "selon", "chez", "vers", "puis", "aux", "ainsi", "tout",
    "toute", "tous", "toutes", "meme", "sont", "avoir", "ont", "avait", "a",
    "il", "y", "the", "of", "in",
}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def _norm_word(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", normalize(w))


# ---------------------------------------------------------------- familles
# Proposer UN membre d'une famille révèle TOUS les autres : sinon il faut
# taper « le », « la », « les », « l' » séparément et c'est pénible.
_FAMILIES = [
    # déterminants & articles
    {"le", "la", "les", "l"},
    {"un", "une", "uns", "unes"},
    {"de", "du", "des", "d"},
    {"a", "au", "aux"},
    {"ce", "cet", "cette", "ces", "c"},
    {"mon", "ma", "mes"}, {"ton", "ta", "tes"}, {"son", "sa", "ses"},
    {"notre", "nos"}, {"votre", "vos"}, {"leur", "leurs"},
    {"tout", "toute", "tous", "toutes"},
    {"quel", "quelle", "quels", "quelles"},
    {"celui", "celle", "ceux", "celles"},
    # pronoms
    {"il", "elle", "ils", "elles"},
    {"je", "j", "me", "m", "moi"},
    {"tu", "te", "t", "toi"},
    {"se", "s", "soi"},
    {"que", "qu"},
    {"ne", "n"},
    # auxiliaires & verbes très fréquents
    {"etre", "est", "sont", "etait", "etaient", "ete", "fut", "furent",
     "sera", "seront", "suis", "es", "sommes", "etes", "soit", "soient"},
    {"avoir", "ai", "as", "ont", "avait", "avaient", "eu", "aura",
     "auront", "ayant", "avons", "avez"},
    {"faire", "fait", "faits", "faite", "faites", "font", "faisait", "fera"},
    {"pouvoir", "peut", "peuvent", "pouvait", "pourra", "peuvent"},
    # adjectifs courants (masc/fém/pluriel)
    {"grand", "grande", "grands", "grandes"},
    {"petit", "petite", "petits", "petites"},
    {"premier", "premiere", "premiers", "premieres"},
    {"dernier", "derniere", "derniers", "dernieres"},
    {"nouveau", "nouvel", "nouvelle", "nouveaux", "nouvelles"},
    {"vieux", "vieil", "vieille", "vieilles"},
]
FAMILY_OF = {w: f"fam{i}" for i, fam in enumerate(_FAMILIES) for w in fam}


def _stem(n: str) -> str:
    """Racine grossière : gère surtout le pluriel (chat/chats, animal/animaux)."""
    if len(n) > 5 and n.endswith("aux"):
        return n[:-3] + "al"
    if len(n) > 3 and n[-1] in "sx":
        return n[:-1]
    return n


def word_key(w: str) -> str:
    """Clé de comparaison : même clé = même famille de mots."""
    n = _norm_word(w)
    if not n:
        return ""
    return FAMILY_OF.get(n) or _stem(n)


def _norm_phrase(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", normalize(s))


def new_puzzle(day: str) -> dict:
    h = hashlib.sha256(f"wikidle:{day}".encode()).hexdigest()
    page = PAGES[int(h, 16) % len(PAGES)]
    return {"title": page["title"], "url": page["url"], "text": page["text"]}


def title_key_words(title: str) -> set[str]:
    """Les clés du titre à trouver (hors parenthèses de désambiguïsation)."""
    base = re.sub(r"\(.*?\)", " ", title)
    out = set()
    for w in re.findall(r"\w+", base, flags=re.UNICODE):
        n = _norm_word(w)
        if len(n) >= 2 and n not in STOPWORDS:
            out.add(word_key(w))
    return out


def _tokenize(text: str) -> list:
    """Découpe en mots / séparateurs, en gardant la ponctuation visible."""
    return re.findall(r"\w+|\W+", text, flags=re.UNICODE)


def _render(text: str, found: set[str]) -> list[dict]:
    """Tokens pour le client. TOUS les mots sont masqués tant qu'ils n'ont pas
    été proposés — seuls la ponctuation et les nombres restent visibles."""
    out = []
    for tok in _tokenize(text):
        if re.match(r"\w", tok, flags=re.UNICODE):
            k = word_key(tok)
            if k in found or _norm_word(tok).isdigit():
                out.append({"t": "w", "v": tok, "hit": k in found})
            else:
                out.append({"t": "h", "n": len(tok)})   # masqué
        else:
            out.append({"t": "s", "v": tok})            # séparateur
    return out


def _count(text: str, key: str) -> int:
    """Occurrences de la FAMILLE du mot (le/la/les comptent ensemble)."""
    return sum(1 for tok in _tokenize(text)
               if re.match(r"\w", tok, flags=re.UNICODE) and word_key(tok) == key)


def _is_solved(payload: dict, found: set[str]) -> bool:
    keys = title_key_words(payload["title"])
    return bool(keys) and keys <= found


def public(payload: dict, play: dict) -> dict:
    found = {word_key(g["word"]) for g in play["guesses"]} if play["guesses"] else set()
    # une fois fini, on dévoile tout
    solved = play["solved"]
    finished = play["finished"]
    if finished:
        found |= {word_key(t) for t in _tokenize(payload["title"] + " " + payload["text"])
                  if re.match(r"\w", t, flags=re.UNICODE)}
    return {
        "id": ID, "name": NAME, "icon": ICON, "desc": DESC,
        "title": _render(payload["title"], found),
        "text": _render(payload["text"], found),
        "guesses": list(reversed(play["guesses"])),   # le plus récent en haut
        "tries": len(play["guesses"]),
        "solved": solved,
        "finished": finished,
        "answer": payload["title"] if finished else None,
        "url": payload["url"] if finished else None,
    }


def guess(payload: dict, play: dict, text: str) -> tuple[str | None, dict]:
    if play["finished"]:
        return "Défi déjà terminé pour aujourd'hui.", play

    raw = (text or "").strip()
    key = word_key(raw)
    if not key:
        return "Propose un mot.", play

    # Titre complet tapé d'un coup → victoire directe
    full_title = _norm_phrase(re.sub(r"\(.*?\)", " ", payload["title"]))
    if _norm_phrase(raw) == full_title and full_title:
        guesses = [*play["guesses"], {"word": raw, "count": 1, "title": True}]
        return None, {"guesses": guesses, "solved": True, "finished": True,
                      "score": len(guesses)}

    if any(word_key(g["word"]) == key for g in play["guesses"]):
        return "Mot (ou une de ses formes) déjà proposé.", play

    count = _count(payload["title"] + " " + payload["text"], key)
    guesses = [*play["guesses"], {"word": raw, "count": count}]
    found = {word_key(g["word"]) for g in guesses}
    solved = _is_solved(payload, found)
    return None, {
        "guesses": guesses,
        "solved": solved,
        "finished": solved,
        "score": len(guesses),
    }
