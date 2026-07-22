import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "./components/Avatar";
import { sound } from "./sound";

type Ask = (event: string, data?: object) => Promise<any>;

type FriendMini = { display_name: string; avatar_url: string | null };
type DailyMeta = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  finished: boolean;
  solved: boolean;
  score: number;
  streak: number;
  friends_done: number;
  friends: FriendMini[];
  my_rank: number | null;
  total_done: number;
};

type WordleRow = { word: string; score: ("correct" | "present" | "absent")[] };
type WikiToken = { t: "w"; v: string; hit?: boolean } | { t: "h"; n: number } | { t: "s"; v: string };
type WikiGuess = { word: string; count: number };

type DailyState = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  solved: boolean;
  finished: boolean;
  rows?: WordleRow[];
  length?: number;
  max_tries?: number;
  answer?: string | null;
  title?: WikiToken[];
  text?: WikiToken[];
  guesses?: WikiGuess[];
  tries?: number;
  url?: string | null;
};

type ScoreRow = {
  id: number;
  display_name: string;
  avatar_url: string | null;
  solved: boolean;
  score: number;
};

/* --- helpers --- */
function frDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  return d
    .toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()
    .replace(/\./g, "");
}
/** Temps restant avant le prochain défi (minuit UTC). */
function untilMidnightUTC(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = next - now.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, "0")} h ${String(m).padStart(2, "0")} min`;
}

export default function DailyScreen({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [list, setList] = useState<DailyMeta[] | null>(null);
  const [day, setDay] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const r = await ask("daily_list");
    if (r?.dailies) {
      setList(r.dailies);
      setDay(r.day);
    }
  }, [ask]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  if (picked) {
    return (
      <DailyGame
        ask={ask}
        game={picked}
        day={day}
        meta={list?.find((d) => d.id === picked)}
        onBack={() => {
          setPicked(null);
          loadList();
        }}
      />
    );
  }

  const done = (list ?? []).filter((d) => d.finished).length;
  const total = (list ?? []).length;
  const globalStreak = Math.max(0, ...(list ?? []).map((d) => d.streak));
  const allDone = total > 0 && done === total;

  return (
    <div className="dl">
      <div className="ambient" />

      <div className="dl-head">
        <button className="dl-back" onClick={onClose} data-tip="Retour" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="dl-head-text">
          <h1 className="dl-h1">Défis du jour</h1>
          <p className="dl-sub">En solo, un défi par jour — le même pour tout le monde.</p>
        </div>
        <div className="dl-head-right">
          <div className="dl-date mono">{frDate(day)}</div>
          {globalStreak > 0 && (
            <span className="dl-streak-pill">
              <span className="dl-flame">🔥</span>
              <span>
                Série de <b className="mono">{globalStreak}</b> jours
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="dl-body">
        {list === null ? (
          <div className="dl-cards">
            {[0, 1].map((i) => (
              <div key={i} className="dl-skel" />
            ))}
          </div>
        ) : (
          <>
            {total > 0 && (
              <div className={"dl-ribbon" + (allDone ? " done" : "")}>
                <span className="dl-ribbon-icon">{allDone ? "🎉" : done > 0 ? "⚡" : "☀️"}</span>
                <div className="dl-ribbon-text">
                  <div className="dl-ribbon-title">
                    {allDone
                      ? "Journée terminée. Reviens demain !"
                      : done > 0
                      ? `Plus qu'${total - done === 1 ? "un défi" : `${total - done} défis`} à faire`
                      : `${total} défi${total > 1 ? "s" : ""} t'attende${total > 1 ? "nt" : ""} aujourd'hui`}
                  </div>
                  <div className="dl-ribbon-sub">
                    {allDone
                      ? "Ta série continue. De nouveaux défis à minuit."
                      : "Joue-les avant minuit pour garder ta série."}
                  </div>
                </div>
                <div className="dl-dots">
                  {(list ?? []).map((d) => (
                    <span key={d.id} className={"dl-dot" + (d.finished ? " ok" : "")}>
                      {d.finished ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      )}
                    </span>
                  ))}
                  <span className="dl-dots-count mono">
                    {done} / {total}
                  </span>
                </div>
              </div>
            )}

            <div className="dl-cards">
              {list.map((d) => (
                <button
                  key={d.id}
                  className={"dl-card " + d.id + (d.finished ? "" : " todo")}
                  onClick={() => setPicked(d.id)}
                >
                  <span className="dl-card-glow" />
                  <span className="dl-tile">
                    <span className="dl-tile-sheen" />
                    {d.id === "wordle" ? (
                      <span className="dl-tile-letters">
                        <i className="ok">M</i>
                        <i className="mid">O</i>
                        <i>T</i>
                      </span>
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#eef1f8" strokeWidth="1.7">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                        <path d="M9 7h7M9 11h5" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>

                  <span className="dl-card-main">
                    <span className="dl-card-top">
                      <span className="dl-card-name">{d.name}</span>
                      {d.streak > 0 && (
                        <span className="dl-mini-streak">
                          <span className="dl-flame">🔥</span>
                          <b className="mono">{d.streak}</b>
                        </span>
                      )}
                    </span>
                    <span className="dl-card-desc">{d.desc}</span>
                    {(d.friends_done > 0 || d.my_rank) && (
                      <span className="dl-card-compare">
                        <span className="dl-avatars">
                          {d.friends.map((f, i) => (
                            <span key={i} className="dl-avatar">
                              <Avatar url={f.avatar_url} name={f.display_name} size={24} />
                            </span>
                          ))}
                        </span>
                        <span className="dl-compare-label">
                          {d.my_rank && d.total_done > 1
                            ? `Tu es ${d.my_rank}${d.my_rank === 1 ? "er" : "e"} sur ${d.total_done}`
                            : `${d.friends_done} ami${d.friends_done > 1 ? "s" : ""} ${
                                d.friends_done > 1 ? "ont" : "a"
                              } déjà joué`}
                        </span>
                      </span>
                    )}
                  </span>

                  <span className="dl-card-side">
                    <span
                      className={
                        "dl-badge " + (!d.finished ? "todo" : d.solved ? "won" : "lost")
                      }
                    >
                      {!d.finished ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          À jouer
                        </>
                      ) : d.solved ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          Réussi · {d.score}
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                          Raté
                        </>
                      )}
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2.2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            <div className="dl-next">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2M9 2h6" />
              </svg>
              Nouveaux défis dans <b className="mono">{untilMidnightUTC()}</b>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ========================= un défi en particulier ========================= */

function DailyGame({
  ask,
  game,
  day,
  meta,
  onBack,
}: {
  ask: Ask;
  game: string;
  day: string;
  meta?: DailyMeta;
  onBack: () => void;
}) {
  const [state, setState] = useState<DailyState | null>(null);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wasFinished = useRef(false);

  const loadScores = useCallback(async () => {
    const r = await ask("daily_scores", { game });
    if (r?.results) setScores(r.results);
  }, [ask, game]);

  useEffect(() => {
    ask("daily_state", { game }).then((r) => {
      if (r?.state) {
        setState(r.state);
        wasFinished.current = r.state.finished;
      }
    });
    loadScores();
  }, [ask, game, loadScores]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const r = await ask("daily_guess", { game, text: t });
    setBusy(false);
    if (r?.state) setState(r.state);
    if (r?.error) {
      setError(r.error);
      window.setTimeout(() => setError(null), 2600);
      return;
    }
    setText("");
    sound.play("click");
    if (r?.state?.finished && !wasFinished.current) {
      wasFinished.current = true;
      sound.play(r.state.solved ? "victory" : "defeat");
      loadScores();
    }
  }

  if (!state) {
    return (
      <div className="dl">
        <div className="ambient" />
        <div className="centered">
          <span className="spinner" style={{ width: 26, height: 26 }} />
        </div>
      </div>
    );
  }

  const isWordle = game === "wordle";

  return (
    <div className="dl">
      <div className="ambient" />

      <div className="dl-head dl-head-ingame">
        <button className="dl-back" onClick={onBack} data-tip="Retour aux défis" aria-label="Retour aux défis">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="dl-head-text">
          <div className="dl-game-title">
            <span className="dl-h1">{state.name}</span>
            {(meta?.streak ?? 0) > 0 && (
              <span className="dl-mini-streak">
                <span className="dl-flame">🔥</span>
                <b className="mono">{meta!.streak}</b>
              </span>
            )}
          </div>
          <p className="dl-sub">{state.desc}</p>
        </div>
        <div className="dl-date mono">{frDate(day)}</div>
      </div>

      <div className="dl-split">
        {isWordle ? (
          <WordleSide state={state} typed={text} error={error} onSubmit={submit} onType={setText} busy={busy} />
        ) : (
          <WikidleSide state={state} typed={text} error={error} onSubmit={submit} onType={setText} busy={busy} />
        )}

        <aside className="dl-aside">
          {!isWordle && <GuessList guesses={state.guesses ?? []} />}
          <ScoreBoard rows={scores} compact={!isWordle} />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------ Le Mot du jour ----------------------------- */

function WordleSide({
  state,
  typed,
  error,
  onSubmit,
  onType,
  busy,
}: {
  state: DailyState;
  typed: string;
  error: string | null;
  onSubmit: (e?: React.FormEvent) => void;
  onType: (v: string) => void;
  busy: boolean;
}) {
  const len = state.length ?? 5;
  const max = state.max_tries ?? 6;
  const rows = state.rows ?? [];
  const current = state.finished ? "" : typed.toUpperCase().slice(0, len);
  const emptyCount = Math.max(0, max - rows.length - (state.finished ? 0 : 1));

  // Une seule liste de lignes avec des clés stables : sinon React recycle les
  // <div> entre les groupes et rejoue l'animation de flip n'importe comment.
  // Seule la DERNIÈRE ligne devinée s'anime (les précédentes restent figées).
  const gridRows = [
    ...rows.map((r, i) => ({
      key: `g${i}`,
      reveal: i === rows.length - 1,
      cells: r.word.split("").map((c, j) => ({
        letter: c,
        cls: r.score[j] + (i === rows.length - 1 ? " dl-reveal" : ""),
      })),
    })),
    ...(state.finished
      ? []
      : [{
          key: "typed",
          reveal: false,
          cells: Array.from({ length: len }, (_, j) => ({
            letter: current[j] ?? "",
            cls: current[j] ? "typed" : "empty",
          })),
        }]),
    ...Array.from({ length: emptyCount }, (_, i) => ({
      key: `e${i}`,
      reveal: false,
      cells: Array.from({ length: len }, () => ({ letter: "", cls: "empty" })),
    })),
  ];

  return (
    <section className="dl-main">
      {error && (
        <div className="dl-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8a95" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      <div className="wdl-grid">
        {gridRows.map((row) => (
          <div key={row.key} className="wdl-row">
            {row.cells.map((c, j) => (
              <span
                key={j}
                className={"wdl-cell " + c.cls}
                style={row.reveal ? { animationDelay: `${j * 0.12}s` } : undefined}
              >
                {c.letter}
              </span>
            ))}
          </div>
        ))}
      </div>

      {!state.finished ? (
        <form className="dl-form wdl-form" onSubmit={onSubmit}>
          <input
            className="dl-input wdl-input"
            value={typed}
            onChange={(e) => onType(e.currentTarget.value.replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(0, len))}
            placeholder="Ton mot…"
            autoFocus
            spellCheck={false}
          />
          <button className="dl-send" disabled={!typed.trim() || busy}>
            Valider
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      ) : (
        <div className={"dl-banner " + (state.solved ? "won" : "lost")}>
          <span className="dl-banner-emoji">{state.solved ? "🎉" : "😬"}</span>
          <div className="dl-banner-text">
            <div className="dl-banner-title">{state.solved ? "Trouvé !" : "Perdu…"}</div>
            <div className="dl-banner-sub">
              {state.solved
                ? `En ${rows.length} essai${rows.length > 1 ? "s" : ""}.`
                : "Reviens demain pour un nouveau mot."}
            </div>
          </div>
          <span className="dl-banner-sep" />
          <div className="dl-banner-sol">
            <div className="dl-banner-sol-label">Le mot</div>
            <div className="dl-banner-sol-val">{state.answer}</div>
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------- Wikidle -------------------------------- */

function WikidleSide({
  state,
  typed,
  error,
  onSubmit,
  onType,
  busy,
}: {
  state: DailyState;
  typed: string;
  error: string | null;
  onSubmit: (e?: React.FormEvent) => void;
  onType: (v: string) => void;
  busy: boolean;
}) {
  return (
    <section className="dl-main wkd-main">
      <div className="wkd-scroll">
        <div className="wkd-goal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </svg>
          Trouve le titre de l'article
        </div>

        <div className="wkd-title">
          <Tokens tokens={state.title ?? []} big />
        </div>

        <div className="wkd-body">
          <Tokens tokens={state.text ?? []} />
        </div>

        {state.finished && (
          <div className="dl-banner won wkd-banner">
            <span className="dl-banner-emoji">🎉</span>
            <div className="dl-banner-text">
              <div className="dl-banner-title">Trouvé — c'était « {state.answer} »</div>
              <div className="dl-banner-sub">
                En {state.tries} proposition{(state.tries ?? 0) > 1 ? "s" : ""}.
              </div>
            </div>
            {state.url && (
              <a className="wkd-source" href={state.url} target="_blank" rel="noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                </svg>
                source : Wikipédia
              </a>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="dl-toast wkd-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff8a95" strokeWidth="2.2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      {!state.finished && (
        <form className="dl-form wkd-form" onSubmit={onSubmit}>
          <div className="wkd-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6982" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="dl-input"
              value={typed}
              onChange={(e) => onType(e.currentTarget.value)}
              placeholder="Propose un mot…"
              maxLength={40}
              autoFocus
              spellCheck={false}
            />
          </div>
          <button className="dl-send cyan" disabled={!typed.trim() || busy}>
            Proposer
          </button>
        </form>
      )}
    </section>
  );
}

function Tokens({ tokens, big }: { tokens: WikiToken[]; big?: boolean }) {
  return (
    <>
      {tokens.map((t, i) => {
        if (t.t === "s") return <span key={i} className="wkd-sep">{t.v}</span>;
        if (t.t === "h")
          return (
            <span
              key={i}
              className={"wkd-pill" + (big ? " big" : "")}
              style={{ width: `${Math.max(2, t.n) * (big ? 0.62 : 0.58)}em` }}
            />
          );
        return (
          <span key={i} className={"wkd-word" + (t.hit ? " hit" : "")}>
            {t.v}
          </span>
        );
      })}
    </>
  );
}

function GuessList({ guesses }: { guesses: WikiGuess[] }) {
  return (
    <div className="dl-panel guesses">
      <div className="dl-panel-head">
        <span>Tes propositions</span>
        <span className="mono">{guesses.length}</span>
      </div>
      <div className="dl-panel-body">
        {guesses.length === 0 && <p className="muted small">Aucune proposition pour l'instant.</p>}
        {guesses.map((g, i) => (
          <div key={i} className={"wkd-guess-row " + (g.count > 0 ? "hit" : "miss")}>
            <span className="wkd-guess-icon">
              {g.count > 0 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              )}
            </span>
            <span className="wkd-guess-word">{g.word}</span>
            {g.count > 0 ? (
              <span className="wkd-guess-count mono">×{g.count}</span>
            ) : (
              <span className="wkd-guess-miss">absent</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBoard({ rows, compact }: { rows: ScoreRow[] | null; compact?: boolean }) {
  const doneCount = (rows ?? []).filter((r) => r.solved).length;
  return (
    <div className={"dl-panel scores" + (compact ? " compact" : "")}>
      <div className="dl-panel-head">
        <span>Résultats du jour</span>
        <span className="dl-done-count">
          <b>{doneCount}</b> ont trouvé
        </span>
      </div>
      <div className="dl-panel-body">
        {!rows || rows.length === 0 ? (
          <p className="muted small">Personne n'a encore terminé aujourd'hui.</p>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className={"dl-score-row" + (i === 0 ? " first" : "")}>
              <span className={"dl-rank mono" + (i === 0 ? " gold" : "")}>#{i + 1}</span>
              <Avatar url={r.avatar_url} name={r.display_name} size={34} />
              <div className="dl-score-info">
                <div className="dl-score-name">{r.display_name}</div>
                <div className={"dl-score-val " + (r.solved ? "won" : "lost")}>
                  {r.solved ? `${r.score} essai${r.score > 1 ? "s" : ""}` : "Raté"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
