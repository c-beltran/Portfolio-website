import { describe, expect, it } from 'vitest';
import { facts, PLACES, RETIRED_FACT_IDS, type FactId } from './facts';
import { deskDescription, DESK_OBJECTS, objectBySlug, SECTION_SLUGS } from './objects';
import { PANELS, type PanelBlock } from './panels';
import statsJson from './stats.json';
import type { Stats } from './stats.types';

const liveIds = new Set(Object.keys(facts));
const allBlocks: PanelBlock[] = Object.values(PANELS).flat();

function idsOf(block: PanelBlock): string[] {
  if (block.kind === 'prose' || block.kind === 'list') return block.facts;
  if (block.kind === 'fact' || block.kind === 'places') return [block.fact];
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
    case 'links':
      return '';
    case 'places':
      return PLACES.join(' ');
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

describe('claims', () => {
  // "I write the spec" and "Nothing merges until I've read it" are confirmed claims.
  const UNBACKED = /I wrote|I review|I reviewed|tool of mine|licensed/i;

  it('makes no authorship or review claim the stats cannot back', () => {
    for (const b of allBlocks) {
      if (b.kind === 'prose') expect(b.text.replace(/\[TODO:[^\]]*\]/g, '')).not.toMatch(UNBACKED);
    }
  });

  it('every title is marked as draft copy', () => {
    for (const b of allBlocks.filter((b) => b.kind === 'title')) {
      expect(b).toMatchObject({ draft: true });
    }
  });

  it('a link without a URL always carries a visible TODO', () => {
    for (const b of allBlocks) {
      if (b.kind === 'link' && b.href === null) expect(b.todo).toMatch(/^Q\d+/);
    }
  });

  it('the contact panel renders the contact links block', () => {
    expect(PANELS.contact.some((b) => b.kind === 'links')).toBe(true);
  });

  it('the about prose cites the ad-performance fact it paraphrases', () => {
    const prose = PANELS.about.find((b) => b.kind === 'prose');
    expect(prose && idsOf(prose)).toContain('F07');
  });
});

describe('objects', () => {
  it('drawer order matches the section order', () => {
    expect(DESK_OBJECTS.map((o) => o.slug)).toEqual([...SECTION_SLUGS]);
  });

  it('uses the Workspace objects, paired with their sections', () => {
    expect(DESK_OBJECTS.map((o) => [o.id, o.slug])).toEqual([
      ['cv', 'cv'],
      ['photo', 'about'],
      ['badge', 'experience'],
      ['monitor', 'how-i-build'],
      ['kit', 'potaflow'],
      ['phone', 'power-walk'],
      ['notepad', 'this-site'],
      ['card', 'contact'],
      // the room: last, after Contact
      ['car', 'cars'],
      ['ball', 'soccer'],
      ['board', 'travel'],
      ['mug', 'coffee'],
    ]);
  });

  it('labels each object after the Workspace (the monitor is two)', () => {
    expect(objectBySlug('how-i-build')?.ariaLabel).toBe('Monitor, left screen: How I build');
    expect(objectBySlug('cv')?.ariaLabel).toBe('Monitor, right screen: Carlos Beltran, CV');
    expect(objectBySlug('potaflow')?.ariaLabel).toBe('Backflow test-kit case: Potaflow project');
  });

  it('looks objects up by slug', () => {
    expect(objectBySlug('potaflow')?.id).toBe('kit');
    expect(objectBySlug('nope')).toBeUndefined();
  });

  it('every object points its metadata at a live fact', () => {
    for (const o of DESK_OBJECTS) expect(liveIds.has(o.metaFactId)).toBe(true);
  });
});

describe('settled claims', () => {
  const text = (slug: keyof typeof PANELS) => PANELS[slug].map(textOf).join(' ');
  const all = Object.keys(PANELS)
    .map((k) => text(k as keyof typeof PANELS))
    .join(' ');

  it('makes no backflow credential claim and leaves no TODO about one', () => {
    expect(all).not.toMatch(/licensed|credential|TODO: confirm(:| review)/i);
  });

  it('restores the two confirmed claims on How I build', () => {
    expect(text('how-i-build')).toContain('I write the spec');
    expect(text('how-i-build')).toContain("Nothing merges until I've read it");
  });

  it('never claims Carlos reviewed everything', () => {
    expect(all).not.toMatch(/reviewed everything|review every change/i);
  });

  it('links Potaflow to potaflow.com', () => {
    const link = PANELS.potaflow.find((b) => b.kind === 'link');
    expect(link && 'href' in link && link.href).toBe('https://potaflow.com');
  });

  it('marks Power Walk as in development, not public', () => {
    expect(text('power-walk')).toContain('TODO: in development');
    expect(text('power-walk')).not.toContain('confirm public name');
  });

  it('flags the placeholder photo and sketches that come forward', () => {
    expect(text('about')).toContain(
      '[TODO: Carlos: your framed photo (the print is a placeholder)]',
    );
    expect(text('this-site')).toContain(
      '[TODO: Carlos: your sketches of the desk (the notepad shows placeholders)]',
    );
  });
});

describe('the room', () => {
  const text = (slug: keyof typeof PANELS) => PANELS[slug].map(textOf).join(' ');
  const prose = (slug: keyof typeof PANELS) => PANELS[slug].find((b) => b.kind === 'prose');

  it('the Cars prose cites both car facts, and its TODO asks for his role and dates', () => {
    expect(prose('cars') && idsOf(prose('cars')!)).toEqual(expect.arrayContaining(['H01', 'H02']));
    const todo = PANELS.cars.find((b) => b.kind === 'todo');
    expect(todo && textOf(todo)).toMatch(/Start Toyota of Bayside/);
  });

  it('Coffee says it in his words, and asks for the rest', () => {
    expect(objectBySlug('coffee')?.metaFactId).toBe('H06');
    expect(text('coffee')).toMatch(/coffee addict/i);
    expect(text('coffee')).toContain('[TODO: Carlos');
  });

  it('the Soccer prose cites the soccer fact', () => {
    expect(prose('soccer') && idsOf(prose('soccer')!)).toContain('H03');
  });

  it('Travel names home, El Salvador, the magnet in the middle', () => {
    expect(prose('travel') && idsOf(prose('travel')!)).toContain('H05');
    expect(text('travel')).toContain('El Salvador');
  });

  it('Travel lists his places from the travel fact', () => {
    const places = PANELS.travel.find((b) => b.kind === 'places');
    expect(places && idsOf(places)).toEqual(['H04']);
    expect(text('travel')).toContain('Puerto Rico');
  });
});

describe('desk description', () => {
  it('describes every object for assistive tech', () => {
    const d = deskDescription();
    DESK_OBJECTS.forEach((o) => expect(d).toContain(o.ariaLabel));
  });
});

describe('panel eyebrows', () => {
  it.each([
    ['how-i-build', 'THE MONITOR · HOW I BUILD'],
    ['potaflow', 'THE KIT CASE · PROJECT 01'],
    ['this-site', 'THE NOTEPAD · PROJECT 03'],
  ] as const)('%s names its Workspace object', (slug, eyebrow) => {
    expect(PANELS[slug].find((b) => b.kind === 'eyebrow')).toEqual({
      kind: 'eyebrow',
      text: eyebrow,
    });
  });
});

describe("the window's weather, explained where the site describes itself", () => {
  const site = PANELS['this-site'];

  it('says where the weather comes from and what it never learns, as a draft', () => {
    const note = site.find((b) => b.kind === 'prose' && /Open-Meteo/.test(b.text));
    expect(note).toMatchObject({ kind: 'prose', draft: true });
    const text = (note as { text: string }).text;
    expect(text).toMatch(/time zone/);
    expect(text).toMatch(/never your location/i);
  });

  it("credits Open-Meteo's data under its licence", () => {
    expect(site).toContainEqual({
      kind: 'link',
      href: 'https://open-meteo.com/',
      label: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    });
  });
});
