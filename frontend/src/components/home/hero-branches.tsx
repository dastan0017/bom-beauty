import { cn } from '@/lib/cn';

// Sakura branches in full bloom beside Нурайым's photo in the home hero. Not in the design (ARCHITECTURE §15 D20).
// Each shape is defined once in a sprite and placed with <use>. Colours are mixed from theme variables, so they follow
// "Оформление".

// Blossom, radius 10: five notched petals drawn in order, so they overlap like a real flower, then stamens and anthers.
const PETALS = [
  'M0-.4C-2.9-1.3-5.3-4.3-4.6-7.6C-4.1-9.7-2-10.7-.7-9.7L0-8.9L.7-9.7C2-10.7 4.1-9.7 4.6-7.6C5.3-4.3 2.9-1.3 0-.4Z',
  'M.38-.12C.34-3.16 2.45-6.37 5.81-6.72C7.96-6.9 9.56-5.21 9.01-3.66L8.46-2.75L9.44-2.33C10.79-1.4 10.49 .9 8.65 2.03C5.73 3.71 2.13 2.36 .38-.12Z',
  'M.24 .32C3.11-.65 6.82 .36 8.19 3.44C9.02 5.44 7.91 7.48 6.27 7.44L5.23 7.2L5.14 8.26C4.67 9.83 2.38 10.26 .75 8.85C-1.76 6.59-1.58 2.76 .24 .32Z',
  'M-.24 .32C1.58 2.76 1.76 6.59-.75 8.85C-2.38 10.26-4.67 9.83-5.14 8.26L-5.23 7.2L-6.27 7.44C-7.91 7.48-9.02 5.44-8.19 3.44C-6.82 .36-3.11-.65-.24 .32Z',
  'M-.38-.12C-2.13 2.36-5.73 3.71-8.65 2.03C-10.49 .9-10.79-1.4-9.44-2.33L-8.46-2.75L-9.01-3.66C-9.56-5.21-7.96-6.9-5.81-6.72C-2.45-6.37-.34-3.16-.38-.12Z',
];
const STAMENS =
  'M.4-1.24Q1.26-2.75 1.55-4.76M.97-.87Q2.06-1.39 3.05-2.74M1.27-.27Q3.01-.28 4.89-1.04M1.24 .4Q2.23 1.09 3.9 1.27M.87 .97Q1.75 2.46 3.35 3.72M.27 1.27Q.17 2.48 .85 4.01M-.4 1.24Q-1.26 2.75-1.55 4.76M-.97 .87Q-2.06 1.39-3.05 2.74M-1.27 .27Q-3.01 .28-4.89 1.04M-1.24-.4Q-2.23-1.09-3.9-1.27M-.87-.97Q-1.75-2.46-3.35-3.72M-.27-1.27Q-.17-2.48-.85-4.01';
const ANTHERS =
  'M1.13-4.76a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M2.63-2.74a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M4.47-1.04a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M3.48 1.27a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M2.93 3.72a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M.43 4.01a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-1.97 4.76a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-3.47 2.74a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-5.31 1.04a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-4.32-1.27a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-3.77-3.72a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0M-1.27-4.01a.42 .42 0 1 0 .84 0 .42 .42 0 1 0-.84 0';
// Closed bud pointing up from the end of its stalk, its calyx, and the three petals of a half-open bud.
const BUD = 'M0 .2C-2.9-.6-3.6-5.2-.3-7.8.2-8.1.6-8 .9-7.6 3.5-4.9 2.9-.6 0 .2Z';
const CALYX = 'M-1.9-1C-1.8.3-.9 1 0 1S1.8.3 1.9-1C1.1-.4.5-.3 0-.3S-1.1-.4-1.9-1Z';
const HALF = [
  'M0 0C-3.6-1.6-6.4-5.6-4.9-8.6Q-3.4-9.4-2.6-7.9C-1.8-4.9-.8-2.2 0 0Z',
  'M0 0C3.6-1.6 6.4-5.6 4.9-8.6Q3.4-9.4 2.6-7.9C1.8-4.9 .8-2.2 0 0Z',
  'M0 0C-2.8-2-3.3-6.4-1.2-9.4L0-8.6L1.2-9.4C3.3-6.4 2.8-2 0 0Z',
];

/** x, y, rotation in degrees, scale. */
type Placement = readonly [number, number, number, number];

interface Branch {
  /** Tapered stems and twigs as one filled path. */
  stems: string;
  /** Stalks of buds and blossoms as one stroked path. */
  stalks: string;
  buds: readonly Placement[];
  halves: readonly Placement[];
  blossoms: readonly Placement[];
}

// Drawn in a 190×136 box from the outer edge (x 0) towards the photo (x 190); on phones y 26–122 is the photo. Nothing
// goes below y 120, where the desktop layer ends. The right branch is mirrored with CSS.
const LEFT: Branch = {
  stems:
    'M-7.6 51.8C22.3 45.6 56 41.5 91.8 47.4A1.4 1.4 0 0 0 92.2 44.6C56 38.5 21.7 42.4-8.4 48.2ZM91.7 47.4C123.5 55 151.4 74.6 175.6 104.3A.5 .5 0 0 0 176.4 103.7C152.6 73.4 124.5 53 92.3 44.6ZM88.2 46.2C104.4 36.7 122.2 26.6 146.1 20.4A.4 .4 0 0 0 145.9 19.6C121.8 25.4 103.6 35.3 87.2 44.4ZM32.5 44.4C36.5 34.3 42.3 28.4 50.1 24.3A.3 .3 0 0 0 49.9 23.7C41.7 27.6 35.5 33.7 31.1 43.8ZM130.4 62.9C146.2 58.5 160.1 52.4 174.1 48.3A.3 .3 0 0 0 173.9 47.7C159.9 51.6 145.8 57.5 130 61.7Z',
  stalks:
    'M146 20Q149.1 18 150.5 14.6M146 20Q149.1 20.4 151.9 19M146 20Q148.1 22.3 151.2 23M146 20Q147.2 17.1 146.5 14M105.6 35.5Q105.7 31.3 103.6 27.8M105.6 35.5Q108.7 32 109.4 27.3M176 104Q176.2 107.1 178.1 109.6M176 104Q177.8 106.6 180.7 107.7M176 104Q174.6 106.2 174.6 108.8M141.2 69.8Q138.4 73.5 138.1 78.2M141.2 69.8Q137.7 70.9 135.4 73.8M174 48Q176.9 46.9 178.7 44.3M174 48Q176.1 45 176.2 41.3M174 48Q176.3 49.2 178.9 48.9M50 24Q51.4 21.2 51 18.1M50 24Q52.9 22.8 54.6 20.1M50 24Q49.3 21 47 18.8M49.9 43.1Q48 46.8 48.5 51M49.9 43.1Q51 47.7 54.4 50.9M10.5 46.7Q8.3 49.6 8.1 53.3M96.8 47.3Q96.4 56.2 92 64M143.6 20.6Q145.7 24 146 28M169.1 49.5Q173.5 57.1 174 66M61.9 43.1Q63.3 48.6 62 54',
  buds: [
    [150.5, 14.6, 40, 0.95],
    [151.9, 19, 80, 0.85],
    [146.5, 14, 5, 0.8],
    [103.6, 27.8, -15, 0.85],
    [109.4, 27.3, 25, 0.8],
    [178.1, 109.6, 160, 0.9],
    [180.7, 107.7, 128, 0.85],
    [138.1, 78.2, 200, 0.85],
    [135.4, 73.8, 235, 0.8],
    [178.7, 44.3, 52, 0.85],
    [176.2, 41.3, 18, 0.8],
    [51, 18.1, 10, 0.85],
    [54.6, 20.1, 50, 0.8],
    [47, 18.8, -30, 0.8],
    [48.5, 51, 190, 0.85],
    [54.4, 50.9, 150, 0.8],
    [8.1, 53.3, 200, 0.8],
  ],
  halves: [
    [151.2, 23, 120, 0.85],
    [174.6, 108.8, 196, 0.85],
    [178.9, 48.9, 100, 0.8],
  ],
  blossoms: [
    [92, 64, -12, 1.05],
    [100, 36, 8, 1.3],
    [114, 56, 30, 1.35],
    [146, 28, 15, 1],
    [130, 22, -20, 1.2],
    [174, 66, -25, 1],
    [172, 102, 40, 0.95],
    [160, 84, 10, 1.25],
    [44, 30, 0, 1.05],
    [62, 54, 25, 0.95],
  ],
};

const RIGHT: Branch = {
  stems:
    'M-7.9 41.8C23.9 39.7 59.6 47.5 91.5 59.3A1.4 1.4 0 0 0 92.5 56.7C60.4 44.5 24.1 36.3-8.1 38.2ZM91.5 59.3C121.6 71 149.6 80.7 173.7 100.4A.5 .5 0 0 0 174.3 99.6C150.4 79.3 122.4 69 92.5 56.7ZM87.7 57.1C106.4 44.7 122.3 34.5 140.2 24.3A.4 .4 0 0 0 139.8 23.7C121.7 33.5 105.6 43.3 86.6 55.4ZM31.1 42.2C33.5 52.2 37.6 60.2 43.7 70.2A.3 .3 0 0 0 44.3 69.8C38.4 59.8 34.5 51.8 32.5 41.9ZM123.3 70.5C126.4 58.3 140.2 50.4 156.1 44.3A.3 .3 0 0 0 155.9 43.7C139.8 49.6 125.6 57.7 122.1 70.2Z',
  stalks:
    'M140 24Q142.7 21.5 143.5 17.9M140 24Q143.1 23.8 145.6 21.9M140 24Q140.4 20.9 139 18.1M174 100Q174.7 103 177 105.2M174 100Q175.9 101.8 178.4 102.3M174 100Q173.2 102.5 173.8 105M156 44Q159.6 43.2 162.1 40.5M156 44Q157.9 41.5 158.1 38.4M156 44Q158.8 45.4 161.9 45M44 70Q43.6 73.1 45 75.9M44 70Q41.7 72.1 41 75.2M44 70Q45.5 72.8 48.2 74.2M47.1 44.8Q47.6 40.1 45.5 35.9M47.1 44.8Q50.1 41.9 51.1 37.8M143.4 80Q140.9 83.4 140.7 87.5M143.4 80Q143.7 84.7 146.5 88.5M9.6 39.9Q11.3 36.6 10.8 33M95 59.2Q93.5 68.4 88 76M124.1 71Q123.1 76 120 80M143.1 49.6Q139.4 45.4 138 40M156 44Q163.2 51.8 166 62M161.7 90.8Q163 86.9 166 84M45.4 44.4Q45.2 37.9 48 32M44 70Q51.7 75.6 56 84',
  buds: [
    [143.5, 17.9, 30, 0.9],
    [145.6, 21.9, 70, 0.85],
    [177, 105.2, 150, 0.9],
    [173.8, 105, 182, 0.8],
    [162.1, 40.5, 60, 0.85],
    [158.1, 38.4, 20, 0.8],
    [161.9, 45, 100, 0.8],
    [45, 75.9, 170, 0.85],
    [48.2, 74.2, 135, 0.8],
    [45.5, 35.9, -10, 0.85],
    [51.1, 37.8, 30, 0.8],
    [140.7, 87.5, 200, 0.85],
    [146.5, 88.5, 160, 0.8],
    [10.8, 33, 10, 0.8],
  ],
  halves: [
    [139, 18.1, -10, 0.85],
    [178.4, 102.3, 118, 0.85],
    [41, 75.2, 210, 0.8],
  ],
  blossoms: [
    [88, 76, 20, 1.05],
    [120, 80, 35, 1.2],
    [104, 64, -10, 1.35],
    [138, 40, -20, 1],
    [120, 34, 15, 1.2],
    [176, 102, 30, 0.85],
    [166, 62, 5, 1.1],
    [166, 84, -15, 1.1],
    [48, 32, 10, 1.05],
    [56, 84, -10, 0.95],
  ],
};

// Petals from pale tips to a deep centre, stamens, stems and stalks.
const PALETTE = [
  '[--sakura-light:color-mix(in_srgb,var(--pk)_16%,var(--sf))]',
  '[--sakura-mid:color-mix(in_srgb,var(--pk)_36%,var(--sf))]',
  '[--sakura-deep:color-mix(in_srgb,var(--pk)_68%,var(--sf))]',
  '[--sakura-edge:color-mix(in_srgb,var(--pk)_46%,var(--sf))]',
  '[--sakura-heart:color-mix(in_srgb,var(--pk)_92%,var(--hink))]',
  '[--sakura-stem:color-mix(in_srgb,color-mix(in_srgb,var(--hmu)_68%,var(--pk))_86%,var(--sf))]',
  '[--sakura-stalk:color-mix(in_srgb,color-mix(in_srgb,var(--hmu)_55%,var(--pk))_72%,var(--sf))]',
].join(' ');

const ID = {
  flower: 'bb-sakura-flower',
  bud: 'bb-sakura-bud',
  half: 'bb-sakura-half',
  petalFill: 'bb-sakura-petal-fill',
  budFill: 'bb-sakura-bud-fill',
  halfFill: 'bb-sakura-half-fill',
} as const;

const place = ([x, y, rotate, scale]: Placement) => `translate(${x} ${y}) rotate(${rotate}) scale(${scale})`;

/** Shapes and gradients shared by both branches. */
function Sprite() {
  return (
    <svg width={0} height={0} focusable="false" className="absolute">
      <defs>
        <radialGradient id={ID.petalFill} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={10}>
          <stop offset={0.12} className="[stop-color:var(--sakura-deep)]" />
          <stop offset={0.5} className="[stop-color:var(--sakura-mid)]" />
          <stop offset={1} className="[stop-color:var(--sakura-light)]" />
        </radialGradient>
        <linearGradient id={ID.budFill} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={-8}>
          <stop offset={0} className="[stop-color:var(--sakura-deep)]" />
          <stop offset={1} className="[stop-color:var(--sakura-mid)]" />
        </linearGradient>
        <linearGradient id={ID.halfFill} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={-9}>
          <stop offset={0} className="[stop-color:var(--sakura-deep)]" />
          <stop offset={1} className="[stop-color:var(--sakura-light)]" />
        </linearGradient>
        <g id={ID.flower}>
          {PETALS.map((d) => (
            <path
              key={d}
              d={d}
              fill={`url(#${ID.petalFill})`}
              strokeWidth={0.3}
              className="stroke-(--sakura-edge)"
            />
          ))}
          <path
            d={STAMENS}
            fill="none"
            strokeWidth={0.26}
            strokeLinecap="round"
            className="stroke-(--sakura-heart)"
          />
          <path d={ANTHERS} className="fill-(--sakura-heart)" />
          <circle r={1.25} className="fill-(--sakura-heart)" />
        </g>
        <g id={ID.bud}>
          <path d={BUD} fill={`url(#${ID.budFill})`} />
          <path d={CALYX} className="fill-(--sakura-stalk)" />
        </g>
        <g id={ID.half}>
          {HALF.map((d) => (
            <path
              key={d}
              d={d}
              fill={`url(#${ID.halfFill})`}
              strokeWidth={0.3}
              className="stroke-(--sakura-edge)"
            />
          ))}
          <path d={CALYX} className="fill-(--sakura-stalk)" />
        </g>
      </defs>
    </svg>
  );
}

/** One branch; its outer end fades out where it does not reach the screen edge (tablets, desktop). */
function Sprig({ branch, className }: { branch: Branch; className: string }) {
  return (
    <svg
      viewBox="0 0 190 136"
      width={190}
      height={136}
      focusable="false"
      className={cn('absolute top-0 h-auto w-[190px] mask-l-from-75% lg:w-[247px]', className)}
    >
      <path d={branch.stems} className="fill-(--sakura-stem)" />
      <path
        d={branch.stalks}
        fill="none"
        strokeWidth={0.7}
        strokeLinecap="round"
        className="stroke-(--sakura-stalk)"
      />
      {branch.buds.map((bud) => (
        <use key={bud.join()} href={`#${ID.bud}`} transform={place(bud)} />
      ))}
      {branch.halves.map((half) => (
        <use key={half.join()} href={`#${ID.half}`} transform={place(half)} />
      ))}
      {branch.blossoms.map((blossom) => (
        <use key={blossom.join()} href={`#${ID.flower}`} transform={place(blossom)} />
      ))}
    </svg>
  );
}

/**
 * Decor layer behind the hero content, clipped to the photo zone above the delivery badge (hero top padding + 96 px
 * photo + 20 px gap), so it never moves or covers anything and cannot widen the page. The parent needs
 * `relative isolate`. Hidden where color-mix() is unsupported (iOS < 16.2): the fills would fall back to black.
 */
export function HeroBranches() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[142px] overflow-hidden supports-[color:color-mix(in_srgb,red,red)]:block lg:h-[164px]',
        PALETTE,
      )}
    >
      <Sprite />
      <Sprig branch={LEFT} className="right-[calc(50%+66px)] lg:right-[calc(50%+72px)]" />
      <Sprig branch={RIGHT} className="left-[calc(50%+66px)] -scale-x-100 lg:left-[calc(50%+72px)]" />
    </div>
  );
}
