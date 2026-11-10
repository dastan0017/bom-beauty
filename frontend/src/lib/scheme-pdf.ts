import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import type { ProgramDetail, ProgramVariant, ProgramVariantDetail } from '@bom/shared';
import { PROGRAM_VARIANT_LABELS, productsWord } from '@bom/shared/web';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { copy } from '@/content/copy';

// Care scheme PDF built on the fly when the owner has not uploaded one (design/updates-2026-10/README.md §4). The
// layout is the design's 1240 px wide canvas mapped onto A4; text is real text in Onest, so it stays selectable.

// Dev: cwd is frontend/. Standalone: cwd is .next/standalone/frontend and traced files sit next to it.
const FONT_DIR = join(process.cwd(), '..', 'packages', 'config', 'fonts', 'pdf');

const A4 = { width: 595.28, height: 841.89 };
const CANVAS = { width: 1240, height: 1754 };
/** Design px → PDF points. */
const K = A4.width / CANVAS.width;
const LEFT = 100;
const RIGHT = CANVAS.width - 100;

const INK = hex('#14142B');
const MUTED = hex('#5B5F7A');
const RULE = hex('#EEF0F5');

const readFont = (weight: number) => readFile(join(FONT_DIR, `onest-${weight}.ttf`));
let fonts: Promise<[Buffer, Buffer, Buffer]> | undefined;
const readFonts = () => (fonts ??= Promise.all([readFont(400), readFont(600), readFont(700)]));

function hex(value: string): RGB {
  const clean = /^#?([0-9a-f]{6})$/i.exec(value)?.[1] ?? 'D12F63';
  const channel = (offset: number) => parseInt(clean.slice(offset, offset + 2), 16) / 255;
  return rgb(channel(0), channel(2), channel(4));
}

/** Greedy word wrap in design px. */
function wrap(text: string, font: PDFFont, sizePx: number, maxPx: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(test, sizePx * K) / K > maxPx) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export interface SchemeOptions {
  /** Theme accent from "Оформление". */
  accent: string;
  /** Shop WhatsApp, any format. */
  whatsapp: string;
}

/**
 * The scheme of one variant: its products, and the program's steps for those products (design: sAm / sPm). `named`
 * is set for a program with a choice, which adds the variant to the subtitle and the title.
 */
export async function buildSchemePdf(
  program: ProgramDetail,
  variant: Pick<ProgramVariantDetail, 'items'>,
  named: ProgramVariant | null,
  options: SchemeOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [file400, file600, file700] = await readFonts();
  const embed = (file: Buffer) => pdf.embedFont(new Uint8Array(file), { subset: true });
  const [regular, semibold, bold] = await Promise.all([embed(file400), embed(file600), embed(file700)]);
  const label = named && PROGRAM_VARIANT_LABELS[named];
  pdf.setTitle(copy.program.scheme.fileName(program.title, label).replace(/\.pdf$/, ''));
  pdf.setAuthor(copy.program.scheme.brand);
  pdf.setLanguage('ru');

  const accent = hex(options.accent);
  const page = pdf.addPage([A4.width, A4.height]);
  // y is the text baseline in design px from the top, as on the prototype's canvas.
  const text = (
    target: PDFPage,
    value: string,
    x: number,
    y: number,
    font: PDFFont,
    sizePx: number,
    color: RGB,
    align: 'left' | 'right' | 'center' = 'left',
  ) => {
    const width = font.widthOfTextAtSize(value, sizePx * K) / K;
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    target.drawText(value, { x: left * K, y: (CANVAS.height - y) * K, size: sizePx * K, font, color });
  };
  const rect = (x: number, y: number, width: number, height: number, color: RGB) =>
    page.drawRectangle({
      x: x * K,
      y: (CANVAS.height - y - height) * K,
      width: width * K,
      height: height * K,
      color,
    });

  let y = 120;
  text(page, copy.program.scheme.brand, LEFT, y, bold, 34, accent);
  text(page, copy.program.scheme.from, RIGHT, y, regular, 26, MUTED, 'right');

  y += 100;
  for (const line of wrap(program.title, bold, 60, RIGHT - LEFT)) {
    text(page, line, LEFT, y, bold, 60, INK);
    y += 72;
  }
  const count = variant.items.length;
  const subtitle = `${count} ${productsWord(count)}${program.course ? ` · ${program.course}` : ''}`;
  text(page, label ? `${label} · ${subtitle}` : subtitle, LEFT, y, regular, 30, MUTED);
  y += 44;
  rect(LEFT, y, RIGHT - LEFT, 4, accent);
  y += 84;

  const nameOf = new Map(variant.items.map((item) => [item.slug, item.name]));
  // Steps of products outside the variant are left out.
  const inVariant = (step: ProgramDetail['steps']['am'][number]) => nameOf.has(step.productSlug);
  const am = program.steps.am.filter(inVariant);
  const pm = program.steps.pm.filter(inVariant);
  const block = (title: string, steps: ProgramDetail['steps']['am']) => {
    if (!steps.length) return;
    text(page, title, LEFT, y, bold, 42, INK);
    y += 62;
    steps.forEach((step, index) => {
      page.drawCircle({ x: (LEFT + 22) * K, y: (CANVAS.height - (y - 10)) * K, size: 22 * K, color: accent });
      text(page, String(index + 1), LEFT + 22, y - 2, bold, 24, rgb(1, 1, 1), 'center');
      text(page, nameOf.get(step.productSlug) ?? step.title, LEFT + 66, y, semibold, 30, INK);
      y += 40;
      for (const line of wrap(step.text, regular, 26, RIGHT - LEFT - 66)) {
        text(page, line, LEFT + 66, y, regular, 26, MUTED);
        y += 34;
      }
      y += 18;
    });
    y += 36;
  };
  block(copy.program.scheme.am, am);
  block(copy.program.scheme.pm, pm);
  // Programs without steps list their products instead.
  if (!am.length && !pm.length) {
    text(page, copy.program.scheme.products, LEFT, y, bold, 42, INK);
    y += 60;
    for (const item of variant.items) {
      text(page, `•  ${item.name} — ${item.brand}, ${item.volume}`, LEFT, y, regular, 30, INK);
      y += 46;
    }
  }

  rect(LEFT, CANVAS.height - 150, RIGHT - LEFT, 2, RULE);
  const phone = options.whatsapp.replace(/\D/g, '');
  text(page, copy.program.scheme.contact(phone), LEFT, CANVAS.height - 96, regular, 24, MUTED);
  text(page, copy.program.scheme.site, RIGHT, CANVAS.height - 96, regular, 24, MUTED, 'right');

  return pdf.save();
}
