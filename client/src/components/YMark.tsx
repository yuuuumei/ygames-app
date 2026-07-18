/** YMark — le jeton yGAMES : un anneau (dégradé conique tournant) autour
 *  d'un "y". La palette de l'anneau change selon le jeu ou l'état : c'est
 *  la brique d'identité réutilisée partout (barre de titre, header, jeux). */

export type YMarkVariant =
  | "app"
  | "imposteur"
  | "spyfall"
  | "quiz"
  | "online"
  | "victoire"
  | "defaite"
  | "attente";

const PALETTES: Record<YMarkVariant, string[]> = {
  app: ["#7c6cff", "#22d3ee", "#7c6cff"],
  imposteur: ["#ff4d5e", "#ff8a95", "#ff4d5e"],
  spyfall: ["#22d3ee", "#7c6cff", "#22d3ee"],
  quiz: ["#ffc24b", "#ff8a95", "#ffc24b"],
  online: ["#43d17a", "#2ba85d", "#43d17a"],
  victoire: ["#ffd479", "#43d17a", "#7cf0a8"],
  defaite: ["#8f0f24", "#2a0209", "#8f0f24"],
  attente: ["#5f6982", "#98a1b6", "#5f6982"],
};

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

type Props = {
  variant?: YMarkVariant;
  size?: number;
  speed?: number; // secondes par tour
  bg?: string;
  letter?: string;
  letterColor?: string;
  glow?: boolean;
  colors?: string[]; // override manuel de la palette
};

export default function YMark({
  variant = "app",
  size = 56,
  speed = 6,
  bg = "#0e1016",
  letter = "y",
  letterColor = "#fff",
  glow = true,
  colors,
}: Props) {
  const palette = colors?.length ? colors : PALETTES[variant] ?? PALETTES.app;
  const stops = palette.length === 1 ? [palette[0], palette[0]] : [...palette, palette[0]];
  const ringGradient = `conic-gradient(from 0deg, ${stops.join(", ")})`;
  const ringW = Math.max(2, Math.round(size * 0.125));
  const showLetter = size >= 20;
  const glowShadow = glow
    ? `0 ${Math.round(size * 0.16)}px ${Math.round(size * 0.42)}px ${hexA(palette[0], 0.4)}`
    : "none";

  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0, fontFamily: "var(--font-display)" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: ringGradient,
          animation: `ymspin ${speed}s linear infinite`,
          boxShadow: glowShadow,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: ringW,
          borderRadius: "50%",
          background: bg,
          display: "grid",
          placeItems: "center",
        }}
      >
        {showLetter && (
          <span
            style={{
              fontWeight: 700,
              fontSize: Math.round(size * 0.46),
              lineHeight: 1,
              color: letterColor,
              transform: `translateY(-${Math.max(1, Math.round(size * 0.035))}px)`,
            }}
          >
            {letter}
          </span>
        )}
      </div>
    </div>
  );
}
