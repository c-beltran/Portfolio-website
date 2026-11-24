import Link from 'next/link';
import { Header } from '@/components/header/Header';
import type { Metadata } from 'next';
import { renderFact, statsFootnote } from '@/content/facts';
import type { FactId } from '@/content/factIds';
import { LINKS, RESUME_TODO, showResume, showResumeTodo } from '@/content/links';
import type { SectionSlug } from '@/content/objects';

export const metadata: Metadata = {
  title: 'Carlos Beltran · Classic',
  description: renderFact('F02'),
};

type ClassicSection = {
  heading: string;
  facts: FactId[];
  desk: { slug: SectionSlug; label: string }[];
};

const SECTIONS: ClassicSection[] = [
  {
    heading: 'Experience',
    facts: ['F01', 'F02', 'F03', 'F04', 'F06', 'F07', 'F08', 'F12'],
    desk: [
      { slug: 'cv', label: 'CV' },
      { slug: 'experience', label: 'Experience' },
    ],
  },
  {
    heading: 'How I build',
    facts: ['F09', 'F10', 'F11'],
    desk: [{ slug: 'how-i-build', label: 'How I build' }],
  },
  {
    heading: 'Projects',
    facts: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'],
    desk: [
      { slug: 'potaflow', label: 'Potaflow' },
      { slug: 'power-walk', label: 'Power Walk' },
      { slug: 'this-site', label: 'This site' },
    ],
  },
  { heading: 'Education', facts: ['E01'], desk: [] },
  { heading: 'About', facts: ['ABOUT'], desk: [{ slug: 'about', label: 'About' }] },
  // the room
  { heading: 'Cars', facts: ['H01', 'H02'], desk: [{ slug: 'cars', label: 'Cars' }] },
  { heading: 'Soccer', facts: ['H03'], desk: [{ slug: 'soccer', label: 'Soccer' }] },
  { heading: 'Travel', facts: ['H05', 'H04'], desk: [{ slug: 'travel', label: 'Travel' }] },
  { heading: 'Coffee', facts: ['H06'], desk: [{ slug: 'coffee', label: 'Coffee' }] },
];

function DeskLinks({ desk }: { desk: ClassicSection['desk'] }) {
  return (
    <p>
      Open on the desk:{' '}
      {desk.map((d, i) => (
        <span key={d.slug}>
          {i > 0 && ' · '}
          <Link href={`/${d.slug}`}>{d.label}</Link>
        </span>
      ))}
    </p>
  );
}

/** Tier 0: every fact as plain, semantic HTML. What search engines and screen readers rely on. */
export default function ClassicPage() {
  return (
    <>
      <Header />
      <main className="classic">
        {SECTIONS.map((section) => (
          <section key={section.heading} aria-labelledby={`classic-${section.heading}`}>
            <h2 id={`classic-${section.heading}`}>{section.heading}</h2>
            <ul>
              {section.facts.map((id) => (
                <li key={id} data-fact-id={id}>
                  {renderFact(id)}
                </li>
              ))}
            </ul>
            {section.desk.length > 0 && <DeskLinks desk={section.desk} />}
          </section>
        ))}
        <section aria-labelledby="classic-contact">
          <h2 id="classic-contact">Contact</h2>
          <ul>
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
          <p>[TODO: confirm the LinkedIn and GitHub handles are current]</p>
          <DeskLinks desk={[{ slug: 'contact', label: 'Contact' }]} />
        </section>
        <p className="classic__footnote">
          <small>{statsFootnote()}</small>
        </p>
      </main>
    </>
  );
}
