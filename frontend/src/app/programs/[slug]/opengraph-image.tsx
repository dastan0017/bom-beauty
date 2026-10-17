import { formatKgs } from '@bom/shared/web';
import { copy } from '@/content/copy';
import { getProgram, getSettings } from '@/lib/data';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/og';
import { productsCount } from '@/lib/words';

export const alt = copy.og.programEyebrow;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function ProgramOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const [program, { appearance }] = await Promise.all([getProgram((await params).slug), getSettings()]);
  if (!program) return renderOgCard({ appearance, title: copy.og.siteTitle, meta: copy.og.siteMeta });
  return renderOgCard({
    appearance,
    eyebrow: copy.og.programEyebrow,
    title: program.headline ? `${copy.program.careFor}*${program.headline}*` : program.title,
    meta: `${productsCount(program.items.length)} · ${formatKgs(program.priceKgs)}`,
  });
}
