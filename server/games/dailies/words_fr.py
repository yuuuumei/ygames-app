"""Liste de mots français de 5 lettres pour le Wordle du jour.

Sans accents ni cédilles : le joueur tape sans se soucier de la typo, et la
comparaison est directe. Sert à la fois de pioche (mot du jour) et de
dictionnaire des essais acceptés.
"""

WORDS_5 = [
    "ARBRE", "AVION", "AVOIR", "BAGUE", "BALAI", "BALLE", "BANDE", "BARBE",
    "BARIL", "BATON", "BILLE", "BLANC", "BOEUF", "BOITE", "BOMBE", "BOTTE",
    "BOUEE", "BRAVO", "BRUIT", "BRUME", "BUCHE", "CABLE", "CADRE", "CALME",
    "CANNE", "CARRE", "CARTE", "CAUSE", "CHAIR", "CHANT", "CHAUD", "CHIEN",
    "CHOIX", "CHUTE", "CIBLE", "CIRQUE", "CLAIR", "CLOUS", "COEUR", "COLLE",
    "COMTE", "CORDE", "CORPS", "COTON", "COUPE", "COURS", "CRABE", "CRAIE",
    "CREME", "CRISE", "CROIX", "CUIRE", "DANSE", "DEBUT", "DIGUE", "DOIGT",
    "DOUTE", "DRAPS", "DROIT", "DUREE", "ECOLE", "ECRAN", "EFFET", "ELEVE",
    "EMAIL", "ENFIN", "ENTRE", "EPICE", "ETAGE", "ETANG", "ETAPE", "ETUDE",
    "FACON", "FAIRE", "FARCE", "FAUTE", "FEMME", "FERME", "FICHE", "FILET",
    "FILLE", "FLEUR", "FOIRE", "FOLIE", "FORCE", "FORET", "FOULE", "FRAIS",
    "FREIN", "FRUIT", "FUMEE", "GARDE", "GENOU", "GESTE", "GLACE", "GOMME",
    "GRACE", "GRAIN", "GRAND", "GRAVE", "GUIDE", "HABIT", "HAINE", "HERBE",
    "HEURE", "HIVER", "HOTEL", "HUILE", "IMAGE", "INDEX", "JAMBE", "JAUNE",
    "JETON", "JEUNE", "JOUER", "JUPES", "LAINE", "LAMPE", "LANCE", "LAPIN",
    "LARGE", "LARME", "LAVER", "LECON", "LEVRE", "LIBRE", "LIEUX", "LIGNE",
    "LIMON", "LINGE", "LISTE", "LIVRE", "LOUPE", "LOURD", "LUNDI", "LUNES",
    "MAIRE", "MALLE", "MANGE", "MARIE", "MASSE", "MATIN", "MELON", "MERCI",
    "MERLE", "METAL", "METRE", "MILLE", "MINCE", "MOINS", "MONDE", "MORAL",
    "MOTIF", "MOULE", "MUSEE", "NAGER", "NAPPE", "NEIGE", "NOEUD", "NOIRE",
    "NUAGE", "OCEAN", "ODEUR", "OMBRE", "ONCLE", "ONGLE", "ORAGE", "ORDRE",
    "OSIER", "OUTIL", "PAGES", "PALME", "PARIS", "PARTS", "PATTE", "PAUSE",
    "PECHE", "PEINE", "PENTE", "PERLE", "PESTE", "PETIT", "PHARE", "PIANO",
    "PIECE", "PILES", "PIQUE", "PISTE", "PLACE", "PLAGE", "PLANS", "PLEIN",
    "PLUIE", "PLUME", "POCHE", "POEME", "POIDS", "POING", "POIRE", "POMME",
    "PORTE", "POSTE", "POUCE", "POULE", "PRISE", "PROIE", "PRUNE", "PUITS",
    "QUEUE", "RADIO", "RAMER", "RECIT", "REGLE", "REINE", "REPAS", "RICHE",
    "ROCHE", "ROMAN", "RONDE", "ROSEE", "ROUGE", "ROUTE", "RUBIS", "RUCHE",
    "RUINE", "SABLE", "SAINT", "SALLE", "SALON", "SANTE", "SAUCE", "SAUTE",
    "SAVON", "SCENE", "SECHE", "SELLE", "SERIE", "SEULE", "SIEGE", "SIGNE",
    "SINGE", "SIROP", "SOEUR", "SOMME", "SONGE", "SORTE", "SOUCI", "SOUPE",
    "SOURD", "SPORT", "STADE", "STYLE", "SUCRE", "SUEUR", "SUITE", "SUPER",
    "TABLE", "TACHE", "TALON", "TAPIS", "TARTE", "TASSE", "TEMPS", "TENTE",
    "TERRE", "TEXTE", "THEME", "TIGRE", "TIRER", "TITRE", "TOILE", "TOMBE",
    "TONNE", "TORDU", "TOURS", "TRACE", "TRAIN", "TRAIT", "TRIBU", "TRONC",
    "TRUIE", "TUYAU", "UNION", "USAGE", "USINE", "VAGUE", "VALSE", "VENTE",
    "VERBE", "VERRE", "VERTE", "VESTE", "VIDEO", "VIEUX", "VIGNE", "VILLE",
    "VINGT", "VISER", "VITRE", "VOEUX", "VOILE", "VOLET", "ZEBRE",
]

# Garde-fou : on ne veut que des mots de 5 lettres, uniques, en majuscules.
WORDS_5 = sorted({w.upper() for w in WORDS_5 if len(w) == 5 and w.isalpha()})
