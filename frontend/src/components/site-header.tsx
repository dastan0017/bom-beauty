import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared/web';
import Image from 'next/image';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { CurrencyPicker, HeaderPills, HeaderTabs, TrackedLink } from './header-client';
import { WhatsAppIcon } from './icons';

/** Header from the design: logo, currency picker, WhatsApp, tabs. One row with centred tabs from 1024 px. */
export function SiteHeader({ whatsapp, multiCurrency }: { whatsapp: string; multiCurrency: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-header-line bg-header">
      <div className="relative mx-auto max-w-[1100px] lg:flex lg:h-[68px] lg:items-center lg:gap-8 lg:px-6">
        {/* Narrow phones (README §8): the logo may shrink a few px, the right-hand group never does. */}
        <div className="flex h-14 items-center justify-between gap-2 pr-4 pl-5 lg:contents">
          <Link
            href="/"
            aria-label={copy.header.logoAlt}
            className="tap flex min-w-0 flex-[0_1_auto] lg:order-1 lg:flex-none"
          >
            <Image
              src="/brand/bom-lockup-full.png"
              alt={copy.header.logoAlt}
              width={140}
              height={24}
              priority
              unoptimized
              className="h-6 w-auto min-w-0 object-contain object-left"
            />
          </Link>
          <div className="flex flex-none items-center gap-1 lg:order-3 lg:ml-auto lg:gap-2">
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
        <HeaderPills />
      </div>
    </header>
  );
}
