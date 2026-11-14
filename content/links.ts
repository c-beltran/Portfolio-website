import { CAREER_START, yearsSince } from '../lib/dates';

/**
 * Contact links. No email address appears anywhere in the HTML; the résumé carries it.
 * [TODO: Q14 confirm the LinkedIn and GitHub handles are current]
 */
export const LINKS = {
  linkedin: 'https://www.linkedin.com/in/c-beltran/',
  github: 'https://github.com/c-beltran',
  resume: '/carlos-beltran-resume.pdf',
} as const;

const RESUME_AVAILABLE = process.env.NEXT_PUBLIC_RESUME_AVAILABLE === 'true';

export const RESUME_TODO = '[TODO: Q15 résumé PDF]';

/** The résumé link shows outside production, and only when the PDF exists (decision Q15). */
export function showResume(
  env: string | undefined = process.env.NEXT_PUBLIC_VERCEL_ENV,
  available: boolean = RESUME_AVAILABLE,
): boolean {
  return env !== 'production' && available;
}

/** Previews without the PDF show a visible TODO in its place; production shows nothing. */
export function showResumeTodo(
  env: string | undefined = process.env.NEXT_PUBLIC_VERCEL_ENV,
  available: boolean = RESUME_AVAILABLE,
): boolean {
  return env !== 'production' && !available;
}

/** Header summary (draft copy, cites F02, F01, F11). It never names the employer. */
export function headerSummary(now: Date = new Date()): string {
  return `Senior Software Engineer. ${yearsSince(CAREER_START, now)} years at the same company, through two renames. Lately I share the desk with a crew of AI agents.`;
}
