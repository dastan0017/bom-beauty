import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildThemeVars, splitAccent, type Appearance, type ImageRef } from '@bom/shared';
import { ImageResponse } from 'next/og';
import { shareUrl } from './media';

// Open Graph cards (1200×630) rendered with next/og. Satori reads TTF but not WOFF2 or variable fonts, so static
// instances live in packages/config/fonts/og (traced into the standalone build, see next.config.ts).

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// Dev: cwd is frontend/. Standalone: cwd is .next/standalone/frontend and traced files sit next to it.
const FONT_DIR = join(process.cwd(), '..', 'packages', 'config', 'fonts', 'og');
const LOGO = join(process.cwd(), 'public', 'brand', 'bom-lockup-full.png');

function readAssets() {
  return Promise.all([
    readFile(join(FONT_DIR, 'onest-600.ttf')),
    readFile(join(FONT_DIR, 'cormorant-garamond-600.ttf')),
    readFile(join(FONT_DIR, 'cormorant-garamond-italic-600.ttf')),
    readFile(LOGO),
  ]).then(([onest, cormorant, cormorantItalic, logo]) => ({
    fonts: [
      { name: 'Onest', data: onest, weight: 600 as const, style: 'normal' as const },
      { name: 'Cormorant', data: cormorant, weight: 600 as const, style: 'normal' as const },
      { name: 'Cormorant', data: cormorantItalic, weight: 600 as const, style: 'italic' as const },
    ],
    logo: `data:image/png;base64,${logo.toString('base64')}`,
  }));
}

let assets: ReturnType<typeof readAssets> | null = null;

/**
 * The photo's JPEG share copy as a data URL for Satori, whose renderer draws no WebP or AVIF. Fetched here rather than
 * passed by URL, because next/og refuses image hosts on private addresses (media is on localhost in dev).
 * Undefined when there is no photo or it cannot be loaded.
 */
export async function ogPhoto(image: ImageRef | null | undefined): Promise<string | undefined> {
  if (!image) return undefined;
  try {
    const response = await fetch(shareUrl(image.id), { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return undefined;
    return `data:image/jpeg;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  } catch {
    return undefined;
  }
}

export interface OgCard {
  appearance: Appearance;
  eyebrow?: string;
  /** May contain one `*accent*` word. */
  title: string;
  meta?: string;
  /** Product photo shown on the right, as a data URL from `ogPhoto`. */
  image?: string;
}

export async function renderOgCard({
  appearance,
  eyebrow,
  title,
  meta,
  image,
}: OgCard): Promise<ImageResponse> {
  const { fonts, logo } = await (assets ??= readAssets());
  const vars = buildThemeVars(appearance);
  const ink = vars['--ink'] ?? '#14142B';
  const muted = vars['--mu'] ?? '#5B5F7A';
  const accent = appearance.accentColor;
  const soft = vars['--glow']?.startsWith('#') ? vars['--glow'] : '#FCEEF3';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: `linear-gradient(160deg, ${soft} 0%, #FFFFFF 70%)`,
        fontFamily: 'Onest',
        color: ink,
      }}
    >
      <div style={{ width: 18, height: '100%', background: appearance.headerColor, display: 'flex' }} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
        <img src={logo} alt="" width={258} height={44} style={{ width: 258, height: 44 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: image ? 640 : 960 }}>
          {eyebrow && <span style={{ fontSize: 30, color: accent }}>{eyebrow}</span>}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              fontFamily: 'Cormorant',
              fontSize: 84,
              lineHeight: 1.04,
            }}
          >
            {splitAccent(title).flatMap((part, partIndex) =>
              part.text
                .split(/\s+/)
                .filter(Boolean)
                .map((word, index) => (
                  <span
                    key={`${partIndex}-${index}`}
                    style={{
                      marginRight: 20,
                      fontStyle: part.accent ? 'italic' : 'normal',
                      color: part.accent ? accent : ink,
                    }}
                  >
                    {word}
                  </span>
                )),
            )}
          </div>
        </div>
        <span style={{ fontSize: 30, color: muted }}>{meta ?? ''}</span>
      </div>
      {image && (
        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 72 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
          <img
            src={image}
            alt=""
            width={380}
            height={380}
            style={{ width: 380, height: 380, objectFit: 'cover', borderRadius: 36, background: '#FFFFFF' }}
          />
        </div>
      )}
    </div>,
    { ...OG_SIZE, fonts },
  );
}
