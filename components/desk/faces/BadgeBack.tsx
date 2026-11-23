import { badgeBack } from '@/content/faces';

/** The badge's back: where Carlos works, the role, and how the company got its name. */
export function BadgeBack() {
  const b = badgeBack();
  return (
    <div className="face face--badge">
      <p className="face__heading">{b.heading}</p>
      {b.lines.map((l) => (
        <p key={l} className="face__line">
          {l}
        </p>
      ))}
      <p className="face__todo">{b.todo}</p>
    </div>
  );
}
