'use client';

import { useRef, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { CloseIcon } from '../icons';
import { useModal, usePresence } from './use-dialog';

/** Bottom sheet from the design (order and price-request forms). Centred modal from 640 px up. */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const { mounted, visible } = usePresence(open);
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, open, onClose);
  if (!mounted) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 sm:flex sm:items-center sm:justify-center sm:p-6',
        !open && 'pointer-events-none',
      )}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-[rgba(14,14,44,.5)] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white text-ink shadow-[0_-24px_60px_rgba(14,14,44,.2)] transition-transform duration-[360ms] ease-[cubic-bezier(.2,.8,.2,1)] outline-none',
          'sm:relative sm:inset-auto sm:w-full sm:max-w-[480px] sm:rounded-3xl',
          visible ? 'translate-y-0' : 'translate-y-full sm:translate-y-[calc(100%+3rem)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetHandle() {
  return (
    <span aria-hidden="true" className="block h-[5px] w-10 self-center rounded-full bg-handle sm:hidden" />
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <h2 className="text-[21px] font-semibold tracking-[-0.02em]">{title}</h2>
      <CloseButton onClick={onClose} />
    </div>
  );
}

export function CloseButton({ onClick, label = copy.common.close }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 flex-none items-center justify-center rounded-full bg-surface-2 text-ink"
    >
      <CloseIcon size={18} />
    </button>
  );
}

/** Shared bottom padding that clears the iOS home indicator. */
export const sheetBodyClass = 'flex flex-col px-5 pt-2.5 pb-[calc(24px+env(safe-area-inset-bottom))]';
