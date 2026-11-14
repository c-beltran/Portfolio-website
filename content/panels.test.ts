import { describe, expect, it } from 'vitest';
import { facts, RETIRED_FACT_IDS, type FactId } from './facts';
import { DESK_OBJECTS, objectBySlug, SECTION_SLUGS } from './objects';
import { PANELS, type PanelBlock } from './panels';
import statsJson from './stats.json';
import type { Stats } from './stats.types';

const liveIds = new Set(Object.keys(facts));
const allBlocks: PanelBlock[] = Object.values(PANELS).flat();

function idsOf(block: PanelBlock): string[] {
  if (block.kind === 'prose' || block.kind === 'list') return block.facts;
  if (block.kind === 'fact') return [block.fact];
  return [];
}

function textOf(block: PanelBlock): string {
  switch (block.kind) {
    case 'eyebrow':
    case 'title':
    case 'prose':
    case 'todo':
      return block.text;
    case 'link':
      return `${block.label} ${block.href ?? ''}`;
    case 'stats':
      return block.items.map((i) => `${i.label} ${i.value(statsJson as Stats)}`).join(' ');
    default:
      return '';
  }
}

describe('panels', () => {
  it('every prose block cites at least one live fact', () => {
    for (const b of allBlocks.filter((b) => b.kind === 'prose')) {
      expect(idsOf(b).length).toBeGreaterThanOrEqual(1);
      for (const id of idsOf(b)) expect(liveIds.has(id)).toBe(true);
    }
  });

  it('every cited fact is live and none is retired', () => {
    for (const id of allBlocks.flatMap(idsOf)) {
      expect(liveIds.has(id as FactId)).toBe(true);
      expect(RETIRED_FACT_IDS as readonly string[]).not.toContain(id);
    }
  });

  it('every section has a panel', () => {
    for (const slug of SECTION_SLUGS) expect(PANELS[slug]?.length).toBeGreaterThan(0);
  });

  it('contains no email, town name, vendor claim or "licensed"', () => {
    for (const text of allBlocks.map(textOf)) {
      expect(text).not.toContain('@');
      expect(text).not.toMatch(/Hempstead|vendor|licensed/i);
    }
  });
});

describe('objects', () => {
  it('drawer order matches the section order', () => {
    expect(DESK_OBJECTS.map((o) => o.slug)).toEqual([...SECTION_SLUGS]);
  });

  it('looks objects up by slug', () => {
    expect(objectBySlug('potaflow')?.id).toBe('gauge');
    expect(objectBySlug('nope')).toBeUndefined();
  });

  it('every object points its metadata at a live fact', () => {
    for (const o of DESK_OBJECTS) expect(liveIds.has(o.metaFactId)).toBe(true);
  });
});
