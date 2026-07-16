# ============================================================
#  games/impostor/game.py — L'Imposteur, recodé sur le contrat.
#
#  Règle-clé (fidèle à l'ancien yGAMES) : l'imposteur ne SAIT
#  jamais qu'il est l'imposteur. Tout le monde reçoit un mot ;
#  celui de l'imposteur est subtilement différent. C'est le
#  filtrage dans `public_view` qui garantit ça côté serveur.
#
#  Déroulé : indices (chacun son tour) → vote → révélation.
# ============================================================
from __future__ import annotations

import random

from core.contract import Event, Game, GameMeta, Option, Player
from core.registry import register
from games.impostor.words import CATEGORIES, DIFFICULTIES, pick_pair


@register
class ImpostorGame(Game):
    meta = GameMeta(
        id="impostor",
        name="L'Imposteur",
        icon="🕵️",
        min_players=3,
        max_players=12,
        description=(
            "Tout le monde reçoit un mot. L'imposteur en a un légèrement "
            "différent — sans le savoir. Trouvez qui détonne."
        ),
        options=[
            Option("n_impostors", "Nombre d'imposteurs", default=1),
            Option("category", "Catégorie", default="aléatoire",
                   choices=["aléatoire", *CATEGORIES]),
            Option("difficulty", "Difficulté", default="aléatoire",
                   choices=["aléatoire", *DIFFICULTIES]),
        ],
    )

    # -- cycle de vie --------------------------------------------------
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        self.players: dict[str, Player] = {p.id: p for p in players}

        n_imp = max(1, int(config.get("n_impostors", 1)))
        n_imp = min(n_imp, len(players) - 1)  # jamais que des imposteurs
        cat = config.get("category")
        cat = None if cat in (None, "aléatoire") else cat
        diff = config.get("difficulty")
        diff = None if diff in (None, "aléatoire") else diff

        self.word_main, self.word_impostor, self.category, self.difficulty = \
            pick_pair(cat, diff)

        ids = list(self.players.keys())
        self.impostor_ids: set[str] = set(random.sample(ids, n_imp))

        #: le mot vu par chaque joueur (imposteur = mot légèrement différent)
        self.word_of: dict[str, str] = {
            pid: (self.word_impostor if pid in self.impostor_ids
                  else self.word_main)
            for pid in ids
        }

        self.phase = "clues"          # clues → vote → over
        self.turn_order = ids[:]
        random.shuffle(self.turn_order)
        self.turn_idx = 0
        self.clues: dict[str, str] = {}      # player_id → indice donné
        self.votes: dict[str, str] = {}      # votant → cible
        self.winners: list[str] = []

        return [Event("game_started", {
            "category": self.category,
            "difficulty": self.difficulty,
            "first": self.players[self.turn_order[0]].name,
        })]

    def on_action(self, player_id: str, action: dict) -> list[Event]:
        kind = action.get("type")
        if kind == "clue":
            return self._clue(player_id, action.get("text", ""))
        if kind == "open_vote":      # action de l'host
            return self._open_vote()
        if kind == "vote":
            return self._vote(player_id, action.get("target"))
        return [Event("error", {"reason": f"action inconnue : {kind}"},
                      to=player_id)]

    def public_view(self, player_id: str) -> dict:
        roster = [
            {"id": p.id, "name": p.name, "avatar": p.avatar,
             "connected": p.connected, "has_clue": p.id in self.clues,
             "has_voted": p.id in self.votes}
            for p in self.players.values()
        ]
        view = {
            "phase": self.phase,
            "category": self.category,
            "your_word": self.word_of.get(player_id),   # ← info filtrée ici
            "players": roster,
            "clues": dict(self.clues),
        }
        if self.phase == "clues":
            view["current_turn"] = self.players[
                self.turn_order[self.turn_idx]].name
        if self.phase == "over":
            # révélation générale — seulement une fois la partie finie
            view["reveal"] = {
                "impostors": [self.players[i].name for i in self.impostor_ids],
                "word_main": self.word_main,
                "word_impostor": self.word_impostor,
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
            "impostors": list(self.impostor_ids),
            "word_main": self.word_main,
            "word_impostor": self.word_impostor,
        }

    # -- hooks desktop -------------------------------------------------
    def on_disconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = False
            # si c'était son tour de donner un indice, on passe au suivant
            if (self.phase == "clues"
                    and self.turn_order[self.turn_idx] == player_id):
                self._advance_turn()
        return [Event("player_disconnected", {"id": player_id})]

    def on_reconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = True
        return [Event("player_reconnected", {"id": player_id})]

    # -- interne -------------------------------------------------------
    def _clue(self, player_id: str, text: str) -> list[Event]:
        if self.phase != "clues":
            return [Event("error", {"reason": "pas la phase des indices"},
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
                return  # prochain joueur connecté qui n'a pas encore parlé

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

        # les civils gagnent s'ils désignent un imposteur unique
        caught = len(accused) == 1 and accused[0] in self.impostor_ids
        if caught:
            self.winners = [p.id for p in self.players.values()
                            if p.id not in self.impostor_ids]
        else:
            self.winners = list(self.impostor_ids)

        self.phase = "over"
        return [Event("game_over", {
            "caught": caught,
            "accused": [self.players[a].name for a in accused],
        })]
