"""Pré-télécharge les intros d'articles Wikipédia FR pour le jeu Wikidle.

Usage (depuis server/) :  python tools/fetch_wikidle.py
Écrit games/dailies/wikidle_pages.json : [{title, url, text}, ...]

Le texte de Wikipédia est sous licence CC BY-SA : l'app affiche la source et
le lien de l'article une fois la partie terminée.
"""
import json
import os
import re
import sys
import time

import requests

# La console Windows est en cp1252 : sans ça, un titre accentué/cyrillique crashe.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

API = "https://fr.wikipedia.org/w/api.php"
UA = "yGAMES-app/1.0 (jeu prive entre amis; contact: lucas.yuumei@gmail.com)"
OUT = os.path.join(os.path.dirname(__file__), "..", "games", "dailies", "wikidle_pages.json")

# « Tout et n'importe quoi », mais des sujets que tout le monde peut deviner.
TITLES = [
    # --- personnes ---
    "Napoléon Ier", "Albert Einstein", "Cléopâtre VII", "Michael Jackson",
    "Zinédine Zidane", "Marie Curie", "Léonard de Vinci", "Mahatma Gandhi",
    "Nelson Mandela", "Steve Jobs", "Cristiano Ronaldo", "Lionel Messi",
    "Molière", "Victor Hugo", "Wolfgang Amadeus Mozart", "Pablo Picasso",
    "Jeanne d'Arc", "Charles de Gaulle", "Vincent van Gogh", "Elvis Presley",
    "Elon Musk", "Céline Dion", "Usain Bolt", "Michael Jordan", "Beethoven",
    "Christophe Colomb", "Galilée", "Isaac Newton", "Charles Darwin",
    "Jules César", "Louis XIV", "Toutânkhamon", "Vladimir Poutine",
    # --- pays & lieux ---
    "France", "Japon", "Brésil", "Australie", "Islande", "Égypte", "Canada",
    "Italie", "Inde", "Chine", "Russie", "Espagne", "Maroc", "Mexique",
    "Paris", "Tokyo", "New York", "Venise", "Rome", "Londres",
    "Mont Everest", "Sahara", "Amazone", "Grand Canyon", "Tour Eiffel",
    "Grande Muraille", "Machu Picchu", "Antarctique", "Océan Pacifique",
    "Hawaï", "Sibérie", "Alpes", "Nil",
    # --- animaux & nature ---
    "Chat", "Chien", "Éléphant", "Lion", "Requin blanc", "Manchot empereur",
    "Abeille", "Loup gris", "Dauphin", "Panda géant", "Girafe", "Tigre",
    "Kangourou", "Araignée", "Papillon", "Baleine bleue", "Crocodile",
    "Ours polaire", "Hibou", "Poulpe", "Fourmi", "Cheval", "Renard roux",
    "Forêt amazonienne", "Volcan", "Arc-en-ciel", "Tornade", "Séisme",
    # --- nourriture ---
    "Pizza", "Chocolat", "Fromage", "Sushi", "Café", "Vin", "Croissant",
    "Baguette (pain)", "Pomme", "Banane", "Miel", "Pâtes alimentaires",
    "Hamburger", "Crème glacée", "Thé", "Riz", "Chocolat noir",
    # --- culture & divertissement ---
    "Star Wars", "Harry Potter", "One Piece", "Pokémon", "Minecraft",
    "Le Seigneur des anneaux", "Titanic (film, 1997)", "Les Simpson",
    "Mario (personnage)", "Dragon Ball", "Netflix", "Disney",
    "Game of Thrones", "Le Roi lion", "Astérix", "Tintin", "Naruto",
    "Jeu vidéo", "Cinéma", "Rock", "Jazz", "Hip-hop", "Bande dessinée",
    "Échecs", "Poker", "Rubik's Cube", "Lego",
    # --- sciences & tech ---
    "Internet", "Soleil", "Lune", "Mars (planète)", "Acide désoxyribonucléique",
    "Gravitation", "Ordinateur", "Intelligence artificielle", "Vaccin",
    "Électricité", "Dinosaure", "Trou noir", "Big Bang", "Atome",
    "Téléphone mobile", "Photographie", "Avion", "Fusée", "Robot",
    "Système solaire", "Évolution (biologie)", "Cerveau humain", "Cœur",
    "Vitesse de la lumière", "Énergie solaire", "Antibiotique",
    # --- histoire ---
    "Seconde Guerre mondiale", "Première Guerre mondiale",
    "Révolution française", "Empire romain", "Mur de Berlin",
    "Égypte antique", "Guerre froide", "Grèce antique", "Vikings",
    "Renaissance", "Moyen Âge", "Titanic", "Apollo 11", "Peste noire",
    "Chute de l'Empire romain d'Occident", "Croisade",
    # --- sport ---
    "Football", "Jeux olympiques", "Tour de France", "Basket-ball", "Tennis",
    "Coupe du monde de football", "Rugby à XV", "Natation", "Marathon",
    "Formule 1", "Judo", "Escalade", "Surf", "Ski alpin",
    # --- objets & concepts du quotidien ---
    "Vélo", "Voiture", "Horloge", "Musique", "Livre", "Argent", "Amour",
    "Sommeil", "Rêve", "Rire", "Langage", "École", "Mariage", "Anniversaire",
    "Noël", "Halloween", "Feu", "Eau", "Neige", "Miroir", "Parapluie",
    "Chaussure", "Guitare", "Piano", "Appareil photo", "Bibliothèque",
    "Train", "Pont", "Château fort", "Phare", "Jardin", "Montagne",
]


def fetch(title: str) -> dict | None:
    params = {
        "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
        "redirects": 1, "format": "json", "titles": title,
    }
    r = requests.get(API, params=params, headers={"User-Agent": UA}, timeout=20)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    for pid, page in pages.items():
        if pid == "-1" or "extract" not in page:
            return None
        text = (page["extract"] or "").strip()
        if len(text) < 250:          # intro trop courte = partie injouable
            return None
        real = page.get("title", title)
        return {
            "title": real,
            "url": "https://fr.wikipedia.org/wiki/" + real.replace(" ", "_"),
            "text": text[:2500],     # on garde l'intro, ça suffit largement
        }
    return None


SKIP_PREFIX = ("Liste ", "Listes ", "Discussion", "Portail", "Catégorie")


def is_playable(page: dict) -> bool:
    """Filtre les pages injouables : listes, homonymies, années nues, stubs."""
    t = page["title"]
    if t.startswith(SKIP_PREFIX) or "(homonymie)" in t:
        return False
    if re.fullmatch(r"[\d\s\-–]+", t):      # « 1987 », « 1er janvier »…
        return False
    if len(page["text"]) < 400:             # pas assez de texte pour jouer
        return False
    return True


def random_titles(n: int) -> list[str]:
    """Titres d'articles tirés au hasard sur Wikipédia FR."""
    got = []
    while len(got) < n:
        r = requests.get(API, params={
            "action": "query", "list": "random", "rnnamespace": 0,
            "rnlimit": 10, "format": "json",
        }, headers={"User-Agent": UA}, timeout=20)
        r.raise_for_status()
        got += [p["title"] for p in r.json()["query"]["random"]]
        time.sleep(0.15)
    return got[:n]


def fetch_random(count: int) -> None:
    """Ajoute `count` pages au hasard au pool existant (sans doublon)."""
    with open(OUT, encoding="utf-8") as f:
        pool = json.load(f)
    seen = {p["title"] for p in pool}
    added = tried = 0
    while added < count and tried < count * 6:
        for title in random_titles(10):
            tried += 1
            if added >= count:
                break
            if title in seen:
                continue
            try:
                page = fetch(title)
            except Exception:  # noqa: BLE001
                continue
            if not page or not is_playable(page) or page["title"] in seen:
                continue
            seen.add(page["title"])
            pool.append(page)
            added += 1
            print(f"OK   +{added}/{count}  {page['title']} ({len(page['text'])} car.)")
            time.sleep(0.1)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(pool, f, ensure_ascii=False, indent=1)
    print(f"--- pool : {len(pool)} pages (dont {added} ajoutées au hasard)")


def main():
    if "--random" in sys.argv:
        n = int(sys.argv[sys.argv.index("--random") + 1])
        return fetch_random(n)
    out, seen = [], set()
    for i, t in enumerate(TITLES, 1):
        try:
            page = fetch(t)
        except Exception as e:  # noqa: BLE001
            print(f"ERR  {t} -> {e}")
            continue
        if not page:
            print(f"SKIP {t} (introuvable ou intro trop courte)")
            continue
        if page["title"] in seen:
            print(f"DUP  {page['title']}")
            continue
        seen.add(page["title"])
        out.append(page)
        print(f"OK   [{i}/{len(TITLES)}] {page['title']} ({len(page['text'])} car.)")
        time.sleep(0.15)            # on reste poli avec l'API
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"--- {len(out)} pages écrites dans {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
