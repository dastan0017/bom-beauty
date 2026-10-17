import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared';
import Link from 'next/link';
import { TrackedLink } from '@/components/header-client';
import { WhatsAppIcon } from '@/components/icons';
import { outlineButton, primaryButton } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getSettings } from '@/lib/data';

export default async function NotFound() {
  const { shop } = await getSettings();
  return (
    <section className="mx-auto flex max-w-[560px] flex-col items-center px-5 pt-16 text-center lg:pt-24">
      <span className="heading text-[calc(64px*var(--fhk))] leading-none text-highlight-2">404</span>
      <h1 className="mt-4 heading text-[calc(30px*var(--fhk))] leading-[1.1]">{copy.notFound.title}</h1>
      <p className="mt-3 text-base leading-normal text-balance text-muted">{copy.notFound.text}</p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <Link href="/programs" className={cn(primaryButton, 'h-14 text-base')}>
          {copy.notFound.toPrograms}
        </Link>
        <TrackedLink
          href={waLink(shop.whatsapp, GENERIC_QUESTION_MESSAGE)}
          event="whatsapp_click"
          place="not-found"
          className={cn(outlineButton, 'h-14 text-base')}
        >
          <WhatsAppIcon size={18} className="text-whatsapp" />
          {copy.programs.writeNurai}
        </TrackedLink>
      </div>
    </section>
  );
}
