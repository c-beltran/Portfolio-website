import { cvScreen } from '@/content/faces';

/** The CV half, leaned in to: the name, the summary, the facts, the résumé and the Classic page. */
export function CvScreen() {
  const s = cvScreen();
  return (
    <div className="face face--cv">
      <p className="face__name">{s.name}</p>
      <p className="face__title">{s.title}</p>
      <p className="face__summary">{s.summary}</p>
      <ul className="face__facts">
        {s.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="face__row">
        {s.resume && 'href' in s.resume && (
          <a className="face__link" href={s.resume.href} tabIndex={-1}>
            Résumé
          </a>
        )}
        {s.resume && 'todo' in s.resume && <p className="face__todo">{s.resume.todo}</p>}
        <a className="face__link" href={s.classic} tabIndex={-1}>
          Classic version
        </a>
      </div>
    </div>
  );
}
