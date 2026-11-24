import type { Condition, Sky } from './types';

/** The drawing's widest canvas, in px: past this the window gains nothing visible. */
export const PAINT_MAX_W = 1280;
/** Steps a second at most (the sky changes slowly; rain reads fine at this rate). */
export const PAINT_FPS = 30;

type Pair = { top: string; bottom: string };

/** Each sky by day and by night (top and bottom of the window). */
const DAY: Record<Condition, Pair> = {
  clear: { top: '#4f7fc4', bottom: '#a9c6e6' },
  partly: { top: '#6489c0', bottom: '#b4c8df' },
  overcast: { top: '#8c949e', bottom: '#b3b8be' },
  fog: { top: '#b9bcbf', bottom: '#cfd1d2' },
  rain: { top: '#6d7680', bottom: '#949ba3' },
  snow: { top: '#a3abb5', bottom: '#c9ced4' },
  storm: { top: '#4a525c', bottom: '#6c737b' },
};
const NIGHT: Record<Condition, Pair> = {
  clear: { top: '#070b1c', bottom: '#1b2340' },
  partly: { top: '#0b1022', bottom: '#1f2640' },
  overcast: { top: '#121418', bottom: '#1d2026' },
  fog: { top: '#1b1d21', bottom: '#272a2f' },
  rain: { top: '#0e1116', bottom: '#1a1f27' },
  snow: { top: '#141a26', bottom: '#232b3a' },
  storm: { top: '#0a0c10', bottom: '#151920' },
};
/** The low sky's warmth at sunrise and sunset. */
const DUSK = '#e9a277';

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (v: number[]) =>
  '#' +
  v
    .map((x) =>
      Math.round(Math.max(0, Math.min(255, x)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
const mix = (a: string, b: string, k: number) => {
  const [p, q] = [hex(a), hex(b)];
  return toHex(p.map((x, i) => x + (q[i]! - x) * k));
};

/** The sky's gradient for a condition and an amount of day (with a warm low sky in twilight). */
export function skyColors(c: Condition, dayness: number): Pair {
  const d = Math.max(0, Math.min(1, dayness));
  const glow = (1 - Math.abs(d * 2 - 1)) * (c === 'clear' || c === 'partly' ? 0.45 : 0.15);
  return {
    top: mix(NIGHT[c].top, DAY[c].top, d),
    bottom: mix(mix(NIGHT[c].bottom, DAY[c].bottom, d), DUSK, glow),
  };
}

const DENSITY: Partial<Record<Condition, number>> = { rain: 0.0012, storm: 0.0016, snow: 0.0007 };
const MAX_PARTICLES = 600;

/** How many drops or flakes, for an area of canvas px. */
export function particleCount(c: Condition, intensity: number, areaPx: number): number {
  const k = DENSITY[c] ?? 0;
  return Math.min(MAX_PARTICLES, Math.round(k * areaPx * Math.max(0, Math.min(1, intensity))));
}

export const birdsAllowed = (c: Condition, dayness: number) =>
  (c === 'clear' || c === 'partly') && dayness >= 0.5;

export function starsAlpha(c: Condition, dayness: number): number {
  if (c !== 'clear' && c !== 'partly') return 0;
  return Math.max(0, 1 - dayness * 2) * (c === 'partly' ? 0.5 : 1);
}

const CLOUDS: Partial<Record<Condition, number>> = {
  partly: 5,
  overcast: 14,
  rain: 12,
  snow: 10,
  storm: 14,
};
/**
 * Birds come at uneven times: time is cut into BIRD_SLOT ms slots, and in each a flock sets off at a
 * seeded moment in its first BIRD_LATEST ms, taking BIRD_CROSS ms to cross, so the sky is quiet
 * for 6 to 48 s between flocks. The first sets off almost at once.
 */
const BIRD_SLOT = 36_000;
const BIRD_CROSS = 9000;
const BIRD_LATEST = BIRD_SLOT - BIRD_CROSS - 6000;
const BIRD_FIRST = 1500;

export type Flock = {
  /** How far across, 0 to 1. */
  k: number;
  /** 1 flies left to right, -1 right to left. */
  dir: 1 | -1;
  count: number;
  /** Height in the window, 0 to 1. */
  y: number;
};

/** The flock crossing at a moment, or null when the sky is quiet. */
export function flockAt(tMs: number, seed = 1): Flock | null {
  const lap = Math.floor(tMs / BIRD_SLOT);
  const g = rng(seed * 31 + lap);
  const start = lap * BIRD_SLOT + (lap === 0 ? BIRD_FIRST : g() * BIRD_LATEST);
  const k = (tMs - start) / BIRD_CROSS;
  if (k < 0 || k > 1) return null;
  return {
    k,
    dir: g() < 0.5 ? 1 : -1,
    count: g() < 0.2 ? 1 : 2 + Math.floor(g() * 3),
    y: 0.18 + g() * 0.3,
  };
}

/**
 * How many frames a second the sky needs at a moment: falling rain or snow, or birds crossing, at
 * the full rate; drifting clouds or twinkling stars slowly; nothing moving (a clear day between
 * birds, fog), none: the last frame stands.
 */
export function motionFps(sky: Sky, tMs: number): number {
  const c = sky.condition;
  if (DENSITY[c]) return PAINT_FPS;
  if (birdsAllowed(c, sky.dayness) && flockAt(tMs)) return PAINT_FPS;
  if (CLOUDS[c] || starsAlpha(c, sky.dayness) > 0) return 10;
  return 0;
}

/** When the next storm flash comes: never sooner than 3 s after the last (WCAG 2.3.1 by far). */
export function nextFlashAt(prevMs: number, rand: () => number): number {
  return prevMs + 3000 + rand() * 9000;
}

/** A small seeded generator, so a still frame is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLASH_MS = 260;

/**
 * Draws the window's sky onto a canvas, in the space of the window's patch of sky (top-left is the
 * patch's top-left). Calm and soft: rain and snow sit behind glass (lower contrast), birds cross
 * now and then, the storm's flash is a low brightening. `still` draws one frame without the flash.
 */
export function createPainter(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 1) {
  const r = rng(seed);
  const stars = Array.from({ length: 140 }, () => ({
    x: r(),
    y: r() * 0.8,
    s: 0.6 + r() * 1.1,
    p: r(),
  }));
  const clouds = Array.from({ length: 16 }, () => ({
    x: r(),
    y: 0.05 + r() * 0.55,
    s: 0.12 + r() * 0.18,
    puffs: Array.from({ length: 5 }, () => [r() - 0.5, (r() - 0.5) * 0.35, 0.5 + r() * 0.5]),
  }));
  const drops = Array.from({ length: MAX_PARTICLES }, () => ({
    x: r(),
    y: r(),
    v: 0.7 + r() * 0.6,
    z: r(),
  }));
  let flashAt = nextFlashAt(0, r);

  function gradient(sky: Sky) {
    const c = skyColors(sky.condition, sky.dayness);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function sunAndMoon(sky: Sky) {
    const { condition: c, dayness: d } = sky;
    const open = c === 'clear' || c === 'partly';
    if (!open && c !== 'overcast') return;
    const veil = c === 'overcast' ? 0.15 : c === 'partly' ? 0.8 : 1;
    if (d > 0) {
      // The sun sinks and warms toward the horizon as the day ends.
      // In the open glass right of the monitor, seen in every window shape.
      const x = w * 0.56;
      const y = h * (0.55 - 0.3 * d);
      const rad = Math.min(w, h) * 0.05;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, rad * 6);
      const tint = mix('#ffb36b', '#fff6dc', d);
      glow.addColorStop(0, tint);
      glow.addColorStop(0.15, tint);
      glow.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.globalAlpha = veil * Math.min(1, d * 1.6);
      ctx.fillStyle = glow;
      ctx.fillRect(x - rad * 6, y - rad * 6, rad * 12, rad * 12);
      ctx.globalAlpha = 1;
    }
    if (d < 0.5 && open) {
      const x = w * 0.66;
      const y = h * 0.24;
      const rad = Math.min(w, h) * 0.035;
      const glow = ctx.createRadialGradient(x, y, rad * 0.9, x, y, rad * 4);
      glow.addColorStop(0, 'rgba(220,226,240,0.35)');
      glow.addColorStop(1, 'rgba(220,226,240,0)');
      ctx.globalAlpha = veil * (1 - d * 2);
      ctx.fillStyle = glow;
      ctx.fillRect(x - rad * 4, y - rad * 4, rad * 8, rad * 8);
      ctx.fillStyle = '#e4e8f2';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function starField(sky: Sky, t: number, still: boolean) {
    const a = starsAlpha(sky.condition, sky.dayness);
    if (!a) return;
    ctx.fillStyle = '#f2f4ff';
    for (const s of stars) {
      const twinkle = still ? 1 : 0.75 + 0.25 * Math.sin(t / 900 + s.p * 40);
      ctx.globalAlpha = a * 0.8 * twinkle;
      ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function cloudLayer(sky: Sky, t: number) {
    const n = CLOUDS[sky.condition] ?? 0;
    if (!n) return;
    const dark = sky.condition === 'storm' || sky.condition === 'rain';
    const day = sky.dayness;
    const col = mix(dark ? '#3a4048' : '#4a505a', dark ? '#8d949c' : '#eef1f4', day);
    const drift = (t / 1000) * (0.002 + Math.min(sky.windMs, 15) * 0.0006);
    for (const c of clouds.slice(0, n)) {
      const cx = (((c.x + drift) % 1.4) - 0.2) * w;
      const cy = c.y * h;
      const size = c.s * w * (n > 8 ? 1.4 : 1);
      for (const [dx, dy, k] of c.puffs as [number, number, number][]) {
        const px = cx + dx! * size;
        const py = cy + dy! * size;
        const puffR = size * 0.45 * k!;
        const g = ctx.createRadialGradient(px, py, 0, px, py, puffR);
        g.addColorStop(0, col);
        g.addColorStop(1, col + '00');
        ctx.globalAlpha = n > 8 ? 0.55 : 0.75;
        ctx.fillStyle = g;
        ctx.fillRect(px - puffR, py - puffR, puffR * 2, puffR * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function birds(sky: Sky, t: number) {
    if (!birdsAllowed(sky.condition, sky.dayness)) return;
    const f = flockAt(t, seed);
    if (!f) return;
    const { k, dir, count } = f;
    const y0 = h * f.y;
    ctx.strokeStyle = 'rgba(30,34,40,0.7)';
    ctx.lineWidth = Math.max(1, w / 900);
    for (let i = 0; i < count; i++) {
      const x = (dir === 1 ? -0.1 + k * 1.2 : 1.1 - k * 1.2) * w - dir * i * w * 0.025;
      const y = y0 + (i % 2) * h * 0.02 + Math.sin(t / 300 + i) * h * 0.004;
      const s = w * 0.008;
      const flap = Math.sin(t / 140 + i * 1.7) * s * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap);
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.3, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.3, x + s, y - flap);
      ctx.stroke();
    }
  }

  function falling(sky: Sky, t: number) {
    const n = particleCount(sky.condition, sky.intensity, w * h);
    if (!n) return;
    const snow = sky.condition === 'snow';
    // Wind from the west pushes left to right (on the patch, east is right).
    const lean = Math.sin(((sky.windDeg + 180) * Math.PI) / 180) * Math.min(sky.windMs, 15) * 0.02;
    const night = sky.dayness < 0.5;
    ctx.strokeStyle = night ? 'rgba(170,180,195,0.28)' : 'rgba(220,226,232,0.38)';
    ctx.fillStyle = night ? 'rgba(200,206,220,0.55)' : 'rgba(250,252,255,0.85)';
    ctx.lineWidth = Math.max(1, w / 1100);
    const fall = snow ? 0.00006 : 0.0011;
    for (const p of drops.slice(0, n)) {
      const y = (((p.y + t * fall * p.v) % 1) + 1) % 1;
      const sway = snow ? Math.sin(t / 1400 + p.x * 30) * 0.01 : 0;
      const x = (((p.x + lean * y + sway) % 1) + 1) % 1;
      if (snow) {
        const rad = (0.8 + p.z * 1.6) * (w / 1000);
        ctx.globalAlpha = 0.5 + p.z * 0.5;
        ctx.beginPath();
        ctx.arc(x * w, y * h, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const len = h * (0.025 + p.z * 0.02);
        ctx.globalAlpha = 0.4 + p.z * 0.6;
        ctx.beginPath();
        ctx.moveTo(x * w, y * h);
        ctx.lineTo(x * w - lean * len * 2, y * h + len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function haze(sky: Sky) {
    if (sky.condition !== 'fog') return;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const c = sky.dayness > 0.5 ? '220,222,224' : '60,62,66';
    g.addColorStop(0, `rgba(${c},0.35)`);
    g.addColorStop(1, `rgba(${c},0.75)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function flash(sky: Sky, t: number, still: boolean) {
    if (sky.condition !== 'storm' || still) return;
    while (t > flashAt + FLASH_MS) flashAt = nextFlashAt(flashAt, r);
    const since = t - flashAt;
    if (since < 0) return;
    ctx.fillStyle = `rgba(235,240,255,${0.22 * (1 - since / FLASH_MS)})`;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    draw(sky: Sky, tMs: number, o: { still: boolean }) {
      gradient(sky);
      starField(sky, tMs, o.still);
      sunAndMoon(sky);
      cloudLayer(sky, tMs);
      birds(sky, tMs);
      haze(sky);
      falling(sky, tMs);
      flash(sky, tMs, o.still);
    },
  };
}
