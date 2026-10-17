import { ImageResponse } from 'next/og';
import { copy } from '@/content/copy';
import { getSettings } from '@/lib/data';
import { OG_CONTENT_TYPE, OG_SIZE, ogPhoto, renderOgCard } from '@/lib/og';

export const alt = copy.og.alt;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Site-wide share card: the owner's image from "SEO" settings, or a branded card. */
export default async function OpenGraphImage() {
  const { seo, appearance } = await getSettings();
  const photo = await ogPhoto(seo.ogImage);
  if (photo) {
    return new ImageResponse(
      <img src={photo} alt="" width={OG_SIZE.width} height={OG_SIZE.height} style={{ objectFit: 'cover' }} />,
      OG_SIZE,
    );
  }
  return renderOgCard({ appearance, title: copy.og.siteTitle, meta: copy.og.siteMeta });
}
