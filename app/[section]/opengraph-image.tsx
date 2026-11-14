import { objectBySlug, SECTION_SLUGS } from '@/content/objects';
import { ogImage, OG_SIZE } from '@/lib/ogImage';

export const dynamicParams = false;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Carlos Beltran';

export function generateStaticParams() {
  return SECTION_SLUGS.map((section) => ({ section }));
}

export default async function Image({ params }: { params: Promise<{ section: string }> }) {
  const obj = objectBySlug((await params).section);
  return ogImage(obj?.label ?? 'Senior Software Engineer');
}
