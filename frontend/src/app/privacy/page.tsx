import type { Metadata } from 'next';
import { TextPage } from '@/components/text-page';
import { copy } from '@/content/copy';
import { getContent } from '@/lib/data';

export const metadata: Metadata = {
  title: copy.pages.privacy.title,
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  const content = await getContent('privacy');
  if (!content) throw new Error('Content "privacy" is missing');
  return <TextPage fallbackTitle={copy.pages.privacy.title} markdown={content.data.markdown} />;
}
