import type { ProgramVariant } from '@bom/shared';
import type { Route } from 'next';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { Price } from '../currency';

/** The program page opened on one variant (`?variant=mini`); «standard» is the page as it is. */
export const programHref = (slug: string, variant?: ProgramVariant): Route =>
  (variant && variant !== 'standard' ? `/programs/${slug}?variant=${variant}` : `/programs/${slug}`) as Route;

/**
 * The products of the set bought one by one, crossed out next to its price, as on the program page («По отдельности»)
 * (owner request 2026-11-14), grey like it. Through <Price>, so the currency switch applies. Nothing when the set costs
 * no less.
 */
export function OldPrice({ kgs, className = 'text-[13px]' }: { kgs: number; className?: string }) {
  if (kgs < 1) return null;
  return (
    <span className={cn('leading-[1.25] whitespace-nowrap text-muted', className)}>
      <span className="sr-only">{copy.programs.separately}</span>
      <s>
        <Price kgs={kgs} />
      </s>
    </span>
  );
}
