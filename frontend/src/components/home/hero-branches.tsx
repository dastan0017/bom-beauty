import { cn } from '@/lib/cn';

// Sakura branches in full bloom beside Нурайым's photo in the home hero. Not in the design (ARCHITECTURE §15 D20).
// Photos on a transparent background, pre-built as AVIF/WebP in public/decor (3:2, the same widths for both sides).
// Each branch grows from its screen edge towards the photo, so neither is mirrored. They keep their natural colours
// whatever the theme.

type Side = 'left' | 'right';

const WIDTHS = [400, 600, 800] as const;

const srcSet = (side: Side, format: 'avif' | 'webp') =>
  WIDTHS.map((width) => `/decor/sakura-${side}-${width}.${format} ${width}w`).join(', ');

// 190 px wide on phones, 247 px from lg; the outer end fades out where it does not reach the screen edge.
const SIDE = {
  left: 'right-[calc(50%+66px)] mask-l-from-75% lg:right-[calc(50%+72px)]',
  right: 'left-[calc(50%+66px)] mask-r-from-75% lg:left-[calc(50%+72px)]',
} as const;

function Branch({ side }: { side: Side }) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(side, 'avif')} sizes="(min-width: 1024px) 247px, 190px" />
      <source type="image/webp" srcSet={srcSet(side, 'webp')} sizes="(min-width: 1024px) 247px, 190px" />
      <img
        src={`/decor/sakura-${side}-400.webp`}
        alt=""
        width={600}
        height={400}
        decoding="async"
        fetchPriority="low"
        className={cn('absolute top-0 h-auto w-[190px] lg:w-[247px]', SIDE[side])}
      />
    </picture>
  );
}

/**
 * Decor layer behind the hero content, clipped to the photo zone above the delivery badge (hero top padding + 96 px
 * photo + 20 px gap), so it never moves or covers anything and cannot widen the page. The parent needs
 * `relative isolate`.
 */
export function HeroBranches() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[142px] overflow-hidden lg:h-[164px]"
    >
      <Branch side="left" />
      <Branch side="right" />
    </div>
  );
}
