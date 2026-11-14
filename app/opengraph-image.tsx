import { ogImage, OG_SIZE } from '@/lib/ogImage';

export const dynamic = 'force-static';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Carlos Beltran, Senior Software Engineer';

export default function Image() {
  return ogImage('Senior Software Engineer');
}
