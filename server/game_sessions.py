"""Le pont entre les lobbies et le moteur de jeu (core/ + games/).

Une partie vit DANS un lobby : lobby code -> session. La session tient le
GameRunner et la correspondance user yGAMES <-> Player du contrat.

Le GameRunner parle au monde via deux callbacks (on_event / on_sync) ;
app.py les branche sur les WebSockets. Ici, zéro réseau : de la logique.
"""

from core.contract import Player
from core.runner import GameRunner
from core import registry

# Importer un jeu = il s'enregistre dans le registre (décorateur @register).
import games.impostor.game  # noqa: F401
import games.spyfall.game  # noqa: F401

# lobby code -> session
# session = {"game_id": str, "runner": GameRunner, "user_ids": [int]}
sessions: dict[str, dict] = {}


def list_games() -> list[dict]:
    """Les fiches des jeux disponibles, sérialisées pour le client."""
    return [
        {
            "id": m.id,
            "name": m.name,
            "icon": m.icon,
            "min_players": m.min_players,
            "max_players": m.max_players,
            "description": m.description,
            "options": [
                {
                    "key": o.key,
                    "label": o.label,
                    "default": o.default,
                    "choices": o.choices,
                }
                for o in m.options
            ],
        }
        for m in registry.all_meta()
    ]


def start(lobby: dict, game_id: str, config: dict, on_event, on_sync) -> dict | None:
    """Démarre une partie pour les membres CONNECTÉS du lobby.
    Renvoie None si ok, sinon un dict {"error": ...}."""
    code = lobby["code"]
    if code in sessions:
        return {"error": "Une partie est déjà en cours."}

    try:
        game_cls = registry.get(game_id)
    except KeyError:
        return {"error": "Jeu inconnu."}

    members = [m for m in lobby["members"].values() if m["connected"]]
    n = len(members)
    if n < game_cls.meta.min_players:
        return {"error": f"Il faut au moins {game_cls.meta.min_players} joueurs ({n} connectés)."}
    if n > game_cls.meta.max_players:
        return {"error": f"Maximum {game_cls.meta.max_players} joueurs pour ce jeu."}

    # user yGAMES -> Player du contrat. Player.id = str(user_id) : stable,
    # survit aux reconnexions (le token de partie du contrat).
    players = [
        Player(
            id=str(m["user"]["id"]),
            name=m["user"]["display_name"],
            avatar=m["user"].get("avatar_url") or "🙂",
        )
        for m in members
    ]

    runner = GameRunner(game_cls(), players, on_event=on_event, on_sync=on_sync)
    sessions[code] = {
        "game_id": game_id,
        "runner": runner,
        "user_ids": [m["user"]["id"] for m in members],
    }
    runner.start(config)
    return None


def get(code: str) -> dict | None:
    return sessions.get(code)


def end(code: str) -> None:
    sessions.pop(code, None)


def view_for(code: str, user_id: int) -> dict | None:
    """La vue actuelle d'un joueur (resync au montage / à la reconnexion)."""
    session = sessions.get(code)
    if not session or user_id not in session["user_ids"]:
        return None
    return session["runner"].game.public_view(str(user_id))
