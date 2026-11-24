import type { SectionSlug } from './objects';

/**
 * Things on the wall that open a section another object already owns: they never join the drawer
 * or the routes (DESK_OBJECTS), so a section keeps one entry. Each still comes forward or is leaned
 * in to (content/opened.ts), and has its hotspot and tape label on the desk.
 */
export type WallPiece = {
  id: 'diploma';
  opens: SectionSlug;
  label: string;
  ariaLabel: string;
};

export const WALL_PIECES: readonly WallPiece[] = [
  {
    id: 'diploma',
    opens: 'cv',
    label: 'Education',
    ariaLabel: 'Framed diploma on the wall: Education, opens the CV',
  },
];

export const wallPiece = (id: string | null | undefined) => WALL_PIECES.find((w) => w.id === id);
