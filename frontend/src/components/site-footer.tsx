import { formatPhoneDisplay } from '@bom/shared';
import type { PublicSettings } from '@bom/shared';
import { GENERIC_QUESTION_MESSAGE, waLink } from '@bom/shared/web';
import Image from 'next/image';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { TrackedLink } from './header-client';
import { InstagramIcon, WhatsAppIcon } from './icons';

/** Footer from the design, plus links to the delivery and legal pages (brief). */
export function SiteFooter({ shop }: { shop: PublicSettings['shop'] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer mt-[72px] bg-footer text-footer-muted">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 pt-9 pb-[30px] lg:grid lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-x-12 lg:px-6 lg:pt-12">
        <div className="flex flex-col gap-4">
          {/* Coloured footers use the dark lockup, dark footers the white one (theme vars --ftc / --ftw). */}
          <Image
            src="/brand/bom-lockup-full-white.png"
            alt={copy.header.logoAlt}
            width={152}
            height={26}
            unoptimized
            className="[display:var(--ftw,block)] h-[26px] w-auto self-start"
          />
          <Image
            src="/brand/bom-lockup-full.png"
            alt={copy.header.logoAlt}
            width={152}
            height={26}
            unoptimized
            className="[display:var(--ftc,none)] h-[26px] w-auto self-start"
          />
          <p className="text-sm leading-[1.6] text-pretty">
            <span lang="ko" className="font-korean text-footer-ink">
              봄
            </span>
            {copy.footer.korean}
          </p>
        </div>
        <nav
          aria-label={copy.footer.sections}
          className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-semibold text-footer-ink lg:flex-col lg:gap-y-0"
        >
          <Link href="/catalog" className="tap flex h-10 items-center">
            {copy.header.tabs.catalog}
          </Link>
          <Link href="/programs" className="tap flex h-10 items-center">
            {copy.header.tabs.programs}
          </Link>
          <Link href="/wholesale" className="tap flex h-10 items-center">
            {copy.header.tabs.wholesale}
          </Link>
          <Link href="/delivery" className="tap flex h-10 items-center">
            {copy.footer.delivery}
          </Link>
        </nav>
        <div className="flex flex-col gap-0.5 text-[15px] text-footer-ink">
          <TrackedLink
            href={waLink(shop.whatsapp, GENERIC_QUESTION_MESSAGE)}
            event="whatsapp_click"
            place="footer"
            className="tap flex h-10 items-center gap-2.5"
          >
            <WhatsAppIcon size={18} />
            {formatPhoneDisplay(shop.whatsapp)}
          </TrackedLink>
          {shop.instagramShop && (
            <TrackedLink
              href={`https://instagram.com/${shop.instagramShop}`}
              event="instagram_click"
              place="footer"
              className="tap flex h-10 items-center gap-2.5"
            >
              <InstagramIcon size={18} />@{shop.instagramShop}
            </TrackedLink>
          )}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-footer-line pt-5 text-[13px] leading-normal lg:col-span-3">
          {shop.footerNote && <span>{shop.footerNote}</span>}
          <span>
            © {year} {shop.name}
            {shop.legalLine ? ` · ${shop.legalLine}` : ''}
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="tap underline-offset-2 hover:underline">
              {copy.footer.privacy}
            </Link>
            <Link href="/offer" className="tap underline-offset-2 hover:underline">
              {copy.footer.offer}
            </Link>
          </span>
          <span>{copy.footer.disclaimer}</span>
        </div>
      </div>
    </footer>
  );
}
