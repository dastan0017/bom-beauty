'use client';

import {
  buildProtocolRequestMessage,
  waLink,
  type FileRef,
  type ProgramDetail,
  type VideoRef,
} from '@bom/shared';
import { useState } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { track } from '@/lib/submission';
import { formatBytes, formatMinutes, productsCount } from '@/lib/words';
import { Price, useCurrency } from '../currency';
import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon, PlayIcon } from '../icons';
import { useOverlays, type OrderItem } from '../overlays/site-overlays';
import { StickyBar } from '../sticky-bar';
import { BackLink, primaryButton } from '../ui';

type ProgramForOrder = Pick<
  ProgramDetail,
  'slug' | 'title' | 'headline' | 'priceKgs' | 'itemCount' | 'course'
> & {
  image: OrderItem['image'];
};

function orderItem(program: ProgramForOrder): OrderItem {
  return {
    type: 'program',
    slug: program.slug,
    title: program.title,
    meta: `${productsCount(program.itemCount)} · ${program.course.replace('Утро и вечер, курс', 'курс')}`,
    priceKgs: program.priceKgs,
    image: program.image,
  };
}

function useOrderProgram(program: ProgramForOrder) {
  const { openOrder, quizPickedSlug } = useOverlays();
  return () => openOrder(orderItem(program), { fromQuiz: quizPickedSlug === program.slug });
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
            text: `${productsCount(program.itemCount)} · ${format(program.priceKgs)}`,
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
  return (
    <StickyBar mobileOnly visible={!busy} className="items-center gap-3.5 pt-3 pr-4 pl-5">
      <div className="flex flex-none flex-col gap-px">
        <span className="text-[13px] whitespace-nowrap text-muted">{productsCount(program.itemCount)}</span>
        <span className="text-xl font-semibold tracking-[-0.02em] whitespace-nowrap">
          <Price kgs={program.priceKgs} />
        </span>
      </div>
      <OrderProgramButton program={program} />
    </StickyBar>
  );
}

/** Protocol PDF with a fallback link and a WhatsApp request when the file fails (design: proto). */
export function ProtocolCard({ file, programTitle }: { file: FileRef; programTitle: string }) {
  const { whatsapp } = useOverlays();
  const [clicked, setClicked] = useState(false);
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-[46px] flex-none items-center justify-center rounded-[10px] bg-accent-soft text-xs font-bold tracking-[.04em] text-accent-ink">
          PDF
        </span>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-[17px] leading-[1.3] font-semibold">{copy.program.protocolTitle}</span>
          <span className="text-sm leading-[1.4] text-muted">
            {copy.program.protocolMeta(formatBytes(file.bytes))}
          </span>
        </div>
      </div>
      <a
        href={file.url}
        download={file.name}
        onClick={() => {
          setClicked(true);
          track('protocol_download', { program: programTitle });
        }}
        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-button border-[1.5px] border-ink bg-surface px-[18px] py-2.5 text-center text-base leading-[1.25] font-semibold text-ink hover:bg-surface-2"
      >
        <DownloadIcon size={18} className="flex-none" />
        {copy.program.protocolDownload}
      </a>
      {clicked && (
        <div className="-mt-1.5 flex flex-col items-center gap-1">
          <a
            href={file.url}
            target="_blank"
            rel="noopener"
            className="flex min-h-8 items-center text-sm font-semibold text-accent-ink"
          >
            {copy.program.protocolOpen}
          </a>
          <a
            href={waLink(whatsapp, buildProtocolRequestMessage(programTitle))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('whatsapp_click', { place: 'protocol' })}
            className="flex min-h-8 items-center text-sm font-semibold text-muted"
          >
            {copy.program.protocolAsk}
          </a>
        </div>
      )}
    </div>
  );
}
