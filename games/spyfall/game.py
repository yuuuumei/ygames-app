# ============================================================
#  games/spyfall/game.py — Spyfall, recodé sur le contrat.
#
#  Info cachée INVERSÉE par rapport à l'Imposteur :
#    - les innocents connaissent le LIEU + leur RÔLE
#    - l'espion ne connaît NI lieu NI rôle... mais SAIT qu'il
#      est l'espion (contrairement à l'imposteur)
#
#  Deux chemins de victoire :
#    - les innocents votent et démasquent l'espion  → innocents gagnent
#    - l'espion devine le lieu (action `guess_location`) → espion gagne
#
#  Même moule que l'Imposteur → prouve que le contrat encaisse
#  deux logiques d'info cachée opposées.
# ============================================================
from __future__ import annotations

import random

from core.contract import Event, Game, GameMeta, Option, Player
from core.registry import register
from games.spyfall.data import ALL_LOCATIONS, pick_location


@register
class SpyfallGame(Game):
    meta = GameMeta(
        id="spyfall",
        name="Spyfall",
        icon="🕵️‍♂️",
        min_players=3,
        max_players=12,
        description=(
            "Tout le monde connaît le lieu et son rôle, sauf l'espion. "
            "Démasquez-le — ou, si vous êtes l'espion, devinez le lieu."
        ),
        options=[
            Option("n_spies", "Nombre d'espions", default=1),
            Option("allow_spy_guess", "L'espion peut deviner le lieu",
                   default=True),
        ],
    )

    # -- cycle de vie --------------------------------------------------
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        self.players: dict[str, Player] = {p.id: p for p in players}
        self.allow_spy_guess = bool(config.get("allow_spy_guess", True))

        n_spies = max(1, int(config.get("n_spies", 1)))
        n_spies = min(n_spies, len(players) - 1)

        self.location, roles_pool = pick_location()
        random.shuffle(roles_pool)

        ids = list(self.players.keys())
        self.spy_ids: set[str] = set(random.sample(ids, n_spies))

        #: rôle de chaque innocent (l'espion n'en a pas)
        self.role_of: dict[str, str] = {}
        r = 0
        for pid in ids:
            if pid not in self.spy_ids:
                self.role_of[pid] = roles_pool[r % len(roles_pool)]
                r += 1

        self.phase = "questions"      # questions → vote → over
        self.turn_order = ids[:]
        random.shuffle(self.turn_order)
        self.turn_idx = 0
        self.clues: dict[str, str] = {}
        self.votes: dict[str, str] = {}
        self.winners: list[str] = []
        self.end_reason: str = ""

        return [Event("game_started", {
            "first": self.players[self.turn_order[0]].name,
        })]

    def on_action(self, player_id: str, action: dict) -> list[Event]:
        kind = action.get("type")
        if kind == "clue":
            return self._clue(player_id, action.get("text", ""))
        if kind == "open_vote":
            return self._open_vote()
        if kind == "vote":
            return self._vote(player_id, action.get("target"))
        if kind == "guess_location":
            return self._guess_location(player_id, action.get("location"))
        return [Event("error", {"reason": f"action inconnue : {kind}"},
                      to=player_id)]

    def public_view(self, player_id: str) -> dict:
        is_spy = player_id in self.spy_ids
        roster = [
            {"id": p.id, "name": p.name, "avatar": p.avatar,
             "connected": p.connected, "has_clue": p.id in self.clues,
             "has_voted": p.id in self.votes}
            for p in self.players.values()
        ]
        view = {
            "phase": self.phase,
            "you_are_spy": is_spy,                       # ← l'espion SAIT
            "location": None if is_spy else self.location,
            "your_role": None if is_spy else self.role_of.get(player_id),
            "players": roster,
            "clues": dict(self.clues),
        }
        if is_spy:
            # l'espion voit la liste des lieux possibles (pour bluffer/deviner)
            view["possible_locations"] = ALL_LOCATIONS
        if self.phase == "questions":
            view["current_turn"] = self.players[
                self.turn_order[self.turn_idx]].name
        if self.phase == "over":
            view["reveal"] = {
                "spies": [self.players[i].name for i in self.spy_ids],
                "location": self.location,
                "reason": self.end_reason,
                "votes": {self.players[v].name: self.players[t].name
                          for v, t in self.votes.items()},
                "winners": [self.players[w].name for w in self.winners],
            }
        return view

    def is_over(self) -> bool:
        return self.phase == "over"

    def result(self) -> dict:
        return {
            "winners": self.winners,
            "spies": list(self.spy_ids),
            "location": self.location,
            "reason": self.end_reason,
        }

    # -- hooks desktop -------------------------------------------------
    def on_disconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = False
            if (self.phase == "questions"
                    and self.turn_order[self.turn_idx] == player_id):
                self._advance_turn()
        return [Event("player_disconnected", {"id": player_id})]

    def on_reconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = True
        return [Event("player_reconnected", {"id": player_id})]

    # -- interne -------------------------------------------------------
    def _clue(self, player_id: str, text: str) -> list[Event]:
        if self.phase != "questions":
            return [Event("error", {"reason": "pas la phase des questions"},
                          to=player_id)]
        if self.turn_order[self.turn_idx] != player_id:
            return [Event("error", {"reason": "ce n'est pas ton tour"},
                          to=player_id)]
        self.clues[player_id] = text.strip()
        ev = [Event("clue_given",
                    {"name": self.players[player_id].name, "text": text})]
        self._advance_turn()
        return ev

    def _advance_turn(self) -> None:
        n = len(self.turn_order)
        for _ in range(n):
            self.turn_idx = (self.turn_idx + 1) % n
            nxt = self.players[self.turn_order[self.turn_idx]]
            if nxt.connected and nxt.id not in self.clues:
                return

    def _open_vote(self) -> list[Event]:
        self.phase = "vote"
        return [Event("vote_opened", {})]

    def _vote(self, voter_id: str, target_id: str | None) -> list[Event]:
        if self.phase != "vote":
            return [Event("error", {"reason": "les votes ne sont pas ouverts"},
                          to=voter_id)]
        if target_id not in self.players:
            return [Event("error", {"reason": "cible invalide"}, to=voter_id)]
        self.votes[voter_id] = target_id
        events = [Event("vote_cast", {"name": self.players[voter_id].name})]

        voters = [p.id for p in self.players.values() if p.connected]
        if all(v in self.votes for v in voters):
            events += self._tally()
        return events

    def _tally(self) -> list[Event]:
        counts: dict[str, int] = {}
        for target in self.votes.values():
            counts[target] = counts.get(target, 0) + 1
        top = max(counts.values())
        accused = [pid for pid, c in counts.items() if c == top]

        caught = len(accused) == 1 and accused[0] in self.spy_ids
        if caught:
            self.winners = [p.id for p in self.players.values()
                            if p.id not in self.spy_ids]
            self.end_reason = "L'espion a été démasqué au vote."
        else:
            self.winners = list(self.spy_ids)
            self.end_reason = "Le vote n'a pas trouvé l'espion."

        self.phase = "over"
        return [Event("game_over", {
            "caught": caught,
            "accused": [self.players[a].name for a in accused],
        })]

    def _guess_location(self, player_id: str, location: str | None) -> list[Event]:
        if not self.allow_spy_guess:
            return [Event("error", {"reason": "option désactivée"},
                          to=player_id)]
        if player_id not in self.spy_ids:
            return [Event("error", {"reason": "seul l'espion peut deviner"},
                          to=player_id)]
        if self.phase == "over":
            return [Event("error", {"reason": "partie déjà finie"},
                          to=player_id)]

        correct = location == self.location
        if correct:
            self.winners = list(self.spy_ids)
            self.end_reason = f"L'espion a deviné le lieu ({self.location}) !"
        else:
            self.winners = [p.id for p in self.players.values()
                            if p.id not in self.spy_ids]
            self.end_reason = (f"L'espion s'est trompé de lieu "
                               f"(a dit « {location} »).")
        self.phase = "over"
        return [Event("spy_guessed", {"correct": correct, "guess": location})]
