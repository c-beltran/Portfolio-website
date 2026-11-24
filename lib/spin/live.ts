import type { Spin, SpinId } from './spin';

type Live = { id: SpinId; spin: Spin } | null;

let live: Live = null;
const readers = new Set<() => void>();
const tell = () => readers.forEach((f) => f());

/**
 * The object being spun right now, shared by the page (which takes the drags and keys and steps
 * the spin) and whichever view draws it (the still view's 3D canvas, or the live scene).
 */
export const spinLive = {
  get: (): Live => live,
  set(next: Live) {
    live = next;
    tell();
  },
  /** The spin turned: redraw. */
  moved: tell,
  subscribe(f: () => void) {
    readers.add(f);
    return () => void readers.delete(f);
  },
};
