# ============================================================
#  games/stairs/game.py — STAIRS en course, depuis la table.
#
#  Particularité par rapport aux autres jeux : la simulation ne
#  tourne PAS ici. Impossible d'arbitrer du 60 fps depuis Railway,
#  donc chaque joueur grimpe sa propre tour sur son PC et n'envoie
#  que son altitude, quelques fois par seconde.
#
#  Le serveur ne fait donc que trois choses : tenir le tableau de
#  bord commun, décider quand la course est finie, et désigner le
#  vainqueur. C'est un arbitre, pas un moteur.
# ============================================================
from __future__ import annotations

import time

from core.contract import Event, Game, GameMeta, Option, Player
from core.registry import register

#: temps laissé à tout le monde pour poser les doigts sur les touches
COUNTDOWN_S = 4


@register
class StairsRaceGame(Game):
    meta = GameMeta(
        id="stairs",
        name="STAIRS",
        icon="🏔️",
        min_players=2,
        max_players=12,
        description=(
            "Tout le monde grimpe en même temps, chacun sa tour. "
            "Le dernier à tenir — ou le plus haut monté — gagne."
        ),
        options=[
            Option("show_rivals", "Voir l'altitude des autres", default=True,
                   choices=[True, False]),
        ],
    )

    # -- cycle de vie --------------------------------------------------
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        self.players: dict[str, Player] = {p.id: p for p in players}
        self.show_rivals = bool(config.get("show_rivals", True))
        self.start_at = time.time() + COUNTDOWN_S
        self.phase = "racing"          # racing → over

        #: pid -> altitude courante, gemmes, et s'il est encore en vie
        self.runs: dict[str, dict] = {
            pid: {"score": 0, "coins": 0, "alive": True, "rank": 0}
            for pid in self.players
        }
        self.finish_order: list[str] = []   # ordre de chute (dernier = meilleur)
        self.winners: list[str] = []

        return [Event("game_started", {"countdown": COUNTDOWN_S})]

    def on_action(self, player_id: str, action: dict) -> list[Event]:
        kind = action.get("type")
        run = self.runs.get(player_id)
        if not run or self.phase == "over":
            return []

        if kind == "progress":
            if run["alive"]:
                # on ne fait jamais redescendre une altitude : un paquet en
                # retard ne doit pas effacer une marche déjà gagnée
                run["score"] = max(run["score"], int(action.get("score", 0)))
                run["coins"] = max(run["coins"], int(action.get("coins", 0)))
            return []

        if kind == "dead":
            return self._dead(player_id, action)

        return []

    def _dead(self, player_id: str, action: dict) -> list[Event]:
        run = self.runs[player_id]
        if not run["alive"]:
            return []
        run["score"] = max(run["score"], int(action.get("score", 0)))
        run["coins"] = max(run["coins"], int(action.get("coins", 0)))
        run["alive"] = False
        self.finish_order.append(player_id)

        events = [Event("stairs_fell", {
            "id": player_id,
            "name": self.players[player_id].name,
            "score": run["score"],
        })]

        if not any(r["alive"] for r in self.runs.values()):
            events += self._finish()
        return events

    def _finish(self) -> list[Event]:
        self.phase = "over"
        top = max((r["score"] for r in self.runs.values()), default=0)
        self.winners = [pid for pid, r in self.runs.items() if r["score"] == top]
        for i, row in enumerate(self._standings()):
            self.runs[row["id"]]["rank"] = row["rank"]
        return [Event("game_over", {"winners": self.winners})]

    # -- vues ----------------------------------------------------------
    def _standings(self) -> list[dict]:
        """Classement par altitude. Même score = même rang (1, 2, 2, 4…)."""
        ordered = sorted(
            self.players.values(),
            key=lambda p: (-self.runs[p.id]["score"], p.name.lower()),
        )
        out = []
        rank = 0
        prev = None
        for i, p in enumerate(ordered):
            r = self.runs[p.id]
            if r["score"] != prev:
                rank = i + 1
                prev = r["score"]
            out.append({
                "id": p.id, "name": p.name, "avatar": p.avatar,
                "score": r["score"], "coins": r["coins"],
                "alive": r["alive"], "connected": p.connected, "rank": rank,
            })
        return out

    def public_view(self, player_id: str) -> dict:
        me = self.runs.get(player_id, {})
        # une DURÉE, pas un timestamp : les horloges des joueurs diffèrent,
        # mais un compte à rebours restant est vrai pour tout le monde.
        starts_in = max(0.0, self.start_at - time.time())
        view = {
            "game": "stairs",
            "phase": self.phase,
            "starts_in_ms": int(starts_in * 1000),
            "show_rivals": self.show_rivals,
            "me": {
                "score": me.get("score", 0),
                "coins": me.get("coins", 0),
                "alive": me.get("alive", True),
            },
            "alive_count": sum(1 for r in self.runs.values() if r["alive"]),
            "total": len(self.runs),
        }
        if self.show_rivals or self.phase == "over":
            view["standings"] = self._standings()
        if self.phase == "over":
            view["winners"] = [self.players[w].name for w in self.winners]
        return view

    def is_over(self) -> bool:
        return self.phase == "over"

    def result(self) -> dict:
        return {"winners": self.winners,
                "standings": self._standings()}

    # -- hooks desktop -------------------------------------------------
    def on_disconnect(self, player_id: str) -> list[Event]:
        """Une course temps réel ne peut pas attendre : un joueur déconnecté
        ne peut plus grimper, sa run s'arrête à son altitude du moment.
        Sans ça, la partie resterait bloquée indéfiniment."""
        if player_id in self.players:
            self.players[player_id].connected = False
            if self.runs.get(player_id, {}).get("alive"):
                return self._dead(player_id, {})
        return []

    def on_reconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = True
        return []

    # -- stats ---------------------------------------------------------
    def stats_report(self) -> dict:
        if self.phase != "over":
            return {}
        winners = set(self.winners)
        by_id = {r["id"]: r for r in self._standings()}
        return {
            pid: {
                "won": pid in winners,
                "was_impostor": False,
                "voted_correctly": False,
                "gave_clue": False,
                "rank": by_id[pid]["rank"],
                "players": len(self.players),
                "score": by_id[pid]["score"],
            }
            for pid in self.players
        }

    def match_summary(self) -> dict:
        if self.phase != "over":
            return {}
        return {
            "race": True,
            "table": [
                {"name": r["name"], "score": r["score"],
                 "coins": r["coins"], "rank": r["rank"]}
                for r in self._standings()
            ],
        }
