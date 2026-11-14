import { objectBySlug, type SectionSlug } from '../content/objects';

/** '/potaflow' or '/potaflow/' → 'potaflow'; '/', '/classic' and unknown paths → null. */
export function slugFromPath(pathname: string): SectionSlug | null {
  const segment = pathname.replace(/^\/+|\/+$/g, '');
  return objectBySlug(segment)?.slug ?? null;
}

export function titleFor(slug: SectionSlug | null): string {
  const obj = slug ? objectBySlug(slug) : undefined;
  return obj ? `${obj.label} · Carlos Beltran` : 'Carlos Beltran · Senior Software Engineer';
}
