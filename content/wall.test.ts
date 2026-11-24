import { describe, expect, it } from 'vitest';
import { DESK_OBJECTS, SECTION_SLUGS } from './objects';
import { WALL_PIECES } from './wall';

describe('wall pieces', () => {
  it('open an existing section and never join the drawer', () => {
    for (const w of WALL_PIECES) {
      expect(SECTION_SLUGS).toContain(w.opens);
      expect(DESK_OBJECTS.map((o) => o.id as string)).not.toContain(w.id);
    }
  });

  it('the diploma opens the CV', () => {
    expect(WALL_PIECES).toEqual([
      {
        id: 'diploma',
        opens: 'cv',
        label: 'Education',
        ariaLabel: 'Framed diploma on the wall: Education, opens the CV',
      },
    ]);
  });
});
