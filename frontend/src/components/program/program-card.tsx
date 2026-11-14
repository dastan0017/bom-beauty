import type { ProgramCard as ProgramCardData } from '@bom/shared';
import { PROGRAM_VARIANT_LABELS, variantOffers } from '@bom/shared/web';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { programSummary } from '@/lib/program-summary';
import { productsCount } from '@/lib/words';
import { BbImage } from '../bb-image';
import { Price } from '../currency';
import { ChevronRightIcon, PlayTriangleIcon, SparkleIcon } from '../icons';
import { card } from '../ui';
import { VideoThumb } from '../video-thumb';
import { OldPrice, programHref } from './variant-offers';

/**
 * Program card from the programs list (design: isPrograms → programs). A program with variants lists each one with
 * its own price, count and crossed-out separate price, «Оптимальный уход» raised as the main one; each row opens the
 * page on that variant (owner request 2026-11-14, D48). The title is the card's link; the rows are links of their own
 * above it.
 */
export function ProgramCard({ program }: { program: ProgramCardData }) {
  const offers = variantOffers(program);
  const choice = offers.length > 1;
  const single = offers[0];
  const summary = programSummary(program);
  return (
    <article
      className={cn(
        card,
        'relative flex flex-col gap-3 px-4 py-3.5 transition-transform hover:border-line-hover has-[.stretched-link:active]:scale-[.985]',
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
          <Link
            href={programHref(program.slug)}
            className="stretched-link text-[19px] leading-[1.25] font-semibold tracking-[-0.015em]"
          >
            {program.title}
          </Link>
          <span className="text-base leading-[1.45] text-muted">{program.symptom}</span>
        </span>
      </span>

      {choice ? (
        <ul
          aria-label={copy.programs.variantsLabel}
          className="relative z-[1] flex flex-col gap-0.5 rounded-2xl bg-surface-2 p-1"
        >
          {offers.map((offer) => {
            const main = offer.variant === 'standard';
            return (
              <li key={offer.variant}>
                <Link
                  href={programHref(program.slug, offer.variant)}
                  className={cn(
                    'flex min-h-[52px] items-center gap-2.5 rounded-xl py-2 pr-2 pl-3 transition-colors hover:bg-surface',
                    main && 'bg-surface shadow-[0_2px_8px_rgba(20,20,43,.10)]',
                  )}
                >
                  {/* Two lines: the name with the price, the count with the crossed-out separate price. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={cn('text-[15px] leading-[1.25]', main ? 'font-bold' : 'font-semibold')}
                      >
                        {PROGRAM_VARIANT_LABELS[offer.variant]}
                      </span>
                      <span className="text-base leading-[1.2] font-semibold whitespace-nowrap">
                        <Price kgs={offer.priceKgs} />
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[13px] leading-[1.25] text-muted">
                        {productsCount(offer.itemCount)}
                      </span>
                      <OldPrice kgs={offer.separatelyKgs} />
                    </span>
                  </span>
                  <ChevronRightIcon size={16} className="flex-none text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <span className="flex items-center gap-[5px]">
          {program.thumbs.map((thumb) => (
            <span
              key={thumb.slug}
              className="relative size-8 flex-none overflow-hidden rounded-[9px] bg-surface-2"
            >
              <BbImage image={thumb.image} sizes="32px" width={64} alt="" />
            </span>
          ))}
          <span className="ml-1.5 text-sm whitespace-nowrap text-muted">{summary.count}</span>
        </span>
      )}

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
        {!choice && single && (
          <span className="flex items-center gap-1.5">
            <span className="flex flex-col items-end gap-1">
              <span className="text-[17px] leading-[1.2] font-semibold whitespace-nowrap">
                <Price kgs={single.priceKgs} />
              </span>
              <OldPrice kgs={single.separatelyKgs} className="self-end text-[13px]" />
            </span>
            <ChevronRightIcon size={16} className="flex-none text-muted" />
          </span>
        )}
      </span>
    </article>
  );
}
