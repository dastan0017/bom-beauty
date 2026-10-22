import type { ProgramCard } from '@bom/shared';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/words';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price } from '../currency';
import { ArrowRightIcon, PlayTriangleIcon, SparkleIcon } from '../icons';
import { card } from '../ui';

/** Program card of the home grid «Готовые программы ухода» (README §1.2): 5:4 cover, badge, video length, price. */
export function ProgramTile({ program, priority = false }: { program: ProgramCard; priority?: boolean }) {
  const duration = formatDuration(program.video?.durationSec);
  return (
    <Link
      href={`/programs/${program.slug}`}
      className={cn(
        card,
        'flex min-w-0 flex-col overflow-hidden transition-transform hover:border-line-hover active:scale-[.98]',
      )}
    >
      <span className="relative flex aspect-[5/4] items-center justify-center bg-surface-2">
        <BbImage
          image={program.cover}
          sizes="(min-width: 1024px) 260px, (min-width: 768px) 33vw, 50vw"
          width={400}
          alt=""
          priority={priority}
          placeholder={<PhotoPlaceholder label={copy.home.programPhoto} />}
        />
        {program.badge && (
          <span className="absolute top-2 right-2 inline-flex h-6 items-center gap-1 rounded-full bg-surface px-[9px] text-xs font-semibold whitespace-nowrap text-accent-ink shadow-[0_2px_8px_rgba(14,14,44,.12)]">
            <SparkleIcon size={10} />
            {program.badge}
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2 left-2 inline-flex h-6 items-center gap-[5px] rounded-full bg-[rgba(14,14,44,.62)] px-[9px] text-xs font-semibold text-white">
            <PlayTriangleIcon size={9} />
            {duration}
          </span>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-1 px-3 pt-3 pb-3.5">
        <span className="text-base leading-[1.25] font-semibold tracking-[-0.01em]">{program.title}</span>
        <span className="text-[13px] leading-[1.4] text-muted">{program.symptom}</span>
        <span className="mt-auto flex items-center justify-between gap-1.5 pt-2">
          <span className="text-[15px] font-semibold whitespace-nowrap">
            <Price kgs={program.priceKgs} />
          </span>
          <span className="flex size-7 flex-none items-center justify-center rounded-full bg-surface-2">
            <ArrowRightIcon size={14} />
          </span>
        </span>
      </span>
    </Link>
  );
}
