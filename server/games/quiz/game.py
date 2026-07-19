# ============================================================
#  games/quiz/game.py — Quiz Culture (inspiré du KCulture).
#
#  Déroulé :
#   1) ANSWERING — une question à la fois, chrono. TOUT le monde
#      répond en texte libre (l'hôte joue aussi). On passe à la
#      suivante quand le temps est écoulé (chrono piloté par le
#      client hôte) OU quand tout le monde a répondu.
#   2) CORRECTING — l'hôte corrige question par question, réponse
#      par réponse (bon / pas bon). Les joueurs sont spectateurs.
#      Points FIXES par bonne réponse.
#   3) OVER — classement final.
#
#  Le serveur ne tient AUCUN timer : `public_view` expose le temps
#  restant (started_at + durée) et c'est le client hôte qui envoie
#  l'action "advance" à l'expiration. Robuste aux reconnexions.
# ============================================================
from __future__ import annotations

import json
import random
import time

import db
from core.contract import Event, Game, GameMeta, Option, Player
from core.registry import register
from games.quiz.matching import is_correct

POINTS_PER_CORRECT = 1  # points fixes par bonne réponse

# Petit Bac : lettres « jouables » en français (on retire K/Q/W/X/Y/Z).
PB_LETTERS = "ABCDEFGHIJLMNOPRSTUV"
PB_DEFAULT_CATS = ["Prénom", "Métier", "Sport", "Objet", "Pays", "Animal"]


def _parse(raw, default):
    """Parse un champ JSON stocké en base (media / alt_answers)."""
    if not raw:
        return default
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return default


def _year(s):
    """Extrait une année (int) d'une chaîne, ou None."""
    import re
    m = re.search(r"-?\d{1,4}", str(s or ""))
    return int(m.group()) if m else None


def _year_close(answer, reference, tol: int = 3) -> bool:
    a, r = _year(answer), _year(reference)
    return a is not None and r is not None and abs(a - r) <= tol


@register
class QuizGame(Game):
    meta = GameMeta(
        id="quiz",
        name="Quiz Culture",
        icon="🧠",
        min_players=2,
        max_players=12,
        description=(
            "Une question à la fois, chrono lancé. Tout le monde tape sa "
            "réponse — l'hôte aussi. À la fin, l'hôte corrige réponse par "
            "réponse et le classement tombe."
        ),
        options=[
            Option("n_questions", "Nombre de questions", default=8,
                   min=3, max=20, step=1),
            Option("category", "Catégorie", default="aléatoire",
                   choices=["aléatoire"]),  # complété dynamiquement (cf. game_sessions)
            Option("seconds", "Secondes par question", default=30,
                   min=10, max=90, step=5),
        ],
    )

    # -- cycle de vie --------------------------------------------------
    def setup(self, players: list[Player], config: dict) -> list[Event]:
        self.players: dict[str, Player] = {p.id: p for p in players}

        ids = list(self.players.keys())
        host = str(config.get("host_id", ""))
        self.host_id = host if host in self.players else ids[0]

        n = max(1, int(config.get("n_questions", 8)))
        cat = config.get("category")
        cat = None if cat in (None, "aléatoire") else cat

        #: [{id, category, question, answer}]
        self.questions: list[dict] = db.quiz_random(n, cat)
        self.total = len(self.questions)

        self.duration = max(5, int(config.get("seconds", 30)))

        self.phase = "answering"          # answering → correcting → over
        self.q_index = 0                  # question en cours (réponses)
        self.started_at = time.time()     # début de la question courante
        self.correction_index = 0         # question en cours (correction)

        #: q_index -> {player_id -> texte}
        self.answers: dict[int, dict[str, str]] = {}
        #: q_index -> {player_id -> bool} (jugement de l'hôte / du vote)
        self.grades: dict[int, dict[str, bool]] = {}
        #: q_index -> nb de réponses déjà dévoilées (drip-feed de la correction)
        self.reveal_counts: dict[int, int] = {}
        #: vote-doute en cours : {"q", "pid", "votes": {voter -> bool}} ou None
        self.doubt: dict | None = None

        # Petit Bac : lettre + catégories par question, et notes par cellule.
        self.pb_letter: dict[int, str] = {}
        self.pb_cats: dict[int, list[str]] = {}
        #: q_index -> {player_id -> {catégorie -> bool}}
        self.pb_grades: dict[int, dict[str, dict[str, bool]]] = {}
        for i, q in enumerate(self.questions):
            if q.get("type") == "petitbac":
                self.pb_letter[i] = random.choice(PB_LETTERS)
                m = _parse(q.get("media"), {}) or {}
                cats = m.get("categories") if isinstance(m, dict) else None
                self.pb_cats[i] = cats or PB_DEFAULT_CATS

        self.winners: list[str] = []

        if self.total == 0:
            # banque vide : rien à jouer, on termine proprement.
            self.phase = "over"
            return [Event("game_over", {"empty": True})]

        return [Event("game_started", {
            "total": self.total,
            "duration": self.duration,
        })]

    def on_action(self, player_id: str, action: dict) -> list[Event]:
        kind = action.get("type")
        if kind == "answer":
            return self._answer(player_id, action.get("text", ""),
                                action.get("index"))
        if kind == "advance":            # hôte / chrono écoulé
            return self._advance(player_id, action.get("from_index"))
        if kind == "reveal_next":        # hôte dévoile la réponse suivante
            return self._reveal_next(player_id)
        if kind == "grade":              # hôte corrige une réponse
            return self._grade(player_id, action.get("index"),
                               action.get("player_id"), action.get("correct"))
        if kind == "grade_cell":         # hôte note une cellule de Petit Bac
            return self._grade_cell(player_id, action.get("index"),
                                    action.get("player_id"),
                                    action.get("category"), action.get("correct"))
        if kind == "open_doubt":         # hôte : au vote sur une réponse
            return self._open_doubt(player_id, action.get("index"),
                                    action.get("player_id"))
        if kind == "doubt_vote":         # un participant vote oui/non
            return self._doubt_vote(player_id, action.get("yes"))
        if kind == "next_correction":    # hôte passe à la question suivante
            return self._next_correction(player_id)
        return [Event("error", {"reason": f"action inconnue : {kind}"},
                      to=player_id)]

    def public_view(self, player_id: str) -> dict:
        is_host = player_id == self.host_id
        connected = [p for p in self.players.values() if p.connected]
        roster = [
            {"id": p.id, "name": p.name, "avatar": p.avatar,
             "connected": p.connected}
            for p in self.players.values()
        ]
        view = {
            "game": "quiz",              # discriminant pour le routeur client
            "phase": self.phase,
            "total": self.total,
            "is_host": is_host,
            "host_id": self.host_id,
            "players": roster,
            "scores": self._scores(),
        }

        if self.phase == "answering":
            q = self.questions[self.q_index]
            answered = self.answers.get(self.q_index, {})
            view["question"] = {
                "number": self.q_index + 1,
                "category": q["category"],
                "text": q["question"],
                "type": q.get("type", "text"),
                "media": _parse(q.get("media"), None),
            }
            if q.get("type") == "petitbac":
                view["question"]["letter"] = self.pb_letter.get(self.q_index, "")
                view["question"]["categories"] = self.pb_cats.get(
                    self.q_index, PB_DEFAULT_CATS)
            view["duration"] = self.duration
            view["time_left"] = round(
                max(0.0, self.duration - (time.time() - self.started_at)), 1)
            view["your_answer"] = answered.get(player_id)
            view["answered_ids"] = list(answered.keys())
            view["answered_count"] = len(answered)
            view["waiting_count"] = len(connected)

        elif self.phase == "correcting":
            ci = self.correction_index
            q = self.questions[ci]
            answered = self.answers.get(ci, {})
            graded = self.grades.get(ci, {})
            # ordre de dévoilement : uniquement ceux qui ont vraiment répondu
            answered_order = [p.id for p in self.players.values()
                              if (answered.get(p.id) or "").strip()]
            rc = self.reveal_counts.get(ci, 0)
            revealed_ids = set(answered_order[:rc])

            alts = _parse(q.get("alt_answers"), [])
            if isinstance(alts, str):
                alts = [a.strip() for a in alts.split(",") if a.strip()]

            entries = []
            for p in self.players.values():
                ans = (answered.get(p.id) or "").strip()
                has_answer = bool(ans)
                # une réponse non-vide reste cachée tant qu'elle n'est pas dévoilée
                shown = (not has_answer) or (p.id in revealed_ids)
                entry = {
                    "id": p.id, "name": p.name, "avatar": p.avatar,
                    "answer": ans if shown else None,
                    "has_answer": has_answer,
                    "revealed": shown,
                    "grade": graded.get(p.id),   # True/False/None
                }
                # suggestion d'auto-correction : AIDE l'hôte, ne décide pas.
                # Réservée à l'hôte, et seulement sur une réponse déjà dévoilée.
                if is_host and shown and has_answer:
                    if q.get("type") == "timeline":
                        entry["suggested"] = _year_close(ans, q["answer"])
                    else:
                        entry["suggested"] = is_correct(ans, q["answer"], alts)
                entries.append(entry)

            correction = {
                "number": ci + 1,
                "category": q["category"],
                "text": q["question"],
                "reference": q["answer"],
                "type": q.get("type", "text"),
                "media": _parse(q.get("media"), None),
                "entries": entries,
                "revealed_count": rc,
                "answerable_count": len(answered_order),
                "all_revealed": rc >= len(answered_order),
            }
            # vote-doute actif sur cette question ?
            if self.doubt and self.doubt["q"] == ci:
                votes = self.doubt["votes"]
                connected = [p.id for p in self.players.values() if p.connected]
                correction["vote"] = {
                    "player_id": self.doubt["pid"],
                    "yes": sum(1 for v in votes.values() if v),
                    "no": sum(1 for v in votes.values() if not v),
                    "voted_ids": list(votes.keys()),
                    "your_vote": votes.get(player_id),  # True / False / None
                    "total": len(connected),
                }
            # Petit Bac : on attache la matrice (le client ignore alors `entries`).
            if q.get("type") == "petitbac":
                correction.update(self._pb_correction(ci))
            view["correction"] = correction

        elif self.phase == "over":
            view["ranking"] = self._ranking()
            view["review"] = self._review()

        return view

    def is_over(self) -> bool:
        return self.phase == "over"

    def result(self) -> dict:
        return {
            "winners": self.winners,
            "ranking": self._ranking(),
        }

    def stats_report(self) -> dict:
        if self.phase != "over":
            return {}
        winners = set(self.winners)
        return {
            pid: {
                "won": pid in winners,
                "was_impostor": False,
                "voted_correctly": False,
                "gave_clue": False,
            }
            for pid in self.players
        }

    # -- hooks desktop -------------------------------------------------
    def on_disconnect(self, player_id: str) -> list[Event]:
        events: list[Event] = [Event("player_disconnected", {"id": player_id})]
        if player_id in self.players:
            self.players[player_id].connected = False
            # si tout le monde a répondu une fois ce joueur parti, on avance
            if self.phase == "answering":
                events += self._maybe_auto_advance()
            # un vote-doute peut se débloquer si le partant était le dernier attendu
            elif self.phase == "correcting" and self.doubt:
                connected = [p.id for p in self.players.values() if p.connected]
                if connected and all(v in self.doubt["votes"] for v in connected):
                    events += self._resolve_doubt()
        return events

    def on_reconnect(self, player_id: str) -> list[Event]:
        if player_id in self.players:
            self.players[player_id].connected = True
        return [Event("player_reconnected", {"id": player_id})]

    # -- interne -------------------------------------------------------
    def _answer(self, player_id: str, text: str, index) -> list[Event]:
        if self.phase != "answering":
            return [Event("error", {"reason": "ce n'est pas le moment de répondre"},
                          to=player_id)]
        if index is not None and int(index) != self.q_index:
            # réponse tardive pour une question déjà passée : on ignore
            return []
        self.answers.setdefault(self.q_index, {})[player_id] = text.strip()
        events: list[Event] = [Event("answer_received",
                                     {"id": player_id}, to=self.host_id)]
        events += self._maybe_auto_advance()
        return events

    def _maybe_auto_advance(self) -> list[Event]:
        """Avance si tous les joueurs connectés ont répondu à la question."""
        answered = self.answers.get(self.q_index, {})
        connected = [p.id for p in self.players.values() if p.connected]
        if connected and all(pid in answered for pid in connected):
            return self._go_next_question()
        return []

    def _advance(self, player_id: str, from_index) -> list[Event]:
        if player_id != self.host_id:
            return [Event("error", {"reason": "seul l'hôte pilote le chrono"},
                          to=player_id)]
        if self.phase != "answering":
            return []
        # garde d'idempotence : ne saute pas deux fois la même question
        if from_index is not None and int(from_index) != self.q_index:
            return []
        return self._go_next_question()

    def _go_next_question(self) -> list[Event]:
        self.q_index += 1
        if self.q_index >= self.total:
            self.phase = "correcting"
            self.correction_index = 0
            return [Event("correction_started", {})]
        self.started_at = time.time()
        return [Event("question_started", {"number": self.q_index + 1})]

    def _answered_order(self, ci: int) -> list[str]:
        """Les joueurs (dans l'ordre) ayant réellement répondu à la question ci."""
        answered = self.answers.get(ci, {})
        return [p.id for p in self.players.values()
                if (answered.get(p.id) or "").strip()]

    def _reveal_next(self, player_id: str) -> list[Event]:
        if player_id != self.host_id or self.phase != "correcting":
            return []
        ci = self.correction_index
        rc = self.reveal_counts.get(ci, 0)
        total = len(self._answered_order(ci))
        if rc >= total:
            return []
        self.reveal_counts[ci] = rc + 1
        pid = self._answered_order(ci)[rc]
        return [Event("answer_revealed", {"index": ci, "player_id": pid})]

    def _grade(self, player_id: str, index, target_id, correct) -> list[Event]:
        if player_id != self.host_id:
            return [Event("error", {"reason": "seul l'hôte corrige"},
                          to=player_id)]
        if self.phase != "correcting":
            return []
        if index is None or int(index) != self.correction_index:
            return []
        if target_id not in self.players:
            return []
        self.grades.setdefault(self.correction_index, {})[target_id] = bool(correct)
        return [Event("graded", {"index": self.correction_index,
                                 "player_id": target_id,
                                 "correct": bool(correct)})]

    # -- Petit Bac -----------------------------------------------------
    def _pb_correction(self, ci: int) -> dict:
        """Données de correction Petit Bac (matrice joueurs × catégories)."""
        cats = self.pb_cats.get(ci, PB_DEFAULT_CATS)
        answered = self.answers.get(ci, {})
        cell_grades = self.pb_grades.get(ci, {})
        pb_players = []
        for p in self.players.values():
            grid = _parse(answered.get(p.id), {}) or {}
            if not isinstance(grid, dict):
                grid = {}
            pb_players.append({
                "id": p.id, "name": p.name, "avatar": p.avatar,
                "grid": {c: str(grid.get(c, "")).strip() for c in cats},
                "grades": {c: cell_grades.get(p.id, {}).get(c) for c in cats},
            })
        return {
            "letter": self.pb_letter.get(ci, ""),
            "categories": cats,
            "pb_players": pb_players,
            "all_revealed": True,  # pas de drip : on affiche toute la grille
        }

    def _grade_cell(self, player_id, index, target_id, category, correct) -> list[Event]:
        if player_id != self.host_id or self.phase != "correcting":
            return []
        if index is None or int(index) != self.correction_index:
            return []
        if target_id not in self.players or not category:
            return []
        self.pb_grades.setdefault(self.correction_index, {}) \
            .setdefault(target_id, {})[str(category)] = bool(correct)
        return [Event("cell_graded", {
            "index": self.correction_index, "player_id": target_id,
            "category": category, "correct": bool(correct)})]

    def _open_doubt(self, player_id: str, index, target_id) -> list[Event]:
        """L'hôte lance un vote oui/non de tous les participants sur une réponse."""
        if player_id != self.host_id or self.phase != "correcting":
            return []
        if index is None or int(index) != self.correction_index:
            return []
        # la réponse doit exister et être déjà dévoilée
        if target_id not in self._answered_order(self.correction_index):
            return []
        rc = self.reveal_counts.get(self.correction_index, 0)
        if target_id not in set(self._answered_order(self.correction_index)[:rc]):
            return []
        self.doubt = {"q": self.correction_index, "pid": target_id, "votes": {}}
        return [Event("doubt_opened",
                      {"index": self.correction_index, "player_id": target_id})]

    def _doubt_vote(self, player_id: str, yes) -> list[Event]:
        if self.phase != "correcting" or not self.doubt:
            return []
        if player_id not in self.players:
            return []
        self.doubt["votes"][player_id] = bool(yes)
        events: list[Event] = [Event("doubt_vote_cast", {"id": player_id})]
        # tout le monde (connecté) a voté → on tranche
        connected = [p.id for p in self.players.values() if p.connected]
        if connected and all(v in self.doubt["votes"] for v in connected):
            events += self._resolve_doubt()
        return events

    def _resolve_doubt(self) -> list[Event]:
        votes = self.doubt["votes"]
        yes = sum(1 for v in votes.values() if v)
        no = sum(1 for v in votes.values() if not v)
        correct = yes >= no  # égalité = bénéfice du doute
        ci, pid = self.doubt["q"], self.doubt["pid"]
        self.grades.setdefault(ci, {})[pid] = correct
        self.doubt = None
        return [Event("doubt_resolved",
                      {"index": ci, "player_id": pid,
                       "correct": correct, "yes": yes, "no": no})]

    def _next_correction(self, player_id: str) -> list[Event]:
        if player_id != self.host_id:
            return [Event("error", {"reason": "seul l'hôte pilote la correction"},
                          to=player_id)]
        if self.phase != "correcting":
            return []
        self.doubt = None  # un vote en cours est abandonné en changeant de question
        self.correction_index += 1
        if self.correction_index >= self.total:
            return self._finish()
        return [Event("correction_next", {"number": self.correction_index + 1})]

    def _finish(self) -> list[Event]:
        scores = self._scores()
        top = max(scores.values()) if scores else 0
        self.winners = [pid for pid, s in scores.items() if s == top] if top > 0 else []
        self.phase = "over"
        return [Event("game_over", {"winners": self.winners})]

    # -- calculs -------------------------------------------------------
    def _scores(self) -> dict[str, int]:
        scores = {pid: 0 for pid in self.players}
        # questions classiques : 1 point par bonne réponse
        for grds in self.grades.values():
            for pid, ok in grds.items():
                if ok and pid in scores:
                    scores[pid] += POINTS_PER_CORRECT
        # Petit Bac : 1 point par cellule valide
        for cells in self.pb_grades.values():
            for pid, grid in cells.items():
                if pid in scores:
                    scores[pid] += sum(1 for ok in grid.values() if ok)
        return scores

    def _ranking(self) -> list[dict]:
        scores = self._scores()
        ordered = sorted(self.players.values(),
                         key=lambda p: (-scores[p.id], p.name.lower()))
        ranking = []
        rank = 0
        prev = None
        for i, p in enumerate(ordered):
            s = scores[p.id]
            if s != prev:
                rank = i + 1
                prev = s
            ranking.append({
                "id": p.id, "name": p.name, "avatar": p.avatar,
                "score": s, "rank": rank,
            })
        return ranking

    def _review(self) -> list[dict]:
        review = []
        for i, q in enumerate(self.questions):
            answered = self.answers.get(i, {})
            graded = self.grades.get(i, {})
            if q.get("type") == "petitbac":
                cells = self.pb_grades.get(i, {})
                results = []
                for p in self.players.values():
                    grid = _parse(answered.get(p.id), {}) or {}
                    g = cells.get(p.id, {})
                    valid = [str(grid.get(c, "")).strip()
                             for c in self.pb_cats.get(i, PB_DEFAULT_CATS)
                             if g.get(c) and str(grid.get(c, "")).strip()]
                    results.append({"id": p.id, "name": p.name,
                                    "answer": ", ".join(valid) or "—",
                                    "correct": len(valid) > 0})
                review.append({
                    "number": i + 1, "category": q["category"],
                    "text": f"Petit Bac · lettre {self.pb_letter.get(i, '?')}",
                    "reference": "", "results": results,
                })
                continue
            review.append({
                "number": i + 1,
                "category": q["category"],
                "text": q["question"],
                "reference": q["answer"],
                "results": [
                    {"id": p.id, "name": p.name,
                     "answer": answered.get(p.id),
                     "correct": bool(graded.get(p.id))}
                    for p in self.players.values()
                ],
            })
        return review
