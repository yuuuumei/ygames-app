import { useEffect, useMemo, useRef, useState } from "react";
import { CosmeticsMap, QuizView, QuizPlayer } from "./useSocial";
import Avatar from "./components/Avatar";
import { BorderedAvatar, VictoryEffect } from "./components/cosmetics";
import QuizPrompt from "./components/QuizPrompt";
import QuizTimeline from "./components/QuizTimeline";
import { sound } from "./sound";

type Props = {
  view: QuizView;
  myPlayerId: string;
  isHost: boolean;
  code: string;
  cosmetics: CosmeticsMap;
  myEffectVisual: any | null;
  mySignature: string;
  onAction: (action: object) => Promise<string | null>;
  onEnd: () => Promise<string | null>;
};

function PlayerAvatar({
  player,
  cosmetics,
  size,
}: {
  player: { id: string; name: string; avatar: string };
  cosmetics: CosmeticsMap;
  size: number;
}) {
  const cos = cosmetics[player.id];
  if (cos) {
    return (
      <BorderedAvatar
        url={player.avatar}
        name={player.name}
        size={size}
        visual={cos.border_visual}
        signature={cos.signature}
      />
    );
  }
  return <Avatar url={player.avatar} name={player.name} size={size} />;
}

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  left: `${4 + i * 6}%`,
  size: `${6 + (i % 3) * 3}px`,
  color: ["#7c6cff", "#22d3ee", "#43d17a", "#ffc24b", "#ff4d5e"][i % 5],
  dur: `${2.4 + (i % 4) * 0.4}s`,
  delay: `${i * 0.16}s`,
}));

export default function QuizScreen(props: Props) {
  const { view } = props;
  const [error, setError] = useState<string | null>(null);

  async function act(action: object) {
    setError(await props.onAction(action));
  }

  // --- sons pilotés par les transitions de phase (le classement gère les siens) ---
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    const phase = view.phase;
    if (prevPhase.current !== phase) {
      if (phase === "correcting") sound.play("vote_open");
      prevPhase.current = phase;
    }
  }, [view.phase]);

  const step = view.phase === "answering" ? 0 : view.phase === "correcting" ? 1 : 2;

  return (
    <div className="quiz">
      <div className="quiz-ambient" />
      <div className="quiz-vignette" />

      <div className="quiz-progress">
        <div className="quiz-code mono">QUIZ · {props.code}</div>
        <div className="quiz-steps">
          {[
            { num: "01", label: "Réponses" },
            { num: "02", label: "Correction" },
            { num: "03", label: "Classement" },
          ].map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.num} className="quiz-step-wrap">
                <div className={"quiz-step" + (active ? " active" : done ? " done" : "")}>
                  <span className="mono quiz-step-num">{s.num}</span>
                  <span className="quiz-step-label">{s.label}</span>
                </div>
                {i < 2 && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a4152" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
        <div className="quiz-scorepill muted small">
          {view.total} question{view.total > 1 ? "s" : ""}
        </div>
      </div>

      {error && <div className="quiz-error">{error}</div>}

      {view.phase === "answering" && <Answering {...props} act={act} />}
      {view.phase === "correcting" && <Correcting {...props} act={act} />}
      {view.phase === "over" && <Ranking {...props} />}
    </div>
  );
}

/* --------------------------- PHASE RÉPONSES --------------------------- */

function Answering({ view, isHost, act }: Props & { act: (a: object) => void }) {
  const q = view.question!;
  const qIndex = q.number - 1;
  const isTimeline = q.type === "timeline";
  const isPetitbac = q.type === "petitbac";
  const tlMin = q.media?.min ?? 1000;
  const tlMax = q.media?.max ?? 2025;
  const [text, setText] = useState("");
  const [year, setYear] = useState(Math.round((tlMin + tlMax) / 2));
  const [pbGrid, setPbGrid] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(view.duration ?? 30);

  const deadlineRef = useRef<number>(0);
  const advancedForRef = useRef<number>(-1);

  // (Re)cale le chrono local à chaque nouvelle question.
  useEffect(() => {
    setText("");
    setYear(Math.round((tlMin + tlMax) / 2));
    setPbGrid({});
    const left = view.time_left ?? view.duration ?? 30;
    deadlineRef.current = Date.now() + left * 1000;
    sound.play("your_turn");
  }, [q.number]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick local : chrono fluide + auto-advance piloté par l'hôte à 0.
  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => {
    const id = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0 && isHost && advancedForRef.current !== qIndex) {
        advancedForRef.current = qIndex;
        actRef.current({ type: "advance", from_index: qIndex });
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [qIndex, isHost]);

  const duration = view.duration ?? 30;
  const ratio = Math.max(0, Math.min(1, secondsLeft / duration));
  const urgent = secondsLeft <= 5;
  const answered = new Set(view.answered_ids ?? []);
  const submitted = view.your_answer != null;

  function submitValue(val: string) {
    const t = val.trim();
    if (!t) return;
    act({ type: "answer", index: qIndex, text: t });
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    submitValue(text);
  }

  return (
    <div className="quiz-answer">
      <div className="quiz-a-main">
        <div className="quiz-qhead">
          <span className="quiz-qcat">{q.category}</span>
          <span className="quiz-qnum mono">
            Question {q.number}<span className="muted"> / {view.total}</span>
          </span>
        </div>

        <div className={"quiz-timer" + (urgent ? " urgent" : "")}>
          <svg viewBox="0 0 120 120" className="quiz-timer-ring">
            <circle cx="60" cy="60" r="52" className="quiz-timer-track" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="quiz-timer-fill"
              style={{ strokeDashoffset: 327 * (1 - ratio) }}
            />
          </svg>
          <div className="quiz-timer-num mono">{secondsLeft}</div>
        </div>

        {!isTimeline && !isPetitbac && <QuizPrompt media={q.media ?? null} />}
        <div className="quiz-question">{q.text}</div>

        {isPetitbac ? (
          <div className="quiz-pb-answer">
            <div className="quiz-pb-letter">
              Lettre <span>{q.letter}</span>
            </div>
            <div className="quiz-pb-grid">
              {(q.categories ?? []).map((cat) => (
                <label key={cat} className="quiz-pb-field">
                  <span className="quiz-pb-cat">{cat}</span>
                  <input
                    value={pbGrid[cat] ?? ""}
                    onChange={(e) => setPbGrid((g) => ({ ...g, [cat]: e.currentTarget.value }))}
                    placeholder={`${q.letter}…`}
                    maxLength={40}
                  />
                </label>
              ))}
            </div>
            <button className="quiz-answer-send" onClick={() => submitValue(JSON.stringify(pbGrid))}>
              {submitted ? "Mettre à jour ma grille" : "Valider ma grille"}
            </button>
          </div>
        ) : isTimeline ? (
          <div className="quiz-timeline-answer">
            <QuizTimeline min={tlMin} max={tlMax} value={year} onChange={setYear} />
            <button className="quiz-answer-send" onClick={() => submitValue(String(year))}>
              {submitted ? "Modifier" : "Placer sur la frise"}
            </button>
          </div>
        ) : (
          <form className="quiz-answer-form" onSubmit={submit}>
            <div className={"quiz-answer-input" + (submitted ? " done" : "")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <input
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
                placeholder={submitted ? "Modifie ta réponse…" : "Ta réponse…"}
                maxLength={120}
                autoFocus
              />
            </div>
            <button className="quiz-answer-send" disabled={!text.trim()}>
              {submitted ? "Modifier" : "Valider"}
            </button>
          </form>
        )}

        {submitted && (
          <div className="quiz-your-answer">
            <span className="quiz-check">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#04140a" strokeWidth="4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            Réponse envoyée : <strong>{view.your_answer}</strong>
            <span className="muted small"> — tu peux encore la changer</span>
          </div>
        )}
      </div>

      <aside className="quiz-a-side">
        <div className="quiz-side-head">
          <span className="quiz-side-title">Ont répondu</span>
          <span className="muted small">
            {view.answered_count ?? 0}/{view.waiting_count ?? view.players.length}
          </span>
        </div>
        <div className="quiz-players">
          {view.players.map((p) => {
            const done = answered.has(p.id);
            return (
              <div
                key={p.id}
                className={"quiz-player-row" + (done ? " done" : "")}
                style={{ opacity: p.connected ? 1 : 0.45 }}
              >
                <Avatar url={p.avatar} name={p.name} size={30} />
                <span className="quiz-player-name">{p.name}</span>
                {done ? (
                  <span className="quiz-mini-check">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#04140a" strokeWidth="4">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : (
                  <span className="quiz-dots"><span /><span /><span /></span>
                )}
              </div>
            );
          })}
        </div>
        {isHost && (
          <button className="quiz-skip" onClick={() => act({ type: "advance", from_index: qIndex })}>
            Passer à la suite
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </aside>
    </div>
  );
}

/* -------------------------- PHASE CORRECTION -------------------------- */

function Correcting({ view, isHost, myPlayerId, act }: Props & { act: (a: object) => void }) {
  const c = view.correction!;
  const cIndex = c.number - 1;
  const last = c.number >= view.total;
  const vote = c.vote;

  // sons : flip à chaque réponse dévoilée, ping à l'ouverture d'un vote
  const prevReveal = useRef(c.revealed_count);
  const prevVote = useRef<string | null>(null);
  useEffect(() => {
    if (c.revealed_count > prevReveal.current) sound.play("your_turn");
    prevReveal.current = c.revealed_count;
    const vk = vote ? vote.player_id : null;
    if (vk && vk !== prevVote.current) sound.play("vote_open");
    prevVote.current = vk;
  }, [c.revealed_count, vote]);

  const votedPlayer = vote ? c.entries.find((e) => e.id === vote.player_id) : null;

  if (c.type === "petitbac") {
    return <PetitBacCorrection view={view} isHost={isHost} act={act} />;
  }

  return (
    <div className="quiz-correct">
      <div className="quiz-correct-head">
        <div className="quiz-qhead">
          <span className="quiz-qcat">{c.category}</span>
          <span className="quiz-qnum mono">
            Correction {c.number}<span className="muted"> / {view.total}</span>
          </span>
        </div>
        <div className="quiz-correct-q">{c.text}</div>
        <QuizPrompt media={c.media ?? null} size="small" />
        <div className="quiz-reference">
          <span className="quiz-ref-label">Réponse attendue</span>
          <span className="quiz-ref-value">{c.reference || "—"}</span>
        </div>
        {!isHost && !vote && (
          <div className="quiz-spectator-note muted small">
            L'hôte dévoile les réponses… ({c.revealed_count}/{c.answerable_count})
          </div>
        )}

        {c.type === "timeline" && (
          <QuizTimeline
            min={c.media?.min ?? 1000}
            max={c.media?.max ?? 2025}
            markers={[
              { year: parseInt(c.reference) || 0, label: "✓ " + c.reference, correct: true },
              ...c.entries
                .filter((e) => e.revealed && e.answer)
                .map((e) => ({ year: parseInt(e.answer!) || 0, label: e.name, me: e.id === myPlayerId })),
            ]}
          />
        )}
      </div>

      {/* --- panneau de vote « en cas de doute » --- */}
      {vote && (
        <div className="quiz-doubt">
          <div className="quiz-doubt-kicker">🤔 Au vote : cette réponse compte ?</div>
          <div className="quiz-doubt-answer">
            <span className="quiz-doubt-who">{votedPlayer?.name}</span>
            <span className="quiz-doubt-what">« {votedPlayer?.answer} »</span>
          </div>
          <div className="quiz-doubt-tally">
            <span className="quiz-doubt-yes">👍 {vote.yes}</span>
            <span className="quiz-doubt-no">👎 {vote.no}</span>
            <span className="muted small">
              {vote.voted_ids.length}/{vote.total} ont voté
            </span>
          </div>
          {vote.your_vote == null ? (
            <div className="quiz-doubt-btns">
              <button className="quiz-doubt-btn yes" onClick={() => act({ type: "doubt_vote", yes: true })}>
                Oui, ça compte
              </button>
              <button className="quiz-doubt-btn no" onClick={() => act({ type: "doubt_vote", yes: false })}>
                Non
              </button>
            </div>
          ) : (
            <div className="quiz-doubt-voted muted small">
              Ton vote : <strong>{vote.your_vote ? "Oui 👍" : "Non 👎"}</strong> — en attente des autres…
            </div>
          )}
        </div>
      )}

      <div className="quiz-answers-list">
        {c.entries.map((e) => {
          const hidden = e.has_answer && !e.revealed;
          const inVote = vote?.player_id === e.id;
          return (
            <div
              key={e.id}
              className={
                "quiz-answer-row" +
                (hidden ? " hidden" : "") +
                (inVote ? " voting" : "") +
                (e.grade === true ? " good" : e.grade === false ? " bad" : "")
              }
            >
              <Avatar url={e.avatar} name={e.name} size={34} />
              <div className="quiz-ar-body">
                <div className="quiz-ar-name">{e.name}</div>
                {hidden ? (
                  <div className="quiz-ar-answer masked">Réponse cachée…</div>
                ) : (
                  <div className={"quiz-ar-answer" + (!e.has_answer ? " empty" : "")}>
                    {e.has_answer ? e.answer : "— pas de réponse"}
                  </div>
                )}
              </div>

              {/* contrôles hôte : seulement sur une réponse dévoilée, hors vote */}
              {isHost && e.revealed && e.has_answer && !vote ? (
                <div className="quiz-grade-btns">
                  <button
                    className={"quiz-grade good" + (e.grade === true ? " on" : "") + (e.grade == null && e.suggested === true ? " suggest" : "")}
                    onClick={() => act({ type: "grade", index: cIndex, player_id: e.id, correct: true })}
                    data-tip={e.suggested === true ? "Bonne réponse (suggéré)" : "Bonne réponse"} aria-label={e.suggested === true ? "Bonne réponse (suggéré)" : "Bonne réponse"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                  <button
                    className={"quiz-grade bad" + (e.grade === false ? " on" : "") + (e.grade == null && e.suggested === false ? " suggest" : "")}
                    onClick={() => act({ type: "grade", index: cIndex, player_id: e.id, correct: false })}
                    data-tip={e.suggested === false ? "Mauvaise réponse (suggéré)" : "Mauvaise réponse"} aria-label={e.suggested === false ? "Mauvaise réponse (suggéré)" : "Mauvaise réponse"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    className="quiz-grade doubt"
                    onClick={() => act({ type: "open_doubt", index: cIndex, player_id: e.id })}
                    data-tip="En cas de doute : au vote !" aria-label="En cas de doute : au vote !"
                  >
                    🤔
                  </button>
                </div>
              ) : (
                <div className="quiz-grade-badge">
                  {e.grade === true && (
                    <span className="quiz-badge good">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  {e.grade === false && (
                    <span className="quiz-badge bad">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isHost ? (
        <div className="quiz-correct-foot">
          {!c.all_revealed ? (
            <button className="quiz-reveal-btn" onClick={() => act({ type: "reveal_next" })} disabled={!!vote}>
              Révéler la réponse suivante
              <span className="mono quiz-reveal-count">{c.revealed_count}/{c.answerable_count}</span>
            </button>
          ) : (
            <button className="quiz-next-correction" onClick={() => act({ type: "next_correction" })} disabled={!!vote}>
              {last ? "Voir le classement" : "Question suivante"}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="quiz-correct-foot muted small">
          {vote ? "Vote en cours…" : "En attente de l'hôte…"}
        </div>
      )}
    </div>
  );
}

/* ------------------- CORRECTION PETIT BAC (matrice) ------------------- */

function PetitBacCorrection({
  view,
  isHost,
  act,
}: {
  view: QuizView;
  isHost: boolean;
  act: (a: object) => void;
}) {
  const c = view.correction!;
  const cIndex = c.number - 1;
  const last = c.number >= view.total;
  const cats = c.categories ?? [];
  const players = c.pb_players ?? [];

  return (
    <div className="quiz-correct">
      <div className="quiz-correct-head">
        <div className="quiz-qhead">
          <span className="quiz-qcat">{c.category}</span>
          <span className="quiz-qnum mono">
            Correction {c.number}<span className="muted"> / {view.total}</span>
          </span>
        </div>
        <div className="quiz-pb-corr-letter">
          Petit Bac · lettre <span>{c.letter}</span>
        </div>
        {isHost ? (
          <div className="quiz-spectator-note muted small">Clique un mot pour le valider / invalider.</div>
        ) : (
          <div className="quiz-spectator-note muted small">L'hôte valide les mots…</div>
        )}
      </div>

      <div className="quiz-pb-matrix-wrap">
        <table className="quiz-pb-matrix">
          <thead>
            <tr>
              <th />
              {cats.map((cat) => (
                <th key={cat}>{cat}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td className="quiz-pb-pname">
                  <Avatar url={p.avatar} name={p.name} size={24} />
                  <span>{p.name}</span>
                </td>
                {cats.map((cat) => {
                  const word = (p.grid[cat] || "").trim();
                  const grade = p.grades[cat];
                  const cls = "quiz-pb-cell" + (grade === true ? " good" : grade === false ? " bad" : "");
                  if (!word) return <td key={cat} className="quiz-pb-cell empty">—</td>;
                  return (
                    <td key={cat} className={cls}>
                      {isHost ? (
                        <button
                          className="quiz-pb-cellbtn"
                          onClick={() =>
                            act({ type: "grade_cell", index: cIndex, player_id: p.id, category: cat, correct: grade !== true })
                          }
                        >
                          {word}
                        </button>
                      ) : (
                        <span>{word}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isHost ? (
        <div className="quiz-correct-foot">
          <button className="quiz-next-correction" onClick={() => act({ type: "next_correction" })}>
            {last ? "Voir le classement" : "Question suivante"}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="quiz-correct-foot muted small">En attente de l'hôte…</div>
      )}
    </div>
  );
}

/* --------------------------- PHASE CLASSEMENT --------------------------- */

function Ranking({ view, isHost, myPlayerId, cosmetics, myEffectVisual, mySignature, onEnd }: Props) {
  const ranking = view.ranking ?? [];
  const review = view.review ?? [];
  const meRow = ranking.find((r) => r.id === myPlayerId);
  const iWon = !!meRow && meRow.rank === 1 && meRow.score > 0;
  const [showReview, setShowReview] = useState(false);

  const byId = useMemo(() => {
    const m: Record<string, QuizPlayer> = {};
    view.players.forEach((p) => (m[p.id] = p));
    return m;
  }, [view.players]);

  // --- révélation progressive : du dernier au premier ---
  const n = ranking.length;
  const [revealed, setRevealed] = useState(0); // nb de rangs dévoilés (par le bas)
  useEffect(() => {
    if (revealed >= n) return;
    const delay = revealed === 0 ? 600 : 1200;
    const id = window.setTimeout(() => setRevealed((r) => r + 1), delay);
    return () => window.clearTimeout(id);
  }, [revealed, n]);

  const allShown = revealed >= n;
  const shownIdx = (i: number) => n - i <= revealed; // i = index best-first

  // sons rythmant la révélation
  const prevRevealed = useRef(0);
  useEffect(() => {
    if (revealed > prevRevealed.current && revealed < n) sound.play("your_turn");
    if (allShown && prevRevealed.current < n) {
      sound.play("reveal");
      window.setTimeout(() => sound.play(iWon ? "victory" : "defeat"), 500);
    }
    prevRevealed.current = revealed;
  }, [revealed, n, allShown, iWon]);

  return (
    <div className="quiz-over">
      <div
        className="quiz-flood"
        style={{
          background: `radial-gradient(80% 70% at 50% 0%, ${iWon ? "rgba(67,209,122,.2)" : "rgba(124,108,255,.18)"}, transparent 60%)`,
          opacity: allShown ? 1 : 0.25,
          transition: "opacity .6s",
        }}
      />
      {allShown &&
        (iWon ? (
          <div className="quiz-my-effect">
            <VictoryEffect visual={myEffectVisual} signature={mySignature} playKey={1} />
          </div>
        ) : (
          <div className="quiz-confetti">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                style={{
                  left: c.left,
                  width: c.size,
                  height: c.size,
                  background: c.color,
                  animationDuration: c.dur,
                  animationDelay: c.delay,
                }}
              />
            ))}
          </div>
        ))}

      <div className="quiz-over-inner">
        <div className="quiz-over-kicker">Classement final</div>
        <div className="quiz-over-title">
          {!allShown
            ? "Le verdict tombe…"
            : meRow
            ? iWon
              ? "🏆 Tu remportes le quiz !"
              : `Tu finis ${meRow.rank}ᵉ`
            : "Partie terminée"}
        </div>

        <div className="quiz-rank-reveal">
          {ranking.map((r, i) => {
            const shown = shownIdx(i);
            const p = byId[r.id];
            const isMe = r.id === myPlayerId;
            return (
              <div
                key={r.id}
                className={
                  "quiz-rr-row" +
                  (shown ? " in" : " out") +
                  (isMe ? " me" : "") +
                  (shown && r.rank === 1 ? " champ" : "")
                }
              >
                {shown ? (
                  <>
                    <span className={"quiz-rr-rank" + (r.rank <= 3 ? " medal-" + r.rank : "")}>
                      {r.rank === 1 ? "🏆" : r.rank}
                    </span>
                    <div className="quiz-rr-avatar">
                      {p ? (
                        <PlayerAvatar player={p} cosmetics={cosmetics} size={r.rank === 1 ? 46 : 36} />
                      ) : (
                        <Avatar name={r.name} size={36} />
                      )}
                    </div>
                    <span className="quiz-rr-name">{r.name}</span>
                    <span className="quiz-rr-score mono">
                      {r.score} pt{r.score > 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  <span className="quiz-rr-pending">•••</span>
                )}
              </div>
            );
          })}
        </div>

        {allShown && (
          <>
        <button className="quiz-review-toggle" onClick={() => setShowReview((s) => !s)}>
          {showReview ? "Masquer" : "Revoir"} les réponses
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            style={{ transform: showReview ? "rotate(180deg)" : "none", transition: "transform .2s" }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {showReview && (
          <div className="quiz-review">
            {review.map((row) => (
              <div key={row.number} className="quiz-review-q">
                <div className="quiz-review-qhead">
                  <span className="quiz-qcat">{row.category}</span>
                  <span className="quiz-review-qtext">{row.text}</span>
                </div>
                <div className="quiz-review-ref">
                  ✓ {row.reference || "—"}
                </div>
                <div className="quiz-review-answers">
                  {row.results.map((res) => (
                    <div
                      key={res.id}
                      className={"quiz-review-answer" + (res.correct ? " good" : " bad")}
                    >
                      <span className="quiz-review-who">{res.name}</span>
                      <span className="quiz-review-what">
                        {res.answer && res.answer !== "" ? res.answer : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="quiz-over-actions">
          {isHost ? (
            <button className="quiz-replay" onClick={onEnd}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
              Retour à la table
            </button>
          ) : (
            <p className="muted small">L'hôte va vous ramener à la table…</p>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
