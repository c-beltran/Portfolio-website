import type { Metadata } from 'next';
import { Desk } from '@/components/desk/Desk';
import { renderFact } from '@/content/facts';
import { titleFor } from '@/lib/deskRoutes';

export const metadata: Metadata = { title: titleFor(null), description: renderFact('F02') };

export default function Home() {
  return <Desk initial={null} />;
}
