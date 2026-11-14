'use client';

import type { FileRef, ProgramDetail, ProgramVariant, ProgramVariantDetail, VideoRef } from '@bom/shared';
import {
  buildSchemeRequestMessage,
  namedVariant,
  parseVariant,
  pickVariant,
  PROGRAM_VARIANT_LABELS,
  PROGRAM_VARIANT_NOTES,
  waLink,
  withVariant,
} from '@bom/shared/web';
import Link from 'next/link';
import {
  createContext,
  use,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { track } from '@/lib/submission';
import { formatBytes, formatMinutes, productsCount, productsGenitive } from '@/lib/words';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price, useCurrency } from '../currency';
import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon, PlayIcon } from '../icons';
import { useOverlays, type OrderItem } from '../overlays/site-overlays';
import { StickyBar } from '../sticky-bar';
import { BackLink, card, primaryButton } from '../ui';

type ProgramForOrder = Pick<ProgramDetail, 'slug' | 'title' | 'headline' | 'course'> & {
  image: OrderItem['image'];
};

// ───────────── Variants (design: set.tiers, tierPick) ─────────────

interface VariantState {
  variants: ProgramVariantDetail[];
  current: ProgramVariantDetail;
  /** The variant to name in labels and messages; null for a program without a choice. */
  named: ProgramVariant | null;
  select: (variant: ProgramVariant) => void;
}

const VariantContext = createContext<VariantState | null>(null);

function useVariant(): VariantState {
  const value = use(VariantContext);
  if (!value) throw new Error('useVariant outside ProgramVariantProvider');
  return value;
}

/**
 * The variant chosen on the program page. «Оптимальный уход» first, or the quiz's suggestion when the visitor came from
 * the quiz results (design: recTier); a card's variant row (`?variant=mini`, D48) and then the visitor's own choice win.
 * Switching keeps the state only, the URL stays the same.
 */
export function ProgramVariantProvider({
  slug,
  variants,
  children,
}: {
  slug: string;
  variants: ProgramVariantDetail[];
  children: ReactNode;
}) {
  const { quizDone, quizPickedSlug, quizVariant } = useOverlays();
  const [picked, setPicked] = useState<ProgramVariant | null>(null);
  const linked = useLinkedVariant();
  const fromQuiz = quizDone && quizPickedSlug === slug ? quizVariant : null;
  const current = pickVariant(variants, picked ?? linked ?? fromQuiz ?? 'standard');
  const value: VariantState = {
    variants,
    current,
    named: namedVariant(variants, current.variant),
    select: setPicked,
  };
  return <VariantContext value={value}>{children}</VariantContext>;
}

const onHistory = (change: () => void) => {
  window.addEventListener('popstate', change);
  return () => window.removeEventListener('popstate', change);
};

/**
 * `?variant=` of the page's address. The page is static, so it is read in the browser only: the server and the first
 * render show the main variant (also without JS), then the linked one.
 */
function useLinkedVariant(): ProgramVariant | null {
  return useSyncExternalStore(
    onHistory,
    () => parseVariant(new URLSearchParams(window.location.search).get('variant')),
    () => null,
  );
}

/** «Готовая программа из 5 средств» under the heading. */
export function ProgramReadyOf() {
  const { current } = useVariant();
  return <>{copy.program.readyOf(productsGenitive(current.itemCount))}</>;
}

/** «5 средств полного объёма — хватит на весь курс» under «Что входит в программу». */
export function ProgramContentsLead() {
  const { current } = useVariant();
  return <>{copy.program.contentsLead(productsCount(current.itemCount))}</>;
}

/**
 * Базовый уход / Оптимальный уход / Интенсивный курс under «Что входит в программу», with the chosen variant's note
 * below; only for programs with a choice. A radio group: arrow keys move the choice, Tab leaves it. Names wrap to two
 * lines on phones.
 */
export function VariantSwitch() {
  const { variants, current, select } = useVariant();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (variants.length < 2) return null;

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + variants.length) % variants.length;
    const target = variants[next];
    if (!target) return;
    select(target.variant);
    buttons.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label={copy.program.variantsLabel}
        className="flex gap-1 rounded-2xl bg-surface-2 p-1"
      >
        {variants.map((variant, index) => {
          const on = variant.variant === current.variant;
          return (
            <button
              key={variant.variant}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => select(variant.variant)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'flex min-h-14 min-w-0 flex-[1_1_0] flex-col items-center justify-center gap-[3px] rounded-xl px-1 py-2 text-center transition-[background-color,box-shadow] duration-150',
                on && 'bg-surface shadow-[0_2px_8px_rgba(20,20,43,.10)]',
              )}
            >
              <span
                className={cn(
                  'text-[15px] leading-[1.2] text-balance',
                  on ? 'font-bold text-ink' : 'font-semibold text-muted',
                )}
              >
                {PROGRAM_VARIANT_LABELS[variant.variant]}
              </span>
              <span className="text-[13px] leading-[1.2] whitespace-nowrap text-muted">
                {productsCount(variant.itemCount)}
              </span>
              <span
                className={cn(
                  'text-sm leading-[1.2] font-semibold whitespace-nowrap',
                  on ? 'text-ink' : 'text-muted',
                )}
              >
                <Price kgs={variant.priceKgs} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-1 text-sm leading-[1.45] text-muted">
        <span className="font-semibold text-ink">
          {copy.program.variantName(PROGRAM_VARIANT_LABELS[current.variant])}
        </span>
        {/* The dash is the design's own text (README variants: caption). */}
        {` — ${PROGRAM_VARIANT_NOTES[current.variant]}`}
      </p>
    </div>
  );
}

/** The chosen variant's products under «Что входит в программу». */
export function ProgramItems() {
  const { current } = useVariant();
  return (
    <ul className={cn(card, 'flex flex-col')}>
      {current.items.map((item, index) => (
        <li key={item.slug} className={cn(index > 0 && 'border-t border-line-2')}>
          <Link href={`/catalog/${item.slug}`} className="flex items-center gap-3.5 px-4 py-3.5">
            <span className="relative flex size-[60px] flex-none items-center justify-center overflow-hidden rounded-xl bg-surface-2">
              <BbImage
                image={item.image}
                sizes="60px"
                width={120}
                alt={item.name}
                placeholder={<PhotoPlaceholder label={copy.common.photo} className="text-[10px]" />}
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base leading-[1.3] font-semibold">{item.name}</span>
              <span className="text-[15px] leading-[1.4] text-muted">{item.purpose}</span>
            </span>
            <span className="flex-none text-[15px] whitespace-nowrap text-muted">
              <Price kgs={item.priceKgs} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Price, savings and «По отдельности» at the top of the price card; the label names a chosen variant. */
export function ProgramPriceSummary() {
  const { current, named } = useVariant();
  const saving = current.sumKgs - current.priceKgs;
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] text-muted">
            {copy.program.priceTitle}
            {named && ` · ${copy.program.variantName(PROGRAM_VARIANT_LABELS[named])}`}
          </span>
          <span className="text-4xl leading-none font-semibold tracking-[-0.035em] whitespace-nowrap">
            <Price kgs={current.priceKgs} />
          </span>
        </div>
        {saving > 0 && (
          <span className="mb-1 flex-none rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-accent-ink">
            −<Price kgs={saving} />
          </span>
        )}
      </div>
      {saving > 0 && (
        <p className="mt-3 text-[15px] text-muted">
          {copy.program.separately}
          <s>
            <Price kgs={current.sumKgs} />
          </s>
        </p>
      )}
    </>
  );
}

function useOrderProgram(program: ProgramForOrder) {
  const { openOrder, quizPickedSlug } = useOverlays();
  const { current, named } = useVariant();
  const item: OrderItem = {
    type: 'program',
    slug: program.slug,
    title: program.title,
    meta: `${productsCount(current.itemCount)} · ${program.course.replace('Утро и вечер, курс', 'курс')}`,
    priceKgs: current.priceKgs,
    image: program.image,
    variant: named,
  };
  return () => openOrder(item, { fromQuiz: quizPickedSlug === program.slug });
}

/** "Все программы", or "К результатам теста" when the visitor came from the quiz (design: setFromQuiz). */
export function ProgramBackLink({ slug }: { slug: string }) {
  const { quizPickedSlug, quizDone, returnToQuiz } = useOverlays();
  if (quizDone && quizPickedSlug === slug) {
    return (
      <button
        type="button"
        onClick={returnToQuiz}
        className="inline-flex h-11 items-center gap-1.5 text-[15px] font-semibold text-accent-ink"
      >
        <ArrowLeftIcon size={16} />
        {copy.program.backToQuiz}
      </button>
    );
  }
  return <BackLink href="/programs">{copy.common.allPrograms}</BackLink>;
}

/** 16:9 video frame on the program page (design: openSetVideo). */
export function ProgramVideo({ program, video }: { program: ProgramForOrder; video: VideoRef }) {
  const { openVideo } = useOverlays();
  const { format } = useCurrency();
  const { current } = useVariant();
  const order = useOrderProgram(program);
  const minutes = video.durationSec ? formatMinutes(video.durationSec) : null;
  return (
    <button
      type="button"
      aria-label={copy.common.play}
      onClick={() =>
        openVideo({
          title: program.headline ? `${copy.program.careFor}${program.headline}` : program.title,
          video,
          end: {
            title: copy.order.programLabel(program.title),
            text: `${productsCount(current.itemCount)} · ${format(current.priceKgs)}`,
            ctaLabel: copy.video.orderProgram,
            onCta: order,
          },
        })
      }
      className="relative mt-[22px] aspect-video self-stretch overflow-hidden rounded-[20px] bg-[var(--poster)] shadow-[0_30px_50px_-28px_rgba(20,20,43,.45)]"
    >
      {video.poster && (
        // eslint-disable-next-line @next/next/no-img-element -- Bunny poster, already sized by the CDN
        <img
          src={video.poster}
          alt=""
          className="absolute inset-0 size-full object-cover"
          fetchPriority="high"
        />
      )}
      {minutes && (
        <span className="absolute top-3 left-3 rounded-full bg-[rgba(14,14,44,.6)] px-2.5 py-1.5 text-[13px] font-semibold text-white">
          {copy.video.minutes(minutes)}
        </span>
      )}
      <span className="absolute top-1/2 left-1/2 flex size-16 -translate-1/2 items-center justify-center rounded-full bg-white text-accent shadow-[0_12px_30px_rgba(14,14,44,.28)]">
        <PlayIcon size={22} className="ml-[3px]" />
      </span>
    </button>
  );
}

export function OrderProgramButton({ program, className }: { program: ProgramForOrder; className?: string }) {
  const order = useOrderProgram(program);
  return (
    <button
      type="button"
      onClick={order}
      className={cn(primaryButton, 'h-14 min-w-0 flex-1 gap-2 px-3 text-base', className)}
    >
      <span className="truncate">{copy.program.order}</span>
      <ArrowRightIcon size={18} className="flex-none" />
    </button>
  );
}

/** Bottom bar: item count, price and "Заказать программу" (design: isSet bar). */
export function ProgramOrderBar({ program }: { program: ProgramForOrder }) {
  const { busy } = useOverlays();
  const { current } = useVariant();
  return (
    <StickyBar mobileOnly visible={!busy} className="items-center gap-3.5 pt-3 pr-4 pl-5">
      <div className="flex flex-none flex-col gap-px">
        <span className="text-[13px] whitespace-nowrap text-muted">{productsCount(current.itemCount)}</span>
        <span className="text-xl font-semibold tracking-[-0.02em] whitespace-nowrap">
          <Price kgs={current.priceKgs} />
        </span>
      </div>
      <OrderProgramButton program={program} />
    </StickyBar>
  );
}

/**
 * «Схема ухода» at the end of the program page (README §4): the PDF the owner uploaded, or one generated from the
 * chosen variant's products and steps. When the generated file fails, the card offers to ask Нурайым in WhatsApp.
 */
export function SchemeCard({
  file,
  programSlug,
  programTitle,
}: {
  file: FileRef | null;
  programSlug: string;
  programTitle: string;
}) {
  const { whatsapp } = useOverlays();
  const { current, named } = useVariant();
  const [state, setState] = useState<'idle' | 'clicked' | 'failed'>('idle');
  const generated = `/programs/${programSlug}/scheme${named ? `?variant=${current.variant}` : ''}`;
  const fileName = copy.program.scheme.fileName(programTitle, named && PROGRAM_VARIANT_LABELS[named]);
  const ask = (
    <a
      href={waLink(whatsapp, buildSchemeRequestMessage(withVariant(programTitle, named)))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('whatsapp_click', { place: 'scheme' })}
      className="flex min-h-8 items-center text-sm font-semibold text-muted"
    >
      {copy.program.schemeAsk}
    </a>
  );

  // The generated PDF is fetched first, so a failure can show the WhatsApp fallback instead of a broken download.
  const downloadGenerated = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    track('scheme_download', { program: programTitle, kind: 'generated' });
    try {
      const response = await fetch(generated);
      if (!response.ok) throw new Error(`scheme ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-[46px] flex-none items-center justify-center rounded-[10px] bg-accent-soft text-xs font-bold tracking-[.04em] text-accent-ink">
          PDF
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-[17px] leading-[1.3] font-semibold">{copy.program.schemeTitle}</span>
          <span className="text-sm leading-[1.4] text-muted">
            {file ? copy.program.schemeMeta(formatBytes(file.bytes)) : copy.program.schemeMetaGenerated}
          </span>
        </div>
      </div>
      <a
        href={file?.url ?? generated}
        download={file?.name ?? fileName}
        onClick={(event) => {
          if (!file) return void downloadGenerated(event);
          setState('clicked');
          track('scheme_download', { program: programTitle, kind: 'uploaded' });
        }}
        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-button border-[1.5px] border-ink bg-surface px-[18px] py-2.5 text-center text-base leading-[1.25] font-semibold text-ink hover:bg-surface-2"
      >
        <DownloadIcon size={18} className="flex-none" />
        {copy.program.schemeDownload}
      </a>
      {state === 'clicked' && file && (
        <div className="-mt-1.5 flex flex-col items-center gap-1">
          <a
            href={file.url}
            target="_blank"
            rel="noopener"
            className="flex min-h-8 items-center text-sm font-semibold text-accent-ink"
          >
            {copy.program.schemeOpen}
          </a>
          {ask}
        </div>
      )}
      {state === 'failed' && (
        <div role="alert" className="-mt-1 flex flex-col gap-2">
          <span className="text-sm leading-[1.45] text-muted">{copy.program.schemeError}</span>
          {ask}
        </div>
      )}
    </div>
  );
}
