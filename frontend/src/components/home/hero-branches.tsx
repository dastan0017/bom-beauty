import { cn } from '@/lib/cn';

// Sakura branches beside Нурайым's photo in the home hero. Not in the design (ARCHITECTURE §15 D20): thin, sparse,
// petals notched like the logo's flower. Colours are mixed from theme variables, so they follow "Оформление".

const FLOWER =
  'M0-1.6C-2.5-2.6-4.3-5.8-3-9.1Q-1.5-10.6 0-8.5Q1.5-10.6 3-9.1C4.3-5.8 2.5-2.6 0-1.6ZM1.5-.5C1.7-3.2 4.2-5.9 7.7-5.7Q9.6-4.7 8.1-2.6Q10.5-1.8 9.6 0C6.8 2.3 3.2 1.6 1.5-.5ZM.9 1.3C3.6 .6 6.9 2.2 7.8 5.6Q7.4 7.7 5 6.9Q5 9.5 2.9 9.1C-.1 7.2-.5 3.6 .9 1.3ZM-.9 1.3C.5 3.6 .1 7.2-2.9 9.1Q-5 9.5-5 6.9Q-7.4 7.7-7.8 5.6C-6.9 2.2-3.6 .6-.9 1.3ZM-1.5-.5C-3.2 1.6-6.8 2.3-9.6 0Q-10.5-1.8-8.1-2.6Q-9.6-4.7-7.7-5.7C-4.2-5.9-1.7-3.2-1.5-.5Z';
const BUD = 'M0 0C-3-1-3.4-5.4 0-7.4 3.4-5.4 3-1 0 0Z';
const CALYX = 'M-2.4-1.6C-2.2.2-1.1 1 0 1S2.2.2 2.4-1.6C1.4-.9.7-.7 0-.7S-1.4-.9-2.4-1.6Z';

const STEM_FILL = 'fill-[color-mix(in_srgb,color-mix(in_srgb,var(--hmu)_70%,var(--pk))_62%,var(--sf))]';
const PETAL_FILL = 'fill-[color-mix(in_srgb,var(--pk)_26%,var(--sf))]';
const BUD_FILL = 'fill-[color-mix(in_srgb,var(--pk)_40%,var(--sf))]';
const HEART_FILL = 'fill-[color-mix(in_srgb,var(--pk)_55%,var(--sf))]';

/** x, y, rotation in degrees, scale. */
type Placement = readonly [number, number, number, number];

interface Branch {
  /** Tapered stems and twigs as one filled path. */
  stems: string;
  blossoms: readonly Placement[];
  buds: readonly Placement[];
}

// Drawn in a 190×136 box from the outer edge (x 0) towards the photo (x 190); on phones y 26–122 is the photo.
// The right branch is the same kind of drawing, mirrored with CSS.
const LEFT: Branch = {
  stems:
    'M-5.4 63.6C30.4 49.5 70 43.4 103.8 49.2A1.2 1.2 0 0 0 104.2 46.8C70 40.6 29.6 46.5-6.6 60.4ZM103.8 49.2C127.7 52.9 149.5 64.6 165.6 84.3A.5 .5 0 0 0 166.4 83.7C150.5 63.4 128.3 51.1 104.2 46.8ZM104.7 48.3C107.4 41.5 109.8 35.5 111.4 31.2A.5 .5 0 0 0 110.6 30.8C108.7 35 106.2 40.9 103.3 47.7ZM135.4 58.5C137.3 52.5 139.2 48.6 144 45.6A.4 .4 0 0 0 143.6 44.9C138.5 47.9 136.3 52 134.2 58.1Z',
  blossoms: [
    [112, 28, 8, 1.3],
    [166, 88, -12, 1.1],
  ],
  buds: [[143.8, 45.3, 20, 1]],
};

const RIGHT: Branch = {
  stems:
    'M-5.9 39.7C33.9 37.5 67.7 43.3 97.6 53.1A1.2 1.2 0 0 0 98.4 50.9C68.3 40.7 34.1 34.5-6.1 36.3ZM97.6 53.1C121.6 60.9 143.5 74.5 160.6 95.3A.5 .5 0 0 0 161.4 94.7C144.5 73.5 122.4 59.1 98.4 50.9ZM97.2 52.2C99.7 60.2 102 67.2 103.6 72.1A.5 .5 0 0 0 104.4 71.9C103 66.8 101.1 59.8 98.8 51.8ZM132.8 68.7C133.7 62.8 135.5 58.9 140.4 54.9A.4 .4 0 0 0 139.9 54.3C134.7 58.3 132.6 62.4 131.5 68.5Z',
  blossoms: [
    [105, 76, 20, 1.2],
    [161, 99, 4, 1.05],
  ],
  buds: [[140.1, 54.6, 26, 1]],
};

const place = ([x, y, rotate, scale]: Placement) => `translate(${x} ${y}) rotate(${rotate}) scale(${scale})`;

/** One branch; its outer end fades out where it does not reach the screen edge (tablets, desktop). */
function Sprig({ branch, className }: { branch: Branch; className: string }) {
  return (
    <svg
      viewBox="0 0 190 136"
      width={190}
      height={136}
      focusable="false"
      className={cn('absolute top-0 h-auto w-[190px] mask-l-from-60% lg:w-[247px]', STEM_FILL, className)}
    >
      <path d={branch.stems} />
      {branch.buds.map((bud) => (
        <g key={bud.join()} transform={place(bud)}>
          <path d={BUD} className={BUD_FILL} />
          <path d={CALYX} />
        </g>
      ))}
      {branch.blossoms.map((blossom) => (
        <g key={blossom.join()} transform={place(blossom)}>
          <path d={FLOWER} className={PETAL_FILL} />
          <circle r={1.7} className={HEART_FILL} />
        </g>
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
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[142px] overflow-hidden supports-[color:color-mix(in_srgb,red,red)]:block lg:h-[164px]"
    >
      <Sprig branch={LEFT} className="right-[calc(50%+66px)] lg:right-[calc(50%+72px)]" />
      <Sprig branch={RIGHT} className="left-[calc(50%+66px)] -scale-x-100 lg:left-[calc(50%+72px)]" />
    </div>
  );
}
