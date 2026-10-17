import { buildThemeVars, DEFAULT_APPEARANCE } from '@bom/shared';
import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { cormorant, notoKr, onest } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: copy.meta.siteName, template: `%s · ${copy.meta.siteName}` },
  description: copy.meta.description,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // M2: appearance comes from GET /v1/settings/public (cache tag "settings").
  const themeVars = buildThemeVars(DEFAULT_APPEARANCE) as CSSProperties;

  return (
    <html
      lang="ru"
      className={`${onest.variable} ${cormorant.variable} ${notoKr.variable}`}
      style={themeVars}
    >
      <body className="bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
