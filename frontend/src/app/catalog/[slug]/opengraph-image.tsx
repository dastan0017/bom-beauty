import { formatKgs } from '@bom/shared';
import { copy } from '@/content/copy';
import { getProduct, getSettings } from '@/lib/data';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/og';
import { imageUrl } from '@/lib/seo';

export const alt = copy.og.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const [product, { appearance }] = await Promise.all([getProduct((await params).slug), getSettings()]);
  if (!product) return renderOgCard({ appearance, title: copy.og.siteTitle, meta: copy.og.siteMeta });
  const photo = imageUrl(product.images[0] ?? product.image);
  return renderOgCard({
    appearance,
    eyebrow: `${product.brand} · ${product.volume}`,
    title: product.name,
    meta: formatKgs(product.priceKgs),
    ...(photo ? { image: photo } : {}),
  });
}
