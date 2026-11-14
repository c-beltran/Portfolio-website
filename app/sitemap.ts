import type { MetadataRoute } from 'next';
import { SECTION_SLUGS } from '@/content/objects';

export const dynamic = 'force-static';

const SITE = 'https://cbeltran.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE },
    ...SECTION_SLUGS.map((slug) => ({ url: `${SITE}/${slug}` })),
    { url: `${SITE}/classic` },
  ];
}
