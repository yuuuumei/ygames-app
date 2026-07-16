# ============================================================
#  games/spyfall/data.py — Banque de lieux + rôles.
#
#  Chaque lieu a 6 à 8 rôles. À chaque partie : on tire un lieu,
#  on désigne l'espion, et chaque innocent reçoit un rôle du lieu.
#  L'espion ne reçoit NI lieu NI rôle.
#
#  NOTE : sous-ensemble pour la Phase 0. La banque complète de
#  l'ancien yGAMES (spyfall_data.py) sera portée ici.
# ============================================================
from __future__ import annotations

import random

LOCATIONS: dict[str, list[str]] = {
    "Hôpital": [
        "Médecin", "Infirmier", "Chirurgien", "Patient",
        "Brancardier", "Anesthésiste", "Pharmacien", "Stagiaire",
    ],
    "Casino": [
        "Croupier", "Joueur de poker", "Videur", "Serveur",
        "Manager", "Caissier", "Photographe sécurité", "Habitué",
    ],
    "Plage": [
        "Maître-nageur", "Touriste", "Vendeur de glaces", "Surfeur",
        "Photographe", "Vendeur de paréos", "Enfant", "Pêcheur",
    ],
    "Avion en vol": [
        "Commandant", "Co-pilote", "Steward", "Hôtesse de l'air",
        "Passager première classe", "Passager classe éco",
        "Mécanicien", "Touriste",
    ],
    "Restaurant gastronomique": [
        "Chef étoilé", "Serveur", "Sommelier", "Client",
        "Plongeur", "Maître d'hôtel", "Critique culinaire", "Pâtissier",
    ],
    "Studio de cinéma": [
        "Réalisateur", "Acteur principal", "Cameraman", "Maquilleuse",
        "Régisseur", "Producteur", "Scripte", "Figurant",
    ],
}

ALL_LOCATIONS = list(LOCATIONS.keys())


def pick_location() -> tuple[str, list[str]]:
    """Tire un lieu → (nom_du_lieu, liste_des_rôles_disponibles)."""
    loc = random.choice(ALL_LOCATIONS)
    return loc, LOCATIONS[loc][:]
