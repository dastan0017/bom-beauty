import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared';
import Image from 'next/image';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { CurrencyPicker, HeaderTabs, QuizPill, TrackedLink } from './header-client';
import { WhatsAppIcon } from './icons';

/** Header from the design: logo, currency picker, WhatsApp, tabs. One row with centred tabs from 1024 px. */
export function SiteHeader({ whatsapp, multiCurrency }: { whatsapp: string; multiCurrency: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-header-line bg-header">
      <div className="relative mx-auto max-w-[1100px] lg:flex lg:h-[68px] lg:items-center lg:gap-8 lg:px-6">
        <div className="flex h-14 items-center justify-between pr-4 pl-5 lg:contents">
          <Link href="/" aria-label={copy.header.logoAlt} className="flex-none lg:order-1">
            <Image
              src="/brand/bom-lockup-full.png"
              alt={copy.header.logoAlt}
              width={140}
              height={24}
              priority
              unoptimized
              className="h-6 w-auto"
            />
          </Link>
          <div className="flex items-center gap-2 lg:order-3 lg:ml-auto">
            {multiCurrency && <CurrencyPicker />}
            <TrackedLink
              href={waLink(whatsapp, GENERIC_QUESTION_MESSAGE)}
              event="whatsapp_click"
              place="header"
              aria-label={copy.header.whatsapp}
              className="flex size-11 items-center justify-center rounded-[var(--rw)] border border-[var(--wab)] bg-white text-ink"
            >
              <WhatsAppIcon size={22} />
            </TrackedLink>
          </div>
        </div>
        <HeaderTabs />
        <QuizPill />
      </div>
    </header>
  );
}
