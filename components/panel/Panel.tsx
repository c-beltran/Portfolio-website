import { renderFact, statsFootnote } from '@/content/facts';
import { LINKS, RESUME_TODO, showResume, showResumeTodo } from '@/content/links';
import type { SectionSlug } from '@/content/objects';
import { DRAFT_MARK, PANELS, type PanelBlock } from '@/content/panels';
import statsJson from '@/content/stats.json';
import type { Stats } from '@/content/stats.types';

const STATS = statsJson as Stats;

function Draft() {
  return <span className="draft-mark"> {DRAFT_MARK}</span>;
}

function Block({ block }: { block: PanelBlock }) {
  switch (block.kind) {
    case 'eyebrow':
      return <p className="panel__eyebrow">{block.text}</p>;
    case 'title':
      return (
        <h2 id="panel-title" className="panel__title" tabIndex={-1}>
          {block.text}
          <Draft />
        </h2>
      );
    case 'prose':
      return (
        <p className="panel__prose">
          {block.text}
          <Draft />
        </p>
      );
    case 'fact':
      return <p data-fact-id={block.fact}>{renderFact(block.fact)}</p>;
    case 'list':
      return (
        <ul className="panel__list">
          {block.facts.map((id) => (
            <li key={id} data-fact-id={id}>
              {renderFact(id)}
            </li>
          ))}
        </ul>
      );
    case 'stats':
      return (
        <dl className="panel__stats">
          {block.items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value(STATS)}</dd>
            </div>
          ))}
        </dl>
      );
    case 'link':
      return block.href === null ? (
        <p>
          {block.label} [TODO: {block.todo}]
        </p>
      ) : (
        <p>
          <a href={block.href}>{block.label}</a>
        </p>
      );
    case 'links':
      return (
        <ul className="panel__links">
          {showResume() && (
            <li>
              <a href={LINKS.resume}>Download résumé</a>
            </li>
          )}
          {showResumeTodo() && <li>{RESUME_TODO}</li>}
          <li>
            <a href={LINKS.linkedin}>LinkedIn</a>
          </li>
          <li>
            <a href={LINKS.github}>GitHub</a>
          </li>
        </ul>
      );
    case 'todo':
      return <p className="panel__todo">{block.text}</p>;
  }
}

const STAT_FACTS = new Set(['P02', 'P05', 'P06']);

/** Panels showing project stats also show their definition and date (spec §5). */
function hasProjectStats(blocks: PanelBlock[]): boolean {
  return blocks.some((b) => b.kind === 'stats' || (b.kind === 'fact' && STAT_FACTS.has(b.fact)));
}

type Props = { slug: SectionSlug | null; onClose: () => void };

/** The section panel (spec §2). Stays outside any canvas; announced politely. */
export function Panel({ slug, onClose }: Props) {
  if (slug === null) {
    return (
      <section className="panel" aria-live="polite" aria-label="Section">
        <p className="panel__hint">Pick a section above.</p>
      </section>
    );
  }
  return (
    <section className="panel" aria-live="polite" aria-labelledby="panel-title">
      {PANELS[slug].map((block, i) => (
        <Block key={i} block={block} />
      ))}
      {hasProjectStats(PANELS[slug]) && (
        <p className="panel__footnote">
          <small>{statsFootnote()}</small>
        </p>
      )}
      <button type="button" className="panel__back" onClick={onClose}>
        Back to desk
      </button>
    </section>
  );
}
