import { DRAFT_MARK } from '@/content/panels';
import { tenSecondFacts } from '@/content/facts';
import { headerSummary, LINKS, showResume } from '@/content/links';
import { LampToggle } from './LampToggle';

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__intro">
        <h1 className="site-header__name">Carlos Beltran</h1>
        <p className="site-header__summary">
          {headerSummary()} <span className="draft-mark">{DRAFT_MARK}</span>
        </p>
        <p className="site-header__facts">{tenSecondFacts().join(' · ')}</p>
      </div>
      <div className="site-header__actions">
        {showResume() && (
          <a className="button button--primary" href={LINKS.resume}>
            Download résumé
          </a>
        )}
        <a href="/classic">Prefer a plain page? Classic version</a>
        <LampToggle />
      </div>
    </header>
  );
}
