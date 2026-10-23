import { payPageSchema, payTokenSchema } from '@bom/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PayView } from '@/components/payment/pay-view';
import { container } from '@/components/ui';
import { copy } from '@/content/copy';
import { apiGetFresh } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getSettings } from '@/lib/data';

// The order's payment page (docs/finik/SPEC.md §0.1). A personal link: never indexed, never cached.

export const metadata: Metadata = {
  title: copy.pay.title,
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PayPage({ params, searchParams }: Props) {
  const { token } = await params;
  if (!payTokenSchema.safeParse(token).success) notFound();
  const [settings, page, query] = await Promise.all([
    getSettings(),
    // An API hiccup shows the "try again" state instead of an error page.
    apiGetFresh(`/pay/${token}`, payPageSchema).catch(() => undefined),
    searchParams,
  ]);
  if (page === null) notFound();

  return (
    <section className={cn(container, 'px-4 pt-6 pb-16 lg:pt-12')}>
      <div className="mx-auto w-full max-w-[480px]">
        <PayView
          token={token}
          initial={page ?? null}
          fromFinik={query.from === 'finik'}
          whatsapp={settings.shop.whatsapp}
          visa={settings.payments.visa}
        />
      </div>
    </section>
  );
}
