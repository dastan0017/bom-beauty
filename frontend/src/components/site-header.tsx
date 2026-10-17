import Image from 'next/image';
import Link from 'next/link';
import { copy } from '@/content/copy';

type Tab = 'catalog' | 'programs' | 'wholesale';

const TABS: { key: Tab; href: '/catalog' | '/programs' | '/wholesale' }[] = [
  { key: 'catalog', href: '/catalog' },
  { key: 'programs', href: '/programs' },
  { key: 'wholesale', href: '/wholesale' },
];

/** Header from design/Bom Beauty Prototype.dc.html: logo, WhatsApp, tabs. Currency picker arrives in M2. */
export function SiteHeader({ active, whatsappHref }: { active?: Tab; whatsappHref: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-header-line bg-header">
      <div className="flex h-14 items-center justify-between pr-4 pl-5">
        <Link href="/" aria-label={copy.header.logoAlt}>
          <Image
            src="/brand/bom-lockup-full.png"
            alt={copy.header.logoAlt}
            width={140}
            height={24}
            priority
            unoptimized
          />
        </Link>
        <a
          href={whatsappHref}
          aria-label={copy.header.whatsapp}
          className="flex size-11 items-center justify-center rounded-[var(--rw)] border border-[var(--wab)] bg-white text-ink"
        >
          <WhatsAppIcon />
        </a>
      </div>
      <nav className="mx-4 mb-2.5 flex gap-0.5 rounded-tabs bg-tabs-track p-0.5">
        {TABS.map((tab) =>
          tab.key === active ? (
            <span
              key={tab.key}
              aria-current="page"
              className="flex h-10 flex-1 items-center justify-center rounded-tab bg-white text-[15px] font-semibold text-tabs-active-ink shadow-[0_1px_3px_rgba(20,20,43,.12)]"
            >
              {copy.header.tabs[tab.key]}
            </span>
          ) : (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex h-10 flex-1 items-center justify-center rounded-tab text-[15px] font-semibold text-tabs-ink hover:bg-tabs-hover"
            >
              {copy.header.tabs[tab.key]}
            </Link>
          ),
        )}
      </nav>
    </header>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}
