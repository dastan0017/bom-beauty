import { buildThemeVars } from '@bom/shared';
import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Analytics } from '@/components/analytics';
import { SiteOverlays } from '@/components/overlays/site-overlays';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { getProgramsSafe, getSettings } from '@/lib/data';
import { BASE_OPEN_GRAPH } from '@/lib/seo';
import { cormorant, notoKr, onest } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { seo, shop } = await getSettings();
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: { default: seo.defaultTitle || shop.name, template: `%s · ${shop.name}` },
    description: seo.defaultDescription || copy.meta.description,
    applicationName: shop.name,
    openGraph: { ...BASE_OPEN_GRAPH, siteName: shop.name },
    twitter: { card: 'summary_large_image' },
    verification: {
      ...(seo.googleVerification ? { google: seo.googleVerification } : {}),
      ...(seo.yandexVerification ? { yandex: seo.yandexVerification } : {}),
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, programs] = await Promise.all([getSettings(), getProgramsSafe()]);
  // Theme from "Оформление" in the admin; changing it revalidates the "settings" tag (no rebuild).
  const themeVars = buildThemeVars(settings.appearance) as CSSProperties;
  const themeColor = settings.appearance.headerColor;

  return (
    <html
      lang="ru"
      className={`${onest.variable} ${cormorant.variable} ${notoKr.variable}`}
      style={themeVars}
    >
      <head>
        <meta name="theme-color" content={themeColor} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <SiteOverlays
          whatsapp={settings.shop.whatsapp}
          currencies={settings.currencies}
          programs={programs}
          turnstileSiteKey={settings.turnstileSiteKey}
        >
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
          >
            {copy.common.skipToContent}
          </a>
          <SiteHeader whatsapp={settings.shop.whatsapp} multiCurrency={settings.currencies.length > 1} />
          <main id="main">{children}</main>
          <SiteFooter shop={settings.shop} />
        </SiteOverlays>
        <Analytics {...settings.analytics} />
      </body>
    </html>
  );
}
