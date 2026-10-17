import { SETTING_DEFAULTS, type ImageRef, type PublicSettings } from '@bom/shared';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import SiteOgImage from '@/app/opengraph-image';
import ProductOgImage from '@/app/catalog/[slug]/opengraph-image';
import { getProduct, getSettings } from '@/lib/data';

vi.mock('@/lib/data', () => ({ getSettings: vi.fn(), getProduct: vi.fn() }));

const GREEN = { r: 42, g: 127, b: 98 };
const PHOTO: ImageRef = {
  id: '0199a1b2-0000-7000-8000-000000000001',
  width: 1200,
  height: 630,
  alt: '',
  blurDataUrl: null,
  widths: [320, 640, 960, 1200],
};
let jpeg: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 1200, height: 630, channels: 3, background: GREEN } })
    .jpeg()
    .toBuffer();
});
afterEach(() => vi.restoreAllMocks());

function settingsWith(ogImage: ImageRef | null) {
  vi.mocked(getSettings).mockResolvedValue({
    appearance: SETTING_DEFAULTS.appearance,
    seo: { ...SETTING_DEFAULTS.seo, ogImage },
  } as unknown as PublicSettings);
}

const realFetch = globalThis.fetch;
const MEDIA = 'http://localhost:9000/bom-public/';

/** Media storage on a local host, as in dev; answers with the share copy or 404. Other requests pass through. */
function mediaStorage(found: boolean) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith(MEDIA)) return realFetch(input, init);
    return found
      ? new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } })
      : new Response('', { status: 404 });
  });
}

async function pixel(response: Response, x: number, y: number) {
  const png = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return { r: data[at], g: data[at + 1], b: data[at + 2], a: info.channels === 4 ? data[at + 3] : 255 };
}

const near = (value: { r?: number; g?: number; b?: number }, target: typeof GREEN) =>
  Math.abs((value.r ?? 0) - target.r) < 12 &&
  Math.abs((value.g ?? 0) - target.g) < 12 &&
  Math.abs((value.b ?? 0) - target.b) < 12;

describe('share cards', () => {
  it("draws the owner's share image, loaded from local media storage", async () => {
    settingsWith(PHOTO);
    const fetchSpy = mediaStorage(true);
    const center = await pixel(await SiteOgImage(), 600, 315);
    expect(near(center, GREEN)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:9000/bom-public/p/${PHOTO.id}/share.jpg`,
      expect.anything(),
    );
  });

  it('falls back to the branded card when the image cannot be loaded', async () => {
    settingsWith(PHOTO);
    mediaStorage(false);
    const center = await pixel(await SiteOgImage(), 600, 315);
    expect(center.a).toBe(255);
    expect(near(center, GREEN)).toBe(false);
  });

  it('shows the product photo on the product card', async () => {
    settingsWith(null);
    vi.mocked(getProduct).mockResolvedValue({
      name: 'Пенка',
      brand: 'Dr. SGN',
      volume: '150 мл',
      priceKgs: 1100,
      images: [PHOTO],
      image: PHOTO,
    } as unknown as Awaited<ReturnType<typeof getProduct>>);
    mediaStorage(true);
    const response = await ProductOgImage({ params: Promise.resolve({ slug: 'penka' }) });
    // The photo box sits on the right: 380 px wide, 72 px from the edge.
    expect(near(await pixel(response, 1200 - 72 - 190, 315), GREEN)).toBe(true);
  });
});
