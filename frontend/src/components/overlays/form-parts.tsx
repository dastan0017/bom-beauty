'use client';

import { LINE_QTY_MAX } from '@bom/shared/web';
import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { MinusIcon, PlusIcon, WhatsAppIcon } from '../icons';

// Small form pieces shared by the order sheet, the product page and the wholesale sheet. Kept apart from the order
// sheet so those pages do not load its validation code (zod schemas, phone parsing) up front.

const MAX_QTY = LINE_QTY_MAX;

export function QtyStepper({
  value,
  onChange,
  bordered = false,
}: {
  value: number;
  onChange: (value: number) => void;
  bordered?: boolean;
}) {
  const button = cn(
    'flex size-11 items-center justify-center rounded-full text-ink disabled:opacity-40',
    bordered ? 'border border-line bg-white' : 'bg-transparent',
  );
  return (
    <div className={cn('flex items-center', bordered && 'gap-1.5')}>
      <button
        type="button"
        aria-label={copy.product.less}
        className={button}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <MinusIcon size={16} />
      </button>
      <span
        aria-live="polite"
        className={cn('text-center text-[17px] font-semibold', bordered ? 'min-w-7' : 'min-w-[22px]')}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={copy.product.more}
        className={button}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(Math.min(MAX_QTY, value + 1))}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}

/** Spam trap: hidden from people and screen readers, filled in by naive bots. */
export function Honeypot({ registration }: { registration: UseFormRegisterReturn }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label>
        Website
        <input type="text" tabIndex={-1} autoComplete="off" {...registration} />
      </label>
    </div>
  );
}

/** The sheets' main button; the WhatsApp icon unless `icon` says otherwise (null: none, for online payment). */
export function SubmitButton({
  sending,
  label,
  icon = <WhatsAppIcon size={20} />,
}: {
  sending: boolean;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="submit"
      aria-busy={sending || undefined}
      className={cn(
        'mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-button bg-accent px-5 text-[17px] font-semibold text-white',
        'shadow-[0_0_0_6px_var(--halo),0_14px_26px_-14px_var(--acsh)] hover:brightness-[.94] active:brightness-[.88]',
        sending && 'opacity-70',
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
