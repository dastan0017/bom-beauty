import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { TextPage } from '@/components/text-page';
import { card, SectionTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getContent } from '@/lib/data';
import { excerpt, faqLd } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getContent('delivery').catch(() => null);
  return {
    title: copy.pages.delivery.title,
    ...(content ? { description: excerpt(content.data.markdown) } : {}),
    alternates: { canonical: '/delivery' },
  };
}

export default async function DeliveryPage() {
  const content = await getContent('delivery');
  if (!content) throw new Error('Delivery content is missing');
  const { markdown, faq } = content.data;
  return (
    <>
      {faq.length > 0 && <JsonLd data={faqLd(faq)} />}
      <TextPage fallbackTitle={copy.pages.delivery.title} markdown={markdown}>
        {faq.length > 0 && (
          <section className="flex flex-col gap-3.5 pt-14">
            <SectionTitle title={copy.pages.delivery.faq} />
            <div className={cn(card, 'flex flex-col')}>
              {faq.map((item, index) => (
                <details
                  key={item.q}
                  className={cn('group px-[18px] py-4', index > 0 && 'border-t border-line-2')}
                >
                  <summary className="cursor-pointer list-none text-base leading-[1.4] font-semibold marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-[15px] leading-[1.55] whitespace-pre-line text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </TextPage>
    </>
  );
}
