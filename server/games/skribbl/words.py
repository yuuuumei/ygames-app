"""Banque de mots à dessiner, rangée par difficulté.

Critère de classement : est-ce que ça se DESSINE, pas est-ce que c'est
un mot compliqué. « Chat » est facile, « jaloux » est difficile — les
deux sont des mots courants.
"""

FACILE = [
    "chat", "chien", "maison", "soleil", "arbre", "voiture", "fleur", "poisson",
    "livre", "table", "chaise", "lune", "étoile", "nuage", "pluie", "montagne",
    "banane", "pomme", "gâteau", "pizza", "clé", "porte", "fenêtre", "lit",
    "ballon", "vélo", "bateau", "avion", "train", "bus", "coeur", "main",
    "oeil", "nez", "bouche", "pied", "chapeau", "lunettes", "parapluie", "cadeau",
    "bougie", "horloge", "téléphone", "ordinateur", "télévision", "guitare",
    "tambour", "ciseaux", "crayon", "brosse à dents", "échelle", "pont",
    "château", "fantôme", "robot", "fusée", "couronne", "épée", "coeur brisé",
    "sapin", "champignon", "carotte", "fraise", "glace", "bonbon", "café",
    "oiseau", "papillon", "abeille", "araignée", "serpent", "tortue", "lapin",
    "souris", "vache", "cochon", "mouton", "cheval", "canard", "pingouin",
]

MOYEN = [
    "girafe", "éléphant", "kangourou", "hérisson", "chauve-souris", "flamant rose",
    "phare", "moulin", "igloo", "tente", "hamac", "boussole", "trésor", "pirate",
    "sorcière", "dragon", "licorne", "sirène", "vampire", "momie", "zombie",
    "astronaute", "plongeur", "pompier", "chef cuisinier", "clown", "magicien",
    "policier", "facteur", "jardinier", "dentiste", "photographe",
    "tour Eiffel", "pyramide", "statue de la Liberté", "grande muraille",
    "arc-en-ciel", "volcan", "tornade", "iceberg", "désert", "cascade",
    "montgolfière", "sous-marin", "hélicoptère", "trottinette", "skateboard",
    "brouette", "tracteur", "grue", "ascenseur", "escalier roulant",
    "microscope", "télescope", "aimant", "ampoule", "batterie", "engrenage",
    "cadenas", "coffre-fort", "balance", "sablier", "boîte aux lettres",
    "machine à laver", "aspirateur", "grille-pain", "réfrigérateur",
    "hamburger", "sushi", "croissant", "spaghetti", "popcorn", "barbe à papa",
    "trampoline", "toboggan", "balançoire", "manège", "grande roue",
    "orchestre", "microphone", "casque audio", "piano", "violon", "trompette",
]

DIFFICILE = [
    "embouteillage", "déménagement", "anniversaire", "mariage", "carnaval",
    "réveillon", "cauchemar", "insomnie", "éternuement", "bâillement",
    "vertige", "déjà-vu", "chatouille", "grimace", "clin d'oeil",
    "jaloux", "timide", "furieux", "amoureux", "épuisé", "gêné", "fier",
    "gravité", "évolution", "recyclage", "pollution", "électricité",
    "démocratie", "économie", "internet", "intelligence artificielle",
    "trou noir", "éclipse", "mirage", "écho", "ombre", "reflet",
    "labyrinthe", "domino", "puzzle", "origami", "marionnette",
    "effet papillon", "chaîne alimentaire", "grève", "manifestation",
    "télétravail", "confinement", "randonnée", "camping sauvage",
    "chasse au trésor", "course de relais", "saut à l'élastique",
    "poisson d'avril", "chasse aux oeufs", "feu d'artifice", "déguisement",
    "bouchon de liège", "nid de guêpes", "château de cartes", "toile d'araignée",
    "sonnette", "tirelire", "boomerang", "kaléidoscope", "métronome",
]

BY_DIFFICULTY = {
    "facile": FACILE,
    "moyen": MOYEN,
    "difficile": DIFFICILE,
}

DIFFICULTIES = list(BY_DIFFICULTY)
ALL_WORDS = FACILE + MOYEN + DIFFICILE
