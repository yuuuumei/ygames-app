/** Moteur de sons yGAMES — synthèse Web Audio, aucun fichier externe.
 *  Discret au quotidien, marqué en jeu. Mute persisté (localStorage). */

type SoundName =
  | "click"
  | "join"
  | "vote_open"
  | "your_turn"
  | "reveal"
  | "victory"
  | "defeat";

const STORAGE_KEY = "ygames.muted";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private listeners = new Set<(muted: boolean) => void>();

  constructor() {
    this.muted = localStorage.getItem(STORAGE_KEY) === "1";
    // Débloque l'audio au premier geste utilisateur (politique navigateur).
    const unlock = () => {
      this.ensure();
      this.ctx?.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  private ensure() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  onMuteChange(fn: (muted: boolean) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
    this.listeners.forEach((fn) => fn(this.muted));
  }

  /** Une note simple : oscillateur + enveloppe. */
  private note(
    freq: number,
    start: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; glideTo?: number } = {},
  ) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + dur);
    const peak = opts.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Un souffle bref (bruit filtré) pour les impacts. */
  private noise(start: number, dur: number, gain = 0.2, freq = 1200) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + start;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  play(name: SoundName) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();

    switch (name) {
      case "click":
        this.note(320, 0, 0.08, { type: "sine", gain: 0.12 });
        break;
      case "join":
        // clic doux et grave : on entre dans la pièce
        this.note(180, 0, 0.14, { type: "sine", gain: 0.22, glideTo: 130 });
        this.noise(0, 0.06, 0.08, 500);
        break;
      case "vote_open":
        // tension : nappe qui monte
        this.note(110, 0, 0.5, { type: "sawtooth", gain: 0.14, glideTo: 220 });
        this.note(220, 0.05, 0.45, { type: "sine", gain: 0.1, glideTo: 330 });
        break;
      case "your_turn":
        // deux notes claires ascendantes (C5, E5)
        this.note(523.25, 0, 0.18, { type: "triangle", gain: 0.22 });
        this.note(659.25, 0.14, 0.22, { type: "triangle", gain: 0.22 });
        break;
      case "reveal":
        // roulement puis impact
        this.noise(0, 0.35, 0.12, 900);
        this.note(80, 0.34, 0.4, { type: "sine", gain: 0.32, glideTo: 55 });
        this.noise(0.34, 0.12, 0.18, 400);
        break;
      case "victory": {
        // accord majeur ascendant, brillant (C, E, G, C)
        const maj = [523.25, 659.25, 783.99, 1046.5];
        maj.forEach((f, i) => this.note(f, i * 0.1, 0.5, { type: "triangle", gain: 0.2 }));
        break;
      }
      case "defeat": {
        // notes descendantes mineures, douche froide
        const min = [440, 392, 311.13];
        min.forEach((f, i) => this.note(f, i * 0.16, 0.4, { type: "sawtooth", gain: 0.14 }));
        break;
      }
    }
  }
}

export const sound = new SoundEngine();
