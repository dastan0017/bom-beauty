import { copy } from '@/content/copy';
import { getProgram, getSettings } from '@/lib/data';
import { buildSchemePdf } from '@/lib/scheme-pdf';

/**
 * GET /programs/{slug}/scheme: the care scheme PDF generated from the program's products and steps, for programs
 * without an uploaded PDF (README §4). A plain link, so it also downloads without JavaScript.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [program, settings] = await Promise.all([getProgram(slug), getSettings()]);
  if (!program) return new Response('Not found', { status: 404 });
  const pdf = await buildSchemePdf(program, {
    accent: settings.appearance.accentColor,
    whatsapp: settings.shop.whatsapp,
  });
  const name = copy.program.scheme.fileName(program.title);
  return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      // ASCII fallback first, then the Russian name (RFC 6266).
      'Content-Disposition': `attachment; filename="scheme-${program.slug}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex',
    },
  });
}
