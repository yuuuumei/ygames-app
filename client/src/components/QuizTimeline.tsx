export type TimelineMarker = { year: number; label: string; correct?: boolean; me?: boolean };

/** Frise chronologique. Mode interactif (answering) : curseur pour placer une
 *  année. Mode lecture (correction) : marqueurs (bonne réponse + tentatives). */
export default function QuizTimeline({
  min = 1000,
  max = 2025,
  value,
  onChange,
  markers,
}: {
  min?: number;
  max?: number;
  value?: number;
  onChange?: (year: number) => void;
  markers?: TimelineMarker[];
}) {
  const span = Math.max(1, max - min);
  const pct = (y: number) => `${Math.max(0, Math.min(100, ((y - min) / span) * 100))}%`;
  const ticks = 5;

  return (
    <div className="qtl">
      {onChange && value != null && <div className="qtl-value mono">{value}</div>}

      <div className="qtl-track">
        <div className="qtl-axis" />
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const y = Math.round(min + (span * i) / ticks);
          return (
            <div key={i} className="qtl-tick" style={{ left: `${(i / ticks) * 100}%` }}>
              <span className="qtl-tick-line" />
              <span className="qtl-tick-label mono">{y}</span>
            </div>
          );
        })}

        {/* marqueurs (correction) */}
        {markers?.map((m, i) => (
          <div
            key={i}
            className={"qtl-marker" + (m.correct ? " correct" : "") + (m.me ? " me" : "")}
            style={{ left: pct(m.year) }}
            data-tip={`${m.label} · ${m.year}`}
            aria-label={`${m.label} · ${m.year}`}
          >
            <span className="qtl-marker-dot" />
            <span className="qtl-marker-label">{m.label}</span>
          </div>
        ))}

        {/* curseur (answering) */}
        {onChange && value != null && (
          <div className="qtl-cursor" style={{ left: pct(value) }} />
        )}
      </div>

      {onChange && value != null && (
        <input
          className="qtl-range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
        />
      )}
    </div>
  );
}
