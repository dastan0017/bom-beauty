import type { ProgramCard as ProgramCardData } from '@bom/shared';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { productsCount } from '@/lib/words';
import { BbImage } from '../bb-image';
import { Price } from '../currency';
import { ChevronRightIcon, PlayTriangleIcon, SparkleIcon } from '../icons';
import { card } from '../ui';
import { VideoThumb } from '../video-thumb';

/** Program card from the programs list (design: isPrograms → programs). */
export function ProgramCard({ program }: { program: ProgramCardData }) {
  return (
    <Link
      href={`/programs/${program.slug}`}
      className={cn(
        card,
        'flex flex-col gap-3 px-4 py-3.5 transition-transform hover:border-line-hover active:scale-[.985]',
      )}
    >
      <span className="flex items-start gap-3.5">
        <VideoThumb program={program} className="h-[74px] w-[92px]" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {program.badge && (
            <span className="mb-1 inline-flex h-[26px] items-center gap-[5px] self-start rounded-full bg-accent-soft px-2.5 text-[13px] font-semibold text-accent-ink">
              <SparkleIcon size={12} />
              {program.badge}
            </span>
          )}
          <span className="text-[19px] leading-[1.25] font-semibold tracking-[-0.015em]">
            {program.title}
          </span>
          <span className="text-base leading-[1.45] text-muted">{program.symptom}</span>
        </span>
      </span>
      <span className="flex items-center gap-[5px]">
        {program.thumbs.map((thumb) => (
          <span
            key={thumb.slug}
            className="relative size-8 flex-none overflow-hidden rounded-[9px] bg-surface-2"
          >
            <BbImage image={thumb.image} sizes="32px" width={64} alt="" />
          </span>
        ))}
        <span className="ml-1.5 text-sm whitespace-nowrap text-muted">
          {productsCount(program.itemCount)}
        </span>
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-line-2 pt-3">
        {program.video ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <PlayTriangleIcon size={11} className="text-pink" />
            {copy.programs.videoMeta}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted">
            <span className={cn('size-[7px] rounded-full', program.inStock ? 'bg-stock' : 'bg-preorder')} />
            {program.inStock ? copy.common.inStock : copy.common.preorder}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[17px] font-semibold whitespace-nowrap">
          <Price kgs={program.priceKgs} />
          <ChevronRightIcon size={16} className="text-muted" />
        </span>
      </span>
    </Link>
  );
}
