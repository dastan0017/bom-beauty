import type { Metadata } from 'next';
import { TextPage } from '@/components/text-page';
import { copy } from '@/content/copy';
import { getContent } from '@/lib/data';

export const metadata: Metadata = {
  title: copy.pages.offer.title,
  alternates: { canonical: '/offer' },
};

export default async function OfferPage() {
  const content = await getContent('offer');
  if (!content) throw new Error('Content "offer" is missing');
  return <TextPage fallbackTitle={copy.pages.offer.title} markdown={content.data.markdown} />;
}
