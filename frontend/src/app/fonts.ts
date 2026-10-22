import localFont from 'next/font/local';

// Self-hosted subsets (Latin + Cyrillic incl. Kyrgyz), see packages/config/fonts/README.md.
export const onest = localFont({
  src: '../../../packages/config/fonts/onest-var.woff2',
  weight: '400 700',
  style: 'normal',
  variable: '--font-onest',
  display: 'swap',
});

export const cormorant = localFont({
  src: [
    {
      path: '../../../packages/config/fonts/cormorant-garamond-600.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../../packages/config/fonts/cormorant-garamond-italic-600.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-cormorant',
  display: 'swap',
});

export const notoKr = localFont({
  src: '../../../packages/config/fonts/noto-sans-kr-bom.woff2',
  weight: '500',
  variable: '--font-noto-kr',
  display: 'swap',
  // One glyph (~1 KB), shown above the fold in the hero pill since October 2026.
  preload: true,
});
