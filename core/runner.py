# ============================================================
#  core/runner.py — Le pilote de partie, AGNOSTIQUE du jeu.
#
#  Détient les joueurs, route les actions vers le jeu, et
#  resynchronise la vue de chaque joueur après chaque coup.
#  Il parle au monde extérieur uniquement via deux callbacks :
#     on_event(event)          → diffuser un event éphémère
#     on_sync(player_id, view) → pousser l'état à jour d'un joueur
#
#  En Phase 0 ces callbacks impriment dans le terminal.
#  En Phase 3 ils émettront des messages WebSocket.
#  LE JEU, LUI, NE CHANGE PAS. C'est tout l'intérêt.
# ============================================================
from __future__ import annotations

from typing import Callable

from core.contract import Event, Game, Player


class GameRunner:
    def __init__(
        self,
        game: Game,
        players: list[Player],
        on_event: Callable[[Event], None] | None = None,
        on_sync: Callable[[str, dict], None] | None = None,
    ):
        self.game = game
        self.players: dict[str, Player] = {p.id: p for p in players}
        self._on_event = on_event or (lambda e: None)
        self._on_sync = on_sync or (lambda pid, view: None)

    # -- démarrage --
    def start(self, config: dict | None = None) -> None:
        events = self.game.setup(list(self.players.values()), config or {})
        self._dispatch(events)
        self._sync_all()

    # -- une action d'un joueur ; retourne True si la partie est finie --
    def action(self, player_id: str, action: dict) -> bool:
        if player_id not in self.players:
            raise ValueError(f"joueur inconnu dans cette partie : {player_id}")
        events = self.game.on_action(player_id, action)
        self._dispatch(events)
        self._sync_all()
        return self.game.is_over()

    # -- déco / reco (desktop) --
    def disconnect(self, player_id: str) -> None:
        if player_id in self.players:
            self.players[player_id].connected = False
            self._dispatch(self.game.on_disconnect(player_id))
            self._sync_all()

    def reconnect(self, player_id: str) -> None:
        if player_id in self.players:
            self.players[player_id].connected = True
            self._dispatch(self.game.on_reconnect(player_id))
            self._sync_all()

    # -- interne --
    def _sync_all(self) -> None:
        for pid in self.players:
            self._on_sync(pid, self.game.public_view(pid))

    def _dispatch(self, events: list[Event]) -> None:
        for e in events:
            self._on_event(e)
