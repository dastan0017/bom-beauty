import type { ProgramVariant } from '@bom/shared';
import {
  namedVariant,
  pickVariant,
  PROGRAM_VARIANT_LABELS,
  PROGRAM_VARIANTS,
  programDetailVariants,
} from '@bom/shared/web';
import { copy } from '@/content/copy';
import { getProgram, getSettings } from '@/lib/data';
import { buildSchemePdf } from '@/lib/scheme-pdf';

const isVariant = (value: string | null): value is ProgramVariant =>
  PROGRAM_VARIANTS.some((variant) => variant === value);

/**
 * GET /programs/{slug}/scheme[?variant=mini]: the care scheme PDF generated from the program's products and steps, for
 * programs without an uploaded PDF (README §4). A program with a choice builds it for the chosen variant; an unknown
 * or missing one means «Стандарт». A plain link, so it also downloads without JavaScript.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [program, settings] = await Promise.all([getProgram(slug), getSettings()]);
  if (!program) return new Response('Not found', { status: 404 });
  const wanted = new URL(request.url).searchParams.get('variant');
  const variants = programDetailVariants(program);
  const variant = pickVariant(variants, isVariant(wanted) ? wanted : 'standard');
  const named = namedVariant(variants, variant.variant);
  const pdf = await buildSchemePdf(program, variant, named, {
    accent: settings.appearance.accentColor,
    whatsapp: settings.shop.whatsapp,
  });
  const name = copy.program.scheme.fileName(program.title, named && PROGRAM_VARIANT_LABELS[named]);
  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      // ASCII fallback first, then the Russian name (RFC 6266).
      'Content-Disposition': `attachment; filename="scheme-${program.slug}${named ? `-${named}` : ''}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex',
    },
  });
}
