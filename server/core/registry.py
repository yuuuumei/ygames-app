# ============================================================
#  core/registry.py — Le registre des jeux disponibles.
#
#  Chaque jeu s'enregistre avec @register. Le launcher lit
#  ce registre pour afficher la liste des jeux ; le core
#  instancie le bon module quand l'host en choisit un.
#  → Ajouter un jeu ne demande AUCUNE modif ici.
# ============================================================
from __future__ import annotations

from core.contract import Game, GameMeta

_REGISTRY: dict[str, type[Game]] = {}


def register(cls: type[Game]) -> type[Game]:
    """Décorateur à poser sur une classe de jeu."""
    _REGISTRY[cls.meta.id] = cls
    return cls


def get(game_id: str) -> type[Game]:
    return _REGISTRY[game_id]


def all_meta() -> list[GameMeta]:
    return [cls.meta for cls in _REGISTRY.values()]
