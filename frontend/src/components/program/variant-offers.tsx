import type { ProgramVariant } from '@bom/shared';
import type { Route } from 'next';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';

/** The program page opened on one variant (`?variant=mini`); «standard» is the page as it is. */
export const programHref = (slug: string, variant?: ProgramVariant): Route =>
  (variant && variant !== 'standard' ? `/programs/${slug}?variant=${variant}` : `/programs/${slug}`) as Route;

/** «−11%»: what the set saves against its products one by one (D48). Nothing when it saves nothing. */
export function SavingChip({ percent, className }: { percent: number; className?: string }) {
  if (percent < 1) return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 flex-none items-center rounded-full bg-accent-soft px-1.5 text-xs font-semibold whitespace-nowrap text-accent-ink',
        className,
      )}
    >
      <span aria-hidden="true">{copy.programs.saving(percent)}</span>
      <span className="sr-only">{copy.programs.savingSpoken(percent)}</span>
    </span>
  );
}
