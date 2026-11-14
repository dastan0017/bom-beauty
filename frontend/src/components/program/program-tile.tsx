import type { ProgramCard } from '@bom/shared';
import { PROGRAM_VARIANT_LABELS, variantOffers } from '@bom/shared/web';
import Link from 'next/link';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/words';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { Price } from '../currency';
import { ArrowRightIcon, PlayTriangleIcon, SparkleIcon } from '../icons';
import { card } from '../ui';
import { OldPrice, programHref } from './variant-offers';

/**
 * Program card of the home grid «Готовые программы ухода» (README §1.2): 5:4 cover, badge, video length, price. A
 * program with variants lists each one with its own price and crossed-out separate price, «Оптимальный уход» raised;
 * a row opens the page on it (owner request 2026-11-14, D48). Two to a row on phones (the owner's choice over the
 * programs list's card, which needs the full phone width). The title is the card's link; the rows are links of their own above it.
 */
export function ProgramTile({ program, priority = false }: { program: ProgramCard; priority?: boolean }) {
  const offers = variantOffers(program);
  const choice = offers.length > 1;
  const single = offers[0];
  const duration = formatDuration(program.video?.durationSec);
  return (
    <article
      className={cn(
        card,
        'relative flex min-w-0 flex-col overflow-hidden transition-transform hover:border-line-hover has-[.stretched-link:active]:scale-[.98]',
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
        <Link
          href={programHref(program.slug)}
          className="stretched-link text-base leading-[1.25] font-semibold tracking-[-0.01em]"
        >
          {program.title}
        </Link>
        <span className="text-[13px] leading-[1.4] text-muted">{program.symptom}</span>
        {choice ? (
          <ul
            aria-label={copy.programs.variantsLabel}
            className="relative z-[1] mt-auto flex flex-col gap-0.5 rounded-xl bg-surface-2 p-1"
          >
            {offers.map((offer) => {
              const main = offer.variant === 'standard';
              return (
                <li key={offer.variant}>
                  <Link
                    href={programHref(program.slug, offer.variant)}
                    className={cn(
                      'flex min-h-11 flex-col justify-center gap-0.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-surface',
                      main && 'bg-surface shadow-[0_2px_8px_rgba(20,20,43,.10)]',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[13px] leading-[1.25]',
                        main ? 'font-semibold text-ink' : 'text-muted',
                      )}
                    >
                      {PROGRAM_VARIANT_LABELS[offer.variant]}
                    </span>
                    {/* The old price goes under the price at every width: side by side does not fit a phone tile. */}
                    <span className="text-[15px] leading-[1.25] font-semibold whitespace-nowrap">
                      <Price kgs={offer.priceKgs} />
                    </span>
                    <OldPrice kgs={offer.separatelyKgs} className="text-xs" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          single && (
            <span className="mt-auto flex flex-col gap-0.5 pt-2">
              <span className="flex items-center justify-between gap-1.5">
                <span className="text-[17px] leading-[1.2] font-semibold whitespace-nowrap">
                  <Price kgs={single.priceKgs} />
                </span>
                <span className="flex size-7 flex-none items-center justify-center rounded-full bg-surface-2">
                  <ArrowRightIcon size={14} />
                </span>
              </span>
              <OldPrice kgs={single.separatelyKgs} />
            </span>
          )
        )}
      </span>
    </article>
  );
}
