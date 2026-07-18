/** Rendu des cosmétiques à partir de PARAMÈTRES visuels (data-driven).
 *  Les visuels viennent du catalogue serveur — l'admin peut en créer sans
 *  recoder, tant qu'ils réutilisent un style/moteur connu ci-dessous. */

import Avatar from "./Avatar";

export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export type BorderVisual = {
  style: "ring" | "dashed" | "conic";
  colorMode: "signature" | "fixed" | "gold";
  color?: string;
  thickness?: number;
  glow?: number;
  spin?: boolean;
  speed?: number;
};

export type EffectVisual = {
  engine: "confetti" | "rings" | "sweep" | "glitch" | "rain";
  colorMode: "signature" | "fixed" | "gold" | "multi";
  color?: string;
};

function resolveColor(mode: string, color: string | undefined, signature: string): string {
  if (mode === "signature") return signature;
  if (mode === "gold") return "#ffc24b";
  return color || signature;
}

/** Style CSS de l'anneau, calculé depuis les params de la bordure. */
export function borderRingStyle(
  visual: BorderVisual | null | undefined,
  signature: string,
  size: number,
): React.CSSProperties {
  const inset = -Math.round(size * 0.11);
  const base: React.CSSProperties = { position: "absolute", inset, borderRadius: "50%", pointerEvents: "none" };
  if (!visual) {
    return { ...base, border: `${Math.max(2, size * 0.035)}px solid ${signature}` };
  }
  const c = resolveColor(visual.colorMode, visual.color, signature);
  const thickness = Math.max(2, (visual.thickness ?? 0.035) * size);
  const glow = visual.glow ?? 0;
  const glowShadow =
    glow > 0
      ? `0 0 ${size * 0.18 * glow}px ${hexA(c, 0.7)}, inset 0 0 ${size * 0.08}px ${hexA(c, 0.5)}`
      : undefined;
  const maskRing = {
    WebkitMaskImage: `radial-gradient(circle, transparent ${size * 0.42}px, #000 ${size * 0.44}px)`,
    maskImage: `radial-gradient(circle, transparent ${size * 0.42}px, #000 ${size * 0.44}px)`,
  } as React.CSSProperties;

  if (visual.style === "dashed") {
    return { ...base, border: `${thickness}px dashed ${c}`, boxShadow: glowShadow };
  }
  if (visual.style === "conic") {
    const grad =
      visual.colorMode === "gold"
        ? "conic-gradient(from 0deg,#ffe08a,#d99215,#fff2c2,#d99215,#ffe08a)"
        : `conic-gradient(from 0deg, ${c}, ${hexA(c, 0.15)}, ${c})`;
    return {
      ...base,
      ...maskRing,
      background: grad,
      animation: visual.spin ? `ymspin ${visual.speed ?? 5}s linear infinite` : undefined,
      boxShadow: glowShadow,
    };
  }
  // ring (par défaut)
  return { ...base, border: `${thickness}px solid ${c}`, boxShadow: glowShadow };
}

/** Avatar entouré de sa bordure cosmétique (via params visuels). */
export function BorderedAvatar({
  url,
  name,
  size,
  visual,
  signature,
}: {
  url?: string | null;
  name: string;
  size: number;
  visual: BorderVisual | null | undefined;
  signature: string;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={borderRingStyle(visual, signature, size)} />
      <Avatar url={url} name={name} size={size} />
    </div>
  );
}

const CONFETTI_COLS = ["#7c6cff", "#22d3ee", "#43d17a", "#ffc24b", "#ff4d5e"];

/** Overlay de l'effet de victoire, rendu par moteur (rejoué via playKey). */
export function VictoryEffect({
  visual,
  signature,
  playKey,
}: {
  visual: EffectVisual | null | undefined;
  signature: string;
  playKey: number;
}) {
  if (!visual) return null;
  const color = resolveColor(visual.colorMode, visual.color, signature);

  if (visual.engine === "confetti") {
    const cols = visual.colorMode === "multi" ? [...CONFETTI_COLS, signature] : [color];
    return (
      <div key={playKey} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "46%",
              left: `${6 + i * 5.8}%`,
              width: `${6 + (i % 3) * 3}px`,
              height: `${6 + (i % 3) * 3}px`,
              background: cols[i % cols.length],
              borderRadius: 2,
              animation: `confRise ${1.6 + (i % 4) * 0.3}s var(--ease) ${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (visual.engine === "rings") {
    return (
      <div key={playKey} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
        {[0, 0.35, 0.7].map((d, i) => (
          <span
            key={i}
            style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", border: `3px solid ${color}`, animation: `shockRing 1.1s var(--ease) ${d}s` }}
          />
        ))}
      </div>
    );
  }
  if (visual.engine === "sweep") {
    return (
      <div key={playKey} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            width: 100,
            height: "160%",
            marginLeft: -50,
            background: `linear-gradient(${hexA(color, 0.5)}, transparent)`,
            filter: "blur(6px)",
            animation: "spotSweepV 1.3s var(--ease)",
          }}
        />
      </div>
    );
  }
  if (visual.engine === "rain") {
    const gold = visual.colorMode === "gold";
    return (
      <div key={playKey} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${3 + i * 5.4}%`,
              width: 5,
              height: 11,
              borderRadius: 2,
              background: gold ? (i % 2 ? "#ffe08a" : "#ffc24b") : color,
              animation: `goldFall ${1.4 + (i % 5) * 0.25}s var(--ease) ${i * 0.06}s`,
            }}
          />
        ))}
      </div>
    );
  }
  if (visual.engine === "glitch") {
    return (
      <div key={playKey} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, color, animation: "glitchX .5s steps(2) 3", textShadow: "2px 0 #22d3ee, -2px 0 #ff4d5e" }}>
          VICTOIRE
        </div>
      </div>
    );
  }
  return null;
}
