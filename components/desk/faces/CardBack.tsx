import { cardBack } from '@/content/faces';

/** The card's back: the links, real and clickable, out of the Tab order (the panel has them). */
export function CardBack() {
  const c = cardBack();
  return (
    <div className="face face--card">
      <ul className="face__links">
        {c.links.map((l) => (
          <li key={l.href}>
            <a className="face__link" href={l.href} tabIndex={-1}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      {c.todo && <p className="face__todo">{c.todo}</p>}
    </div>
  );
}
