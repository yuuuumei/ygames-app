"""Banque de questions de départ du Quiz Culture.

⚠️ Priorité projet : cette banque doit devenir ÉNORME (sinon répétitions = jeu
nul). Ceci n'est qu'un starter — elle est ensuite gérée/agrandie via le
back-office admin. `answer` = réponse de référence pour aider l'hôte à corriger.
"""

SEED_QUESTIONS = [
    # --- Histoire ---
    {"category": "Histoire", "question": "En quelle année a eu lieu la Révolution française ?", "answer": "1789"},
    {"category": "Histoire", "question": "Qui était le premier empereur des Français ?", "answer": "Napoléon Bonaparte"},
    {"category": "Histoire", "question": "Quel mur est tombé en 1989 ?", "answer": "Le mur de Berlin"},
    {"category": "Histoire", "question": "En quelle année l'homme a-t-il marché sur la Lune ?", "answer": "1969"},
    {"category": "Histoire", "question": "Quelle reine d'Égypte a séduit César et Marc Antoine ?", "answer": "Cléopâtre"},
    # --- Géographie ---
    {"category": "Géographie", "question": "Quelle est la capitale de l'Australie ?", "answer": "Canberra"},
    {"category": "Géographie", "question": "Quel est le plus long fleuve du monde ?", "answer": "Le Nil (ou l'Amazone selon les mesures)"},
    {"category": "Géographie", "question": "Combien de pays composent l'Union européenne (2024) ?", "answer": "27"},
    {"category": "Géographie", "question": "Quel est le plus grand désert chaud du monde ?", "answer": "Le Sahara"},
    {"category": "Géographie", "question": "Dans quel pays se trouve le Machu Picchu ?", "answer": "Le Pérou"},
    # --- Sciences ---
    {"category": "Sciences", "question": "Quel est le symbole chimique de l'or ?", "answer": "Au"},
    {"category": "Sciences", "question": "Combien de planètes dans le système solaire ?", "answer": "8"},
    {"category": "Sciences", "question": "Quel organe pompe le sang dans le corps ?", "answer": "Le cœur"},
    {"category": "Sciences", "question": "Quelle est la vitesse de la lumière (approx., km/s) ?", "answer": "≈ 300 000 km/s"},
    {"category": "Sciences", "question": "Qui a énoncé la théorie de la relativité ?", "answer": "Albert Einstein"},
    # --- Sport ---
    {"category": "Sport", "question": "Combien de joueurs dans une équipe de football sur le terrain ?", "answer": "11"},
    {"category": "Sport", "question": "Quel pays a gagné la Coupe du monde de foot 2018 ?", "answer": "La France"},
    {"category": "Sport", "question": "Tous les combien d'années ont lieu les Jeux olympiques d'été ?", "answer": "4 ans"},
    {"category": "Sport", "question": "Dans quel sport pratique-t-on un 'smash' et un 'ace' ?", "answer": "Le tennis"},
    {"category": "Sport", "question": "Quel joueur est surnommé 'la Pulga' (la Puce) ?", "answer": "Lionel Messi"},
    # --- Cinéma & Séries ---
    {"category": "Cinéma", "question": "Qui réalise la saga 'Le Seigneur des Anneaux' ?", "answer": "Peter Jackson"},
    {"category": "Cinéma", "question": "Dans quel film entend-on 'Je suis ton père' ?", "answer": "Star Wars (L'Empire contre-attaque)"},
    {"category": "Cinéma", "question": "Quel acteur incarne Iron Man dans le MCU ?", "answer": "Robert Downey Jr."},
    {"category": "Cinéma", "question": "Quelle série suit la famille Stark et la maison Targaryen ?", "answer": "Game of Thrones"},
    {"category": "Cinéma", "question": "Quel studio a créé 'Toy Story' ?", "answer": "Pixar"},
    # --- Musique ---
    {"category": "Musique", "question": "Quel groupe a chanté 'Bohemian Rhapsody' ?", "answer": "Queen"},
    {"category": "Musique", "question": "Combien de cordes sur une guitare classique standard ?", "answer": "6"},
    {"category": "Musique", "question": "Quelle chanteuse est surnommée 'Queen B' ?", "answer": "Beyoncé"},
    {"category": "Musique", "question": "De quel pays vient le reggae ?", "answer": "La Jamaïque"},
    # --- Jeux vidéo ---
    {"category": "Jeux vidéo", "question": "Quel plombier moustachu est la mascotte de Nintendo ?", "answer": "Mario"},
    {"category": "Jeux vidéo", "question": "Dans quel jeu construit-on avec des blocs cubiques ?", "answer": "Minecraft"},
    {"category": "Jeux vidéo", "question": "Quelle société a créé la PlayStation ?", "answer": "Sony"},
    {"category": "Jeux vidéo", "question": "Comment s'appelle l'elfe héroïne de la saga Zelda ?", "answer": "Zelda (le héros est Link)"},
    # --- Culture générale ---
    {"category": "Général", "question": "Combien de côtés a un hexagone ?", "answer": "6"},
    {"category": "Général", "question": "Quelle langue est la plus parlée au monde (locuteurs natifs) ?", "answer": "Le chinois mandarin"},
    {"category": "Général", "question": "Quel est l'animal terrestre le plus rapide ?", "answer": "Le guépard"},
    {"category": "Général", "question": "Combien de touches sur un piano classique ?", "answer": "88"},
    {"category": "Général", "question": "Quelle planète est surnommée la planète rouge ?", "answer": "Mars"},
    {"category": "Général", "question": "Quel est le métal liquide à température ambiante ?", "answer": "Le mercure"},
]


def _tl(question, year, lo, hi):
    return {
        "category": "Frise chrono", "question": question, "answer": str(year),
        "type": "timeline", "auto": 1,
        "media": {"kind": "timeline", "min": lo, "max": hi},
    }


# Dates célèbres à placer sur une frise chronologique.
TIMELINE_QUESTIONS = [
    _tl("Chute de l'Empire romain d'Occident", 476, 0, 1000),
    _tl("Découverte de l'Amérique par Christophe Colomb", 1492, 1300, 1700),
    _tl("Prise de la Bastille / Révolution française", 1789, 1600, 1900),
    _tl("Déclaration d'indépendance des États-Unis", 1776, 1600, 1900),
    _tl("Sacre de Napoléon empereur", 1804, 1700, 1900),
    _tl("Début de la Première Guerre mondiale", 1914, 1850, 1950),
    _tl("Fin de la Seconde Guerre mondiale", 1945, 1900, 2000),
    _tl("Premier pas de l'Homme sur la Lune", 1969, 1900, 2025),
    _tl("Chute du mur de Berlin", 1989, 1900, 2025),
    _tl("Attentats du 11 septembre", 2001, 1950, 2025),
]


def _animal(file, answer, alts):
    return {
        "category": "Bruits d'animaux", "question": "Quel animal fait ce bruit ?",
        "answer": answer, "type": "audio", "auto": 1, "alt_answers": alts,
        "media": {"kind": "audio", "url": f"/media/animals/{file}"},
    }


# Bruits d'animaux (pack bundlé server/media/animals/).
ANIMAL_QUESTIONS = [
    _animal("crow1.wav", "Corbeau", ["Corneille"]),
    _animal("crow2.wav", "Corbeau", ["Corneille"]),
    _animal("geese.wav", "Oie", ["Oies"]),
    _animal("goat.wav", "Chèvre", ["Bouc", "Biquette"]),
    _animal("hawk.wav", "Faucon", ["Rapace", "Buse", "Aigle"]),
    _animal("sheep.wav", "Mouton", ["Brebis", "Moutons"]),
    _animal("pigs.wav", "Cochon", ["Porc", "Cochons"]),
    _animal("owl.wav", "Hibou", ["Chouette"]),
]


def _pb(cats):
    return {
        "category": "Petit Bac", "question": "Petit Bac !", "answer": "",
        "type": "petitbac", "auto": 0,
        "media": {"kind": "petitbac", "categories": cats},
    }


# Manches Petit Bac (la lettre est tirée au sort à chaque partie).
PETITBAC_QUESTIONS = [
    _pb(["Prénom", "Métier", "Sport", "Objet", "Pays", "Animal"]),
    _pb(["Ville", "Fruit ou légume", "Marque", "Film", "Groupe/Chanteur", "Couleur"]),
    _pb(["Prénom fille", "Prénom garçon", "Pays", "Capitale", "Animal", "Métier"]),
    _pb(["Personnage de fiction", "Jeu vidéo", "Plat", "Instrument", "Île/Pays", "Verbe"]),
]
