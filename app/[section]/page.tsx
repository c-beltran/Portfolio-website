import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Desk } from '@/components/desk/Desk';
import { renderFact } from '@/content/facts';
import { objectBySlug, SECTION_SLUGS } from '@/content/objects';
import { titleFor } from '@/lib/deskRoutes';

type Params = { params: Promise<{ section: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTION_SLUGS.map((section) => ({ section }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const obj = objectBySlug((await params).section);
  if (!obj) return {};
  return { title: titleFor(obj.slug), description: renderFact(obj.metaFactId) };
}

export default async function SectionPage({ params }: Params) {
  const obj = objectBySlug((await params).section);
  if (!obj) notFound();
  return <Desk />;
}
