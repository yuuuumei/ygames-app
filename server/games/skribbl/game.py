# ============================================================
#  games/skribbl/game.py — Dessine et fais deviner.
#
#  Déroulé d'un tour :
#   1) CHOOSING  — le dessinateur choisit parmi 3 mots (chrono court)
#   2) DRAWING   — il dessine, les autres devinent en tapant. Des lettres
#                  du mot se dévoilent au fil du temps.
#   3) REVEAL    — courte pause : le mot, qui a trouvé, les points gagnés
#  Puis on passe au dessinateur suivant. Quand tout le monde a dessiné,
#  la manche est finie ; après N manches, classement final.
#
#  Comme pour le Quiz, le serveur ne tient AUCUN timer : `public_view`
#  expose le temps restant, et le client envoie "advance" à l'expiration.
#  Le serveur revérifie l'échéance — un client pressé ne peut pas
#  écourter le tour de quelqu'un d'autre.
#
#  Les TRAITS DE DESSIN ne passent pas par `on_action` : le runner
#  resynchronise tous les joueurs à chaque action, ce qui serait
#  intenable à 20 traits/seconde. Ils transitent par un canal dédié
#  (cf. app.py) qui appelle `add_stroke` puis diffuse directement.
# ============================================================
from __future__ import annotations

import random
import time

from core.contract import Event, Game, GameMeta, Option, Player
from core.matching import is_correct, normalize
from core.registry import register
from games.skribbl.words import ALL_WORDS, BY_DIFFICULTY, DIFFICULTIES

CHOOSE_SECONDS = 15      # temps pour choisir son mot
REVEAL_SECONDS = 6       # pause entre deux tours
N_CHOICES = 3            # mots proposés au dessinateur

#: bonus d'ordre d'arrivée : le premier à trouver est mieux payé
ORDER_BONUS = [60, 35, 20, 10]


@register
class SkribblGame(Game):
    meta = GameMeta(
        id="skribbl",
        name="Skribbl",
        icon="🎨",
        min_players=2,
        max_players=12,
        description=(
            "Chacun son tour, un joueur dessine un mot secret et les "
            "autres tapent leurs propositions. Plus tu trouves vite, "
            "plus tu marques — et le dessinateur aussi."
        ),
        options=[
            Option("n_rounds", "Nombre de manches", default=3, min=1, max=8, step=1),
            Option("seconds", "Secondes par dessin", default=80,
                   min=30, max=180, step=10),
            Option("difficulty", "Difficulté des mots", default="aléatoire",
                   choices=["aléatoire", *DIFFICULTIES]),
        ],
    )

    # -- cycle de vie --------------------------------------------------
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        self.players: dict[str, Player] = {p.id: p for p in players}
        self.order: list[str] = list(self.players.keys())
        random.shuffle(self.order)

        self.n_rounds = max(1, int(config.get("n_rounds", 3)))
        self.duration = max(20, int(config.get("seconds", 80)))
        diff = config.get("difficulty")
        self.pool = list(BY_DIFFICULTY.get(diff, ALL_WORDS))
        random.shuffle(self.pool)
        self._pool_idx = 0

        self.round_no = 1
        self.turn_idx = 0
        self.scores: dict[str, int] = {pid: 0 for pid in self.players}
        self.chat: list[dict] = []
        self.winners: list[str] = []
        self.phase = "choosing"

        self._begin_turn()
        return [Event("game_started", {"rounds": self.n_rounds})]

    # -- tours ---------------------------------------------------------
    def _draw_words(self, n: int) -> list[str]:
        """Tire n mots sans répétition. On repioche le paquet s'il s'épuise."""
        out = []
        for _ in range(n):
            if self._pool_idx >= len(self.pool):
                random.shuffle(self.pool)
                self._pool_idx = 0
            out.append(self.pool[self._pool_idx])
            self._pool_idx += 1
        return out

    def _begin_turn(self) -> None:
        self.drawer = self.order[self.turn_idx]
        self.choices = self._draw_words(N_CHOICES)
        self.word = ""
        self.strokes: list[dict] = []
        self.found: dict[str, dict] = {}   # pid -> {"at", "points", "rank"}
        self.phase = "choosing"
        self.deadline = time.time() + CHOOSE_SECONDS

    def _start_drawing(self, word: str) -> list[Event]:
        self.word = word
        self.phase = "drawing"
        self.deadline = time.time() + self.duration
        self._say(None, f"{self.players[self.drawer].name} dessine…", "system")
        return [Event("skribbl_turn", {
            "drawer": self.drawer,
            "drawer_name": self.players[self.drawer].name,
            "length": len(word),
        })]

    def _end_turn(self, reason: str) -> list[Event]:
        """Clôt le tour de dessin : points du dessinateur, puis pause."""
        guessers = [p for p in self.players if p != self.drawer]
        if guessers and self.found:
            # le dessinateur est payé au prorata de ce qu'il a fait trouver,
            # et d'autant plus que ça a été trouvé vite
            share = len(self.found) / len(guessers)
            speed = sum(f["ratio"] for f in self.found.values()) / len(self.found)
            self.scores[self.drawer] += round(120 * share * (0.4 + 0.6 * speed))

        self.phase = "reveal"
        self.deadline = time.time() + REVEAL_SECONDS
        if reason == "all_found":
            self._say(None, "Tout le monde a trouvé !", "system")
        elif reason == "timeout":
            self._say(None, f"Le mot était « {self.word} »", "system")
        return [Event("skribbl_reveal", {
            "word": self.word,
            "found": [self.players[p].name for p in self.found],
        })]

    def _next_turn(self) -> list[Event]:
        self.turn_idx += 1
        if self.turn_idx >= len(self.order):
            self.turn_idx = 0
            self.round_no += 1
            if self.round_no > self.n_rounds:
                return self._finish()
        self._begin_turn()
        return [Event("skribbl_next", {"round": self.round_no})]

    def _finish(self) -> list[Event]:
        self.phase = "over"
        top = max(self.scores.values(), default=0)
        self.winners = [p for p, s in self.scores.items() if s == top and top > 0]
        return [Event("game_over", {"winners": self.winners})]

    # -- actions -------------------------------------------------------
    def on_action(self, player_id: str, action: dict) -> list[Event]:
        kind = action.get("type")
        if kind == "pick":
            return self._pick(player_id, str(action.get("word", "")))
        if kind == "guess":
            return self._guess(player_id, str(action.get("text", "")))
        if kind == "advance":
            return self._advance(player_id)
        if kind == "skip":
            return self._skip(player_id)
        return []

    def _pick(self, player_id: str, word: str) -> list[Event]:
        if player_id != self.drawer or self.phase != "choosing":
            return []
        if word not in self.choices:
            return []
        return self._start_drawing(word)

    def _guess(self, player_id: str, text: str) -> list[Event]:
        """Une proposition. Le dessinateur et ceux qui ont déjà trouvé
        ne devinent plus — sinon ils souffleraient la réponse au chat."""
        text = text.strip()[:80]
        if not text or self.phase != "drawing":
            return []
        if player_id == self.drawer or player_id in self.found:
            return []

        if is_correct(text, self.word):
            elapsed = self.duration - max(0.0, self.deadline - time.time())
            ratio = max(0.0, 1 - elapsed / self.duration)
            rank = len(self.found)
            bonus = ORDER_BONUS[rank] if rank < len(ORDER_BONUS) else 5
            points = round(60 + 240 * ratio) + bonus
            self.found[player_id] = {"at": time.time(), "points": points,
                                     "rank": rank + 1, "ratio": ratio}
            self.scores[player_id] += points
            self._say(None, f"{self.players[player_id].name} a trouvé !", "found")

            if len(self.found) >= len(self.players) - 1:
                return [Event("skribbl_found", {"id": player_id}), *self._end_turn("all_found")]
            return [Event("skribbl_found", {"id": player_id})]

        # raté : le message part au chat, visible de tous
        self._say(self.players[player_id].name, text, "guess")
        # « tu brûles » : réservé à celui qui a tapé, sinon c'est un indice offert
        if _is_close(text, self.word):
            return [Event("skribbl_close", {}, to=player_id)]
        return []

    def _advance(self, player_id: str) -> list[Event]:
        """Le chrono a expiré côté client. On revérifie l'échéance ici :
        sans ça, n'importe qui pourrait écourter le tour des autres."""
        if self.phase == "over" or time.time() < self.deadline - 1.0:
            return []
        if self.phase == "choosing":
            # personne n'a choisi : on impose le premier mot proposé
            return self._start_drawing(self.choices[0])
        if self.phase == "drawing":
            return self._end_turn("timeout")
        if self.phase == "reveal":
            return self._next_turn()
        return []

    def _skip(self, player_id: str) -> list[Event]:
        """Le dessinateur passe son tour (mot impossible, envie de changer)."""
        if player_id != self.drawer or self.phase not in ("choosing", "drawing"):
            return []
        self.word = self.word or self.choices[0]
        self._say(None, f"{self.players[player_id].name} a passé son tour.", "system")
        return self._end_turn("timeout")

    def _say(self, who: str | None, text: str, kind: str) -> None:
        self.chat.append({"who": who, "text": text, "kind": kind})
        del self.chat[:-60]   # on ne garde que la fin du fil

    # -- vues ----------------------------------------------------------
    def _masked(self) -> str:
        """Le mot vu par ceux qui cherchent : des tirets, et des lettres
        qui se dévoilent à mesure que le temps passe."""
        if not self.word:
            return ""
        letters = [i for i, c in enumerate(self.word) if c.isalpha()]
        # jusqu'à la moitié des lettres, révélées linéairement sur le tour
        elapsed = self.duration - max(0.0, self.deadline - time.time())
        share = min(1.0, max(0.0, elapsed / self.duration))
        n_reveal = int(len(letters) * 0.5 * share)
        # ordre stable : dépend du mot, pas du moment où on regarde
        rng = random.Random(self.word)
        shown = set(rng.sample(letters, min(n_reveal, len(letters))))
        return "".join(
            c if (not c.isalpha() or i in shown) else "_"
            for i, c in enumerate(self.word)
        )

    def _board(self) -> list[dict]:
        ordered = sorted(self.players.values(),
                         key=lambda p: (-self.scores[p.id], p.name.lower()))
        out, rank, prev = [], 0, None
        for i, p in enumerate(ordered):
            s = self.scores[p.id]
            if s != prev:
                rank, prev = i + 1, s
            out.append({
                "id": p.id, "name": p.name, "avatar": p.avatar,
                "score": s, "rank": rank, "connected": p.connected,
                "found": p.id in self.found,
                "is_drawer": p.id == self.drawer,
                "gained": self.found.get(p.id, {}).get("points", 0),
            })
        return out

    def public_view(self, player_id: str) -> dict:
        is_drawer = player_id == self.drawer
        knows = is_drawer or player_id in self.found or self.phase in ("reveal", "over")

        view = {
            "game": "skribbl",
            "phase": self.phase,
            "round": self.round_no,
            "n_rounds": self.n_rounds,
            "duration": self.duration,
            "ends_in_ms": max(0, int((self.deadline - time.time()) * 1000)),
            "drawer": self.drawer,
            "drawer_name": self.players[self.drawer].name,
            "is_drawer": is_drawer,
            "board": self._board(),
            "chat": self.chat[-40:],
            "found": player_id in self.found,
            "strokes": self.strokes,     # rejoue le dessin à la reconnexion
        }
        # LE point sensible : le mot ne sort que pour ceux qui y ont droit.
        view["word"] = self.word if knows else None
        view["masked"] = "" if knows else self._masked()
        view["length"] = len(self.word)
        if is_drawer and self.phase == "choosing":
            view["choices"] = self.choices
        if self.phase in ("reveal", "over"):
            view["reveal"] = {
                "word": self.word,
                "found": [
                    {"name": self.players[p].name, "points": f["points"]}
                    for p, f in sorted(self.found.items(), key=lambda kv: kv[1]["rank"])
                ],
            }
        if self.phase == "over":
            view["winners"] = [self.players[w].name for w in self.winners]
        return view

    def is_over(self) -> bool:
        return self.phase == "over"

    def result(self) -> dict:
        return {"winners": self.winners, "board": self._board()}

    # -- dessin (hors runner, cf. app.py) -------------------------------
    def add_stroke(self, player_id: str, stroke: dict) -> bool:
        """Ajoute un trait au tampon. Retourne False si l'émetteur n'a pas
        le droit de dessiner — app.py ne diffuse alors rien."""
        if player_id != self.drawer or self.phase != "drawing":
            return False
        kind = stroke.get("t")
        if kind == "clear":
            self.strokes = []
        elif kind == "undo":
            if self.strokes:
                self.strokes.pop()
        elif kind in ("line", "fill"):
            # on borne le tampon : un dessin très fourni ne doit pas gonfler
            # la vue envoyée aux reconnexions
            if len(self.strokes) < 4000:
                self.strokes.append(stroke)
        else:
            return False
        return True

    # -- hooks desktop -------------------------------------------------
    def on_disconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = False
            # si le dessinateur s'en va, le tour n'a plus de sens
            if player_id == self.drawer and self.phase in ("choosing", "drawing"):
                self._say(None,
                          f"{self.players[player_id].name} a quitté — tour annulé.",
                          "system")
                self.word = self.word or self.choices[0]
                return self._end_turn("timeout")
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
        by_id = {r["id"]: r for r in self._board()}
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
            "rounds": self.n_rounds,
            "table": [
                {"name": r["name"], "score": r["score"], "rank": r["rank"]}
                for r in self._board()
            ],
        }


def _is_close(guess: str, word: str) -> bool:
    """Proche mais pas bon : une lettre d'écart, ou le bon mot mal accordé."""
    a, b = normalize(guess), normalize(word)
    if not a or a == b:
        return False
    if abs(len(a) - len(b)) > 2:
        return False
    diff = sum(1 for x, y in zip(a, b) if x != y) + abs(len(a) - len(b))
    return diff <= 2
