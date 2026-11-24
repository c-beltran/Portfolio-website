// Outlines of a binary mask, as closed loops (marching squares through pixel centres, in pixel
// units: pixel i's centre is at i + 0.5), and a loop simplifier (Douglas–Peucker). For a vector
// clip traced from a rendered mask: a clip is never an image, so it can never be a page's largest
// paint.

/** Segments per marching-squares case (corners tl, tr, br, bl as bits 8, 4, 2, 1). */
const CASES = {
  1: [['l', 'b']],
  2: [['b', 'r']],
  3: [['l', 'r']],
  4: [['t', 'r']],
  5: [
    ['t', 'r'],
    ['l', 'b'],
  ],
  6: [['t', 'b']],
  7: [['l', 't']],
  8: [['l', 't']],
  9: [['t', 'b']],
  10: [
    ['l', 't'],
    ['b', 'r'],
  ],
  11: [['t', 'r']],
  12: [['l', 'r']],
  13: [['b', 'r']],
  14: [['l', 'b']],
};

/** Closed loops around the set pixels of `data` (w × h, non-zero = set). */
export function trace({ data, w, h }) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] ? 1 : 0);
  const ends = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const segs = [];
  // Cells span pixel centres; one cell of border all round closes loops at the edges.
  for (let j = -1; j < h; j++)
    for (let i = -1; i < w; i++) {
      const c = at(i, j) * 8 + at(i + 1, j) * 4 + at(i + 1, j + 1) * 2 + at(i, j + 1);
      const pairs = CASES[c];
      if (!pairs) continue;
      const mid = {
        t: [i + 1, j + 0.5],
        r: [i + 1.5, j + 1],
        b: [i + 1, j + 1.5],
        l: [i + 0.5, j + 1],
      };
      for (const [a, b] of pairs) {
        const s = { a: mid[a], b: mid[b], used: false };
        segs.push(s);
        for (const p of [s.a, s.b]) {
          const k = key(p);
          if (!ends.has(k)) ends.set(k, []);
          ends.get(k).push(s);
        }
      }
    }
  const loops = [];
  for (const start of segs) {
    if (start.used) continue;
    start.used = true;
    const loop = [start.a];
    let p = start.b;
    while (key(p) !== key(start.a)) {
      loop.push(p);
      const next = ends.get(key(p)).find((s) => !s.used);
      if (!next) break;
      next.used = true;
      p = key(next.a) === key(p) ? next.b : next.a;
    }
    loops.push(loop);
  }
  return loops;
}

function dist(p, a, b) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  let [far, at] = [0, 0];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts.at(-1));
    if (d > far) [far, at] = [d, i];
  }
  if (far <= tol) return [pts[0], pts.at(-1)];
  return [...dp(pts.slice(0, at + 1), tol).slice(0, -1), ...dp(pts.slice(at), tol)];
}

/** A closed loop with points within `tol` of a straight run dropped. */
export function simplify(loop, tol) {
  if (loop.length < 4) return loop;
  // Split at the point furthest from the first, and simplify both halves as open runs.
  let [far, at] = [0, 0];
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > far) [far, at] = [d, i];
  }
  const a = dp(loop.slice(0, at + 1), tol);
  const b = dp([...loop.slice(at), loop[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
