import { splitAccent } from '@bom/shared';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { ArrowLeftIcon, ArrowRightIcon } from './icons';

// Small building blocks shared by the site pages. Sizes and spacing follow design/Bom Beauty Prototype.dc.html.

export const card = 'rounded-card border border-line bg-surface';
/** Page container: phone layout below 1024 px, 1100 px column above (desktop references). */
export const container = 'mx-auto w-full max-w-[1100px] lg:px-6';

/** Title with the `*accent*` word in italic accent colour. */
export function AccentTitle({
  text,
  accentClassName = 'text-highlight-2',
}: {
  text: string;
  accentClassName?: string;
}) {
  return (
    <>
      {splitAccent(text).map((part, index) =>
        part.accent ? (
          <span key={index} className={cn('accent-word', accentClassName)}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

type Href = ComponentProps<typeof Link>['href'];

export function BackLink({
  href,
  children,
  className,
}: {
  href: Href;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-ink',
        className,
      )}
    >
      <ArrowLeftIcon size={16} />
      {children}
    </Link>
  );
}

/** Top of the inner pages: soft glow, back link, H1 and lead (design: isPrograms / isCatalog / isSet). */
export function PageIntro({
  back,
  children,
  className,
}: {
  back?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="bg-[radial-gradient(120%_300px_at_50%_0%,var(--glow)_0%,rgba(255,255,255,0)_100%)]">
      <div className={cn(container, 'flex flex-col items-start px-5 pt-2.5 lg:pt-6', className)}>
        {back ?? <BackLink href="/">{copy.common.toHome}</BackLink>}
        {children}
      </div>
    </section>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        'mt-2.5 self-stretch heading text-[calc(33px*var(--fhk))] leading-[1.1] lg:text-[calc(44px*var(--fhk))]',
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function SectionTitle({
  title,
  lead,
  center = false,
  className,
  as: Tag = 'h2',
}: {
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex flex-col gap-2 px-1', center && 'text-center', className)}>
      <Tag className="heading text-[calc(26px*var(--fhk))] leading-[1.15] lg:text-[calc(32px*var(--fhk))]">
        {title}
      </Tag>
      {lead && <p className="text-base leading-normal text-muted">{lead}</p>}
    </div>
  );
}

export function StockBadge({ inStock, className }: { inStock: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-semibold',
        inStock ? 'bg-accent-soft text-accent-ink' : 'bg-surface-2 text-ink',
        className,
      )}
    >
      <span className={cn('size-[7px] rounded-full', inStock ? 'bg-stock' : 'bg-preorder')} />
      {inStock ? copy.common.inStock : copy.common.preorder}
    </span>
  );
}

/** Round arrow at the end of a tappable card. */
export function ArrowBubble({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 flex-none items-center justify-center self-center rounded-full bg-surface-2',
        className,
      )}
    >
      <ArrowRightIcon size={16} />
    </span>
  );
}

/** Primary filled button look (accent, halo shadow). */
export const primaryButton =
  'flex items-center justify-center gap-3 rounded-button bg-accent font-semibold text-white shadow-[0_0_0_6px_var(--halo),0_14px_26px_-14px_var(--acsh)] hover:brightness-[.94] active:brightness-[.88]';

/** Outline button look (white, hairline border). */
export const outlineButton =
  'flex items-center justify-center gap-2.5 rounded-button border border-line bg-surface font-semibold text-ink hover:border-line-hover';
