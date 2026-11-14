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

/** The résumé is hidden in production until the real PDF exists; preview builds show it. */
export function showResume(env: string | undefined = process.env.NEXT_PUBLIC_VERCEL_ENV): boolean {
  return env !== 'production';
}

/** Header summary (draft copy, cites F02, F01, F11). It never names the employer. */
export function headerSummary(now: Date = new Date()): string {
  return `Senior Software Engineer. ${yearsSince(CAREER_START, now)} years on the same ad platform, at the same desk. Lately I share it with a crew of AI agents.`;
}
