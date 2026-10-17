import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared';
import { SiteHeader } from '@/components/site-header';
import { copy } from '@/content/copy';

const SHOP_WHATSAPP = '+996706304803';

/** M0 placeholder for routes that M2 builds out. */
export function PlaceholderPage({ tab }: { tab: 'catalog' | 'programs' | 'wholesale' }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[1100px] bg-bg">
      <SiteHeader active={tab} whatsappHref={waLink(SHOP_WHATSAPP, GENERIC_QUESTION_MESSAGE)} />
      <section className="px-5 pt-6">
        <h1 className="heading text-[calc(33px*var(--fhk))] leading-[1.1]">{copy.header.tabs[tab]}</h1>
        <p className="mt-3.5 text-base text-muted">{copy.placeholder}</p>
      </section>
    </div>
  );
}
