# ============================================================
#  core/contract.py — Le contrat de jeu de yGAMES.
#
#  TOUT jeu de la plateforme implémente la classe `Game`.
#  Le core ne connaît aucun jeu en particulier : il ne parle
#  qu'à cette interface. Ajouter un jeu = écrire une classe
#  qui remplit ce contrat, sans jamais toucher au core.
# ============================================================
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable


# ------------------------------------------------------------
#  Types partagés
# ------------------------------------------------------------
@dataclass
class Player:
    """Un joueur dans une partie. `id` = player_token stable
    (survit aux reconnexions)."""
    id: str
    name: str
    avatar: str = "🙂"
    connected: bool = True


@dataclass
class Option:
    """Une option de config, rendue par le launcher avant le lancement
    (ex: nombre de manches, catégorie de mots)."""
    key: str
    label: str
    default: Any
    choices: list | None = None  # si présent → menu déroulant
    # pour les options numériques (sinon None → menu déroulant via choices)
    min: Any = None
    max: Any = None
    step: Any = None


@dataclass
class GameMeta:
    """Fiche d'identité du jeu, lue par le launcher pour l'afficher."""
    id: str
    name: str
    icon: str
    min_players: int
    max_players: int
    description: str = ""
    options: list[Option] = field(default_factory=list)


@dataclass
class Event:
    """Un événement ÉPHÉMÈRE diffusé aux clients (animation, feedback).
    Ne se rejoue pas à la reconnexion — pour l'état persistant, c'est
    `public_view` qui fait foi. `to` = "all" ou l'id d'un joueur."""
    type: str
    payload: dict = field(default_factory=dict)
    to: str = "all"


class GameContext:
    """Plomberie fournie PAR le core AU jeu. Le jeu s'en sert
    (timers, etc.) mais ne la réécrit jamais. En Phase 0 (démo
    terminal) les timers sont optionnels."""

    def __init__(self, set_timer: Callable | None = None):
        self._set_timer = set_timer

    def set_timer(self, seconds: float, on_expire: Callable) -> None:
        if self._set_timer:
            self._set_timer(seconds, on_expire)


# ------------------------------------------------------------
#  L'interface que tout jeu implémente
# ------------------------------------------------------------
class Game(ABC):
    #: fiche du jeu — à définir sur chaque sous-classe
    meta: GameMeta

    def __init__(self, ctx: GameContext | None = None):
        self.ctx = ctx or GameContext()

    # --- cycle de vie (chaque méthode mute l'état interne
    #     et retourne les events éphémères à diffuser) ---
    @abstractmethod
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        """Construit l'état initial. Appelé une fois au lancement."""

    @abstractmethod
    def on_action(self, player_id: str, action: dict) -> list[Event]:
        """Traite une action d'un joueur. Le core garantit que
        player_id est bien dans la partie."""

    @abstractmethod
    def public_view(self, player_id: str) -> dict:
        """L'état visible PAR CE JOUEUR. C'est ICI qu'on filtre
        l'info cachée : l'état complet ne quitte jamais le serveur."""

    @abstractmethod
    def is_over(self) -> bool:
        """True quand la partie est terminée."""

    @abstractmethod
    def result(self) -> dict:
        """Résultat final (gagnants, révélations) — valide une fois
        `is_over()` True."""

    # --- hooks desktop (blips réseau fréquents), optionnels ---
    def on_disconnect(self, player_id: str) -> list[Event]:
        return []

    def on_reconnect(self, player_id: str) -> list[Event]:
        return []

    # --- stats optionnelles : faits par joueur en fin de partie ---
    def stats_report(self) -> dict:
        """player_id -> {won, was_impostor, voted_correctly, gave_clue}.
        Vide par défaut (jeu sans progression)."""
        return {}

    def match_summary(self) -> dict:
        """Le récit de la partie, archivé dans l'historique des profils.
        Tout est révélé : la partie est finie, il n'y a plus rien à cacher.
        Vide par défaut (jeu sans détail intéressant à raconter)."""
        return {}
