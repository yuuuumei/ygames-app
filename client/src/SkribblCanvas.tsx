import { useEffect, useRef } from "react";

/* ============================================================
   La toile de Skribbl.

   Les traits sont envoyés et reçus en COORDONNÉES NORMALISÉES (0→1) :
   deux joueurs n'ont pas forcément la même taille de fenêtre, et un
   dessin fait en 1200px doit s'afficher juste en 800px.

   Le trait est envoyé segment par segment pendant le geste (« tire et
   oublie », sans accusé de réception) : c'est ce qui donne l'impression
   que ça se dessine chez les autres en même temps que chez soi.
   ============================================================ */

export type Stroke =
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; c: string; w: number }
  | { t: "fill"; x: number; y: number; c: string }
  | { t: "clear" }
  | { t: "undo" };

export type Tool = "pen" | "fill" | "eraser";

/** Deux rangées : les tons vifs, puis leurs versions sombres. */
export const PALETTE = [
  "#ffffff", "#c1c1c1", "#ef4444", "#ff8a3d", "#ffe14b", "#43d17a",
  "#22d3ee", "#3b82f6", "#7c6cff", "#eb459e", "#f9a8d4", "#c98a5e",
  "#0b0d13", "#6b7280", "#7f1d1d", "#9a3412", "#a16207", "#166534",
  "#0e7490", "#1e3a8a", "#4c1d95", "#831843", "#be5a8a", "#5c3317",
];
export const SIZES = [3, 8, 16, 30];

/** Remplissage par diffusion (le pot de peinture).
 *  On tolère un petit écart de couleur : les traits sont anticrénelés,
 *  donc leurs bords ne sont jamais exactement de la couleur du fond. */
function floodFill(ctx: CanvasRenderingContext2D, w: number, h: number, sx: number, sy: number, hex: string) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const at = (x: number, y: number) => (y * w + x) * 4;

  const start = at(sx, sy);
  const sr = d[start], sg = d[start + 1], sb = d[start + 2], sa = d[start + 3];

  const n = parseInt(hex.slice(1), 16);
  const tr = (n >> 16) & 255, tg = (n >> 8) & 255, tb = n & 255;
  if (Math.abs(sr - tr) < 4 && Math.abs(sg - tg) < 4 && Math.abs(sb - tb) < 4 && sa === 255) {
    return; // déjà de la bonne couleur : rien à faire
  }

  const TOL = 32;
  const match = (i: number) =>
    Math.abs(d[i] - sr) <= TOL &&
    Math.abs(d[i + 1] - sg) <= TOL &&
    Math.abs(d[i + 2] - sb) <= TOL &&
    Math.abs(d[i + 3] - sa) <= TOL;

  // parcours par lignes : bien plus rapide qu'un BFS pixel par pixel
  const stack: number[][] = [[sx, sy]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    let x = px;
    while (x >= 0 && match(at(x, py))) x--;
    x++;
    let up = false, down = false;
    for (; x < w && match(at(x, py)); x++) {
      const i = at(x, py);
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = 255;
      if (py > 0) {
        const m = match(at(x, py - 1));
        if (m && !up) { stack.push([x, py - 1]); up = true; }
        else if (!m) up = false;
      }
      if (py < h - 1) {
        const m = match(at(x, py + 1));
        if (m && !down) { stack.push([x, py + 1]); down = true; }
        else if (!m) down = false;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function SkribblCanvas({
  canDraw,
  tool,
  color,
  size,
  strokes,
  onStroke,
  subscribe,
}: {
  canDraw: boolean;
  tool: Tool;
  color: string;
  size: number;
  /** Traits déjà posés (resynchro / reconnexion) — redessinés à chaque changement. */
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  /** Abonnement aux traits des autres. Retourne la fonction de désabonnement. */
  subscribe: (handler: (s: Stroke) => void) => () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  // les traits reçus s'empilent ici pour être rejoués après un redimensionnement
  const painted = useRef<Stroke[]>([]);

  function ctx2d() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function paint(s: Stroke) {
    const c = canvasRef.current;
    const ctx = ctx2d();
    if (!c || !ctx) return;
    if (s.t === "clear") {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }
    if (s.t === "fill") {
      floodFill(ctx, c.width, c.height,
                Math.round(s.x * c.width), Math.round(s.y * c.height), s.c);
      return;
    }
    if (s.t !== "line") return;
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w * (c.width / 1000); // épaisseur relative à la toile
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.x1 * c.width, s.y1 * c.height);
    ctx.lineTo(s.x2 * c.width, s.y2 * c.height);
    ctx.stroke();
  }

  function repaintAll(list: Stroke[]) {
    const c = canvasRef.current;
    const ctx = ctx2d();
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of list) paint(s);
  }

  // taille physique de la toile = taille affichée × densité d'écran
  useEffect(() => {
    const wrap = wrapRef.current;
    const c = canvasRef.current;
    if (!wrap || !c) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      repaintAll(painted.current);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // traits venus du serveur
  useEffect(() => {
    return subscribe((s: Stroke) => {
      if (s.t === "clear") painted.current = [];
      else if (s.t === "undo") painted.current.pop();
      else painted.current.push(s);
      if (s.t === "undo") repaintAll(painted.current);
      else paint(s);
    });
  }, [subscribe]);

  // resynchro complète (montage, reconnexion, changement de tour)
  useEffect(() => {
    painted.current = [...strokes];
    repaintAll(painted.current);
  }, [strokes]);

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  /** La couleur réellement posée : la gomme peint en blanc, comme la toile. */
  function ink(): string {
    return tool === "eraser" ? "#ffffff" : color;
  }

  function emit(s: Stroke) {
    painted.current.push(s);
    paint(s);
    onStroke(s);
  }

  function down(e: React.PointerEvent) {
    if (!canDraw) return;
    const p = pos(e);
    if (tool === "fill") {
      emit({ t: "fill", x: p.x, y: p.y, c: color });
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = p;
    // un simple clic doit laisser un point : on trace un segment nul
    emit({ t: "line", x1: p.x, y1: p.y, x2: p.x, y2: p.y, c: ink(), w: size });
  }

  function move(e: React.PointerEvent) {
    if (!canDraw || !drawing.current || !last.current) return;
    const p = pos(e);
    const d = Math.hypot(p.x - last.current.x, p.y - last.current.y);
    if (d < 0.002) return; // on ne spamme pas le réseau pour un frémissement
    emit({ t: "line", x1: last.current.x, y1: last.current.y, x2: p.x, y2: p.y, c: ink(), w: size });
    last.current = p;
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  return (
    <div className={"sk-canvas-wrap" + (canDraw ? " drawable tool-" + tool : "")} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="sk-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
    </div>
  );
}
