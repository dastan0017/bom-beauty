'use client';

import { copy } from '@/content/copy';
import { CheckIcon } from '../icons';
import { SheetHandle, sheetBodyClass } from './sheet';

/** "Заказ отправлен" / "Запрос отправлен": the message as it went to WhatsApp, with a way to reopen it. */
export function SentScreen({
  title,
  text,
  message,
  time,
  onResend,
  backLabel,
  onBack,
}: {
  title: string;
  text: string;
  message: string;
  time: string;
  onResend: () => void;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className={`${sheetBodyClass} items-center text-center`}>
      <SheetHandle />
      <span className="mt-7 flex size-[68px] items-center justify-center rounded-full bg-success-soft text-success-ink">
        <CheckIcon size={30} strokeWidth={2.6} />
      </span>
      <h2
        data-autofocus
        tabIndex={-1}
        className="mt-5 self-stretch heading text-[calc(26px*var(--fhk))] leading-[1.15] outline-none"
      >
        {title}
      </h2>
      <p className="mt-2 self-stretch text-base leading-normal text-balance text-muted">{text}</p>
      <div className="mt-6 flex flex-col items-end gap-2 self-stretch text-left">
        <span className="self-start text-sm font-semibold">{copy.order.yourMessage}</span>
        <div className="flex max-w-[310px] flex-col gap-1.5 rounded-[16px_16px_6px_16px] bg-bubble px-3.5 pt-3 pb-2">
          <span className="text-[15px] leading-normal whitespace-pre-line text-[#14142B]">{message}</span>
          <span className="self-end text-xs text-bubble-meta">{time} ✓✓</span>
        </div>
      </div>
      <button type="button" onClick={onResend} className="mt-[18px] text-sm text-muted">
        {copy.order.notOpened}
        <span className="font-semibold text-ink underline underline-offset-[3px]">
          {copy.order.openAgain}
        </span>
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 h-[54px] w-full rounded-button border border-line bg-white text-base font-semibold text-ink hover:border-line-hover"
      >
        {backLabel}
      </button>
    </div>
  );
}
