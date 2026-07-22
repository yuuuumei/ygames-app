import { useCallback, useEffect, useState } from "react";
import Avatar from "./components/Avatar";
import StairsGame, { RunResult } from "./StairsGame";
import { toast } from "./toast";

type Ask = (event: string, data?: object) => Promise<any>;

type BoardRow = {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  runs: number;
  is_me: boolean;
};
type Boards = { day: BoardRow[]; week: BoardRow[]; all: BoardRow[] };
type Personal = {
  day: { best: number; runs: number };
  week: { best: number; runs: number };
  all: { best: number; runs: number };
  coins: number;
};

const SCOPES: { id: keyof Boards; label: string }[] = [
  { id: "day", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "all", label: "All-time" },
];

const Crown = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11H4.8L3 7Z" />
  </svg>
);

export default function StairsScreen({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [phase, setPhase] = useState<"menu" | "playing" | "over">("menu");
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [boards, setBoards] = useState<Boards | null>(null);
  const [scope, setScope] = useState<keyof Boards>("day");
  const [token, setToken] = useState<string | null>(null);
  const [last, setLast] = useState<RunResult | null>(null);
  const [prevBest, setPrevBest] = useState(0);

  const refresh = useCallback(async () => {
    const r = await ask("stairs_home");
    if (r?.personal) setPersonal(r.personal);
    if (r?.boards) setBoards(r.boards);
  }, [ask]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function start() {
    const r = await ask("stairs_start");
    if (r?.error) {
      toast(r.error);
      return;
    }
    setToken(r.token);
    setPrevBest(personal?.all.best ?? 0);
    setLast(null);
    setPhase("playing");
  }

  async function finish(result: RunResult) {
    setLast(result);
    setPhase("over");
    const r = await ask("stairs_submit", { token, score: result.score, coins: result.coins });
    if (r?.error) {
      toast(r.error);
    } else {
      if (r?.personal) setPersonal(r.personal);
      if (r?.boards) setBoards(r.boards);
    }
    setToken(null);
  }

  if (phase === "playing") {
    return <StairsGame onDead={finish} onQuit={() => setPhase("menu")} />;
  }

  const rows = boards?.[scope] ?? [];
  const isRecord = !!last && last.score > prevBest;

  return (
    <div className="st">
      <div className="ambient" />

      <div className="st-head">
        <button className="st-back" onClick={onClose} data-tip="Retour" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="st-head-text">
          <div className="st-title-row">
            <h1 className="st-h1">STAIRS</h1>
            <span className="st-badge">ARCADE · SOLO</span>
          </div>
          <p className="st-sub">Grimpe le plus haut possible. Une marche = un point.</p>
        </div>
        {personal && (
          <div className="st-wallet" data-tip="Gemmes récoltées en tout" aria-label="Gemmes récoltées en tout">
            <span className="st-gem-icon" />
            <span className="st-wallet-n">{personal.coins.toLocaleString("fr-FR")}</span>
            <span className="st-wallet-l">gemmes</span>
          </div>
        )}
      </div>

      <div className="st-body">
        {/* ---------------- colonne gauche ---------------- */}
        <div className="st-left">
          {phase === "over" && last ? (
            <div className="st-over">
              {isRecord && (
                <div className="st-newrec">
                  <span className="st-crown">
                    <Crown />
                  </span>
                  NOUVEAU RECORD
                </div>
              )}
              <div className="st-over-label">Ton score</div>
              <div className="st-over-score">{last.score}</div>
              <div className="st-over-sub">
                {isRecord ? (
                  <>
                    Ancien record : {prevBest} —{" "}
                    <span className="st-delta">+{last.score - prevBest} marches</span>
                  </>
                ) : (
                  <>
                    Ton record : {prevBest} — il te manquait {prevBest - last.score + 1} marche
                    {prevBest - last.score + 1 > 1 ? "s" : ""}
                  </>
                )}
              </div>
              {last.coins > 0 && (
                <div className="st-over-gems">
                  <span className="st-gem-icon" />
                  <b>+{last.coins}</b>
                  <span className="l">gemme{last.coins > 1 ? "s" : ""} récoltée{last.coins > 1 ? "s" : ""}</span>
                </div>
              )}
              <button className="st-replay-btn" onClick={start}>
                <span className="st-sheen" />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Rejouer
              </button>
              <button className="st-ghost-btn" onClick={() => setPhase("menu")}>
                Retour au menu
              </button>
            </div>
          ) : (
            <div className="st-menu">
              <div className="st-tower-art" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={"st-art-step" + (i % 2 ? " cyan" : "")}
                    style={{ left: i * 38, bottom: i * 26, animationDelay: `${i * 0.2}s` }}
                  />
                ))}
                <span className="st-art-climber" style={{ left: 158, bottom: 121 }} />
              </div>
              <button className="st-play-btn" onClick={start}>
                <span className="st-sheen" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                JOUER
              </button>
              <div className="st-rules">
                <Rule d="m9 6-6 6 6 6M15 6l6 6-6 6">
                  Les <b>flèches</b> pour sauter du bon côté.
                </Rule>
                <Rule d="M12 5v9m0 0-4-4m4 4 4-4M5 19h14">
                  Tu <b>tombes</b> si tu traînes.
                </Rule>
                <Rule d="M12 9v4l2 2M9 2h6" circle>
                  Le <b>chrono se resserre</b> en montant.
                </Rule>
              </div>
            </div>
          )}

          {personal && (
            <div className="st-records">
              <Record label="Aujourd'hui" value={personal.day.best} />
              <Record label="Semaine" value={personal.week.best} />
              <Record label="Record" value={personal.all.best} gold />
            </div>
          )}
        </div>

        {/* ---------------- colonne droite : classements ---------------- */}
        <div className="st-right">
          <div className="st-tabs">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                className={"st-tab" + (scope === s.id ? " on" : "")}
                onClick={() => setScope(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="st-lb-head">
            <div className="st-c-rank">#</div>
            <div className="st-c-player">Joueur</div>
            <div className="st-c-runs">Runs</div>
            <div className="st-c-score">Score</div>
          </div>

          {rows.length === 0 ? (
            <div className="st-empty">
              <div className="st-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m3 20 5-9 4 5 3-4 6 8" />
                  <path d="M3 20h18" />
                </svg>
              </div>
              <div>
                <div className="st-empty-title">Personne n'a encore grimpé</div>
                <div className="st-empty-sub">
                  Sois le premier de la bande à poser un score sur cette période.
                </div>
              </div>
            </div>
          ) : (
            <div className="st-board">
              {rows.map((r, i) => (
                <div
                  key={r.id}
                  className={"st-board-row" + (i === 0 ? " first" : "") + (r.is_me ? " me" : "")}
                >
                  <div className="st-rank">{i + 1}</div>
                  <div className="st-board-player">
                    <Avatar url={r.avatar_url} name={r.display_name} size={38} />
                    <div className="st-board-meta">
                      <div className="st-board-name">
                        {i === 0 && (
                          <span className="st-crown">
                            <Crown size={13} />
                          </span>
                        )}
                        {r.display_name}
                        {r.is_me && <span className="st-you">TOI</span>}
                      </div>
                      <div className="st-board-handle">@{r.username}</div>
                    </div>
                  </div>
                  <div className="st-board-runs">{r.runs}</div>
                  <div className="st-board-score">{r.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Rule({ d, circle, children }: { d: string; circle?: boolean; children: React.ReactNode }) {
  return (
    <div className="st-rule">
      <span className="st-rule-ic">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          {circle && <circle cx="12" cy="13" r="8" />}
          <path d={d} />
        </svg>
      </span>
      <div>{children}</div>
    </div>
  );
}

function Record({ label, value, gold }: { label: string; value: number; gold?: boolean }) {
  return (
    <div className={"st-record-tile" + (gold ? " gold" : "")}>
      {gold && (
        <div className="st-crown">
          <Crown />
        </div>
      )}
      <div className="st-record-label">{label}</div>
      <div className="st-record-value">{value}</div>
    </div>
  );
}
