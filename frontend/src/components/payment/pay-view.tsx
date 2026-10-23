'use client';

import type { PayPage } from '@bom/shared';
import {
  buildOrderQuestionMessage,
  buildPaidMessage,
  buildPaymentHelpMessage,
  formatKgs,
  orderItemLabel,
  waLink,
} from '@bom/shared/web';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { fetchPayPage, startPayment } from '@/lib/pay-client';
import { clearPendingPayment, readPendingPayment } from '@/lib/pending-payment';
import { track } from '@/lib/submission';
import { useCart } from '../cart/cart';
import { TrackedLink } from '../header-client';
import { BagIcon, CheckIcon, CloseIcon, WhatsAppIcon } from '../icons';
import { card, outlineButton, primaryButton } from '../ui';

/** Back from Finik: the spinner shows this long before the page offers to pay again (polling goes on). */
const CHECK_MS = 30_000;
/** Polling: every 2 s for 2 minutes, then every 10 s, up to 15 minutes. */
const FAST_MS = 2 * 60_000;
const STOP_MS = 15 * 60_000;

const isOpen = (page: PayPage | null) => page?.status === 'unpaid' || page?.status === 'pending';
const signed = (kgs: number) => `${kgs > 0 ? '+' : '−'}${formatKgs(Math.abs(kgs))}`;

/**
 * The order's payment page (`/pay/<token>`): what is ordered, the amount due and «Оплатить». After Finik it waits for
 * the bank's confirmation (the webhook), which may take a few seconds.
 */
export function PayView({
  token,
  initial,
  fromFinik,
  whatsapp,
  visa,
}: {
  token: string;
  /** null: the API did not answer on the server. */
  initial: PayPage | null;
  fromFinik: boolean;
  whatsapp: string;
  visa: boolean;
}) {
  const { clear } = useCart();
  const [page, setPage] = useState(initial);
  const [checking, setChecking] = useState(fromFinik && isOpen(initial));
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const arrivedAt = useRef(0);

  const refresh = useCallback(async () => {
    const result = await fetchPayPage(token);
    if (result.ok && result.value) setPage(result.value);
    return result;
  }, [token]);

  // Back from Finik and not confirmed yet: poll until the webhook lands.
  const open = isOpen(page);
  useEffect(() => {
    if (!fromFinik || !open) return;
    arrivedAt.current ||= Date.now();
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      const elapsed = Date.now() - arrivedAt.current;
      if (elapsed > CHECK_MS) setChecking(false);
      if (elapsed > STOP_MS) return;
      await refresh();
      if (!stopped) timer = window.setTimeout(() => void tick(), elapsed < FAST_MS ? 2_000 : 10_000);
    };
    timer = window.setTimeout(() => void tick(), 1_500);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [fromFinik, open, refresh]);

  // Paid: an online cart order empties the cart now (docs/finik/SPEC.md §6.3).
  const paid = page?.status === 'paid';
  useEffect(() => {
    if (!paid) return;
    const record = readPendingPayment();
    if (record?.token === token) {
      if (record.fromCart) clear();
      clearPendingPayment(token);
    }
    if (fromFinik) track('payment_paid', { place: 'pay_page' });
  }, [paid, token, clear, fromFinik]);

  // Back from Finik with the browser's back button: the page comes back frozen on «Переходим к оплате…».
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setStarting(false);
      void refresh();
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [refresh]);

  const pay = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(false);
    track('payment_start', { place: 'pay_page' });
    const result = await startPayment(token);
    if (result.ok) {
      window.location.assign(result.value);
      return;
    }
    setStarting(false);
    const failure = result.failure;
    track('payment_error', {
      reason: failure.kind === 'api' ? (failure.code ?? String(failure.status)) : 'network',
    });
    // Paid, cancelled or switched off in the meantime: show what is true now.
    if (failure.kind === 'api' && (failure.code === 'conflict' || failure.code === 'payment_unavailable')) {
      await refresh();
      return;
    }
    setStartError(true);
  };

  if (!page) {
    return (
      <State icon={<BagIcon size={26} strokeWidth={1.9} />} title={copy.pay.title} text={copy.pay.loadError}>
        <a href={`/pay/${token}`} className={cn(primaryButton, 'h-14 text-base')}>
          {copy.pay.refresh}
        </a>
      </State>
    );
  }

  const amount = formatKgs(page.amountKgs);
  const write = (message: string) => (
    <TrackedLink
      href={waLink(whatsapp, message)}
      event="whatsapp_click"
      place="pay"
      className={cn(outlineButton, 'h-14 text-base')}
    >
      <WhatsAppIcon size={18} className="text-whatsapp" />
      {copy.pay.writeNurai}
    </TrackedLink>
  );

  if (page.status === 'paid') {
    return (
      <State
        tone="success"
        icon={<CheckIcon size={30} strokeWidth={2.6} />}
        eyebrow={copy.pay.order(page.number)}
        title={copy.pay.paidTitle}
        text={copy.pay.paidText(page.number, amount)}
      >
        <Summary page={page} />
        <Link href="/" className={cn(primaryButton, 'mt-2 h-14 text-base')}>
          {copy.pay.toShop}
        </Link>
        {write(buildPaidMessage({ number: page.number, total: amount }))}
      </State>
    );
  }

  if (page.status === 'cancelled' || page.status === 'refunded') {
    const cancelled = page.status === 'cancelled';
    return (
      <State
        icon={<CloseIcon size={26} />}
        eyebrow={copy.pay.order(page.number)}
        title={cancelled ? copy.pay.cancelledTitle : copy.pay.refundedTitle}
        text={cancelled ? copy.pay.cancelledText(page.number) : copy.pay.refundedText(page.number)}
      >
        {write(buildOrderQuestionMessage({ number: page.number }))}
      </State>
    );
  }

  if (checking) {
    return (
      <State
        icon={
          <span className="size-7 animate-spin rounded-full border-[3px] border-accent border-t-transparent motion-reduce:animate-none" />
        }
        eyebrow={copy.pay.order(page.number)}
        title={copy.pay.checkingTitle}
        text={copy.pay.checkingText}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <p className="text-sm font-semibold text-muted">{copy.pay.order(page.number)}</p>
      <h1 className="mt-1 heading text-[calc(30px*var(--fhk))] leading-[1.1]">{copy.pay.title}</h1>
      <Summary page={page} />
      {page.canPay ? (
        <>
          <button
            type="button"
            onClick={() => void pay()}
            aria-busy={starting || undefined}
            className={cn(primaryButton, 'mt-6 h-14 w-full px-5 text-[17px]', starting && 'opacity-70')}
          >
            {starting ? copy.pay.submitting : copy.pay.submit(amount)}
          </button>
          <p className="mt-3 text-center text-sm leading-normal text-muted">
            {visa ? copy.pay.methodsVisa : copy.pay.methods}
          </p>
          {startError && (
            <p role="alert" className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-normal">
              {copy.pay.startError}
            </p>
          )}
          {fromFinik && (
            <p className="mt-3 text-center text-sm leading-normal text-balance text-muted">
              {copy.pay.notYet}
            </p>
          )}
        </>
      ) : (
        <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-normal">
          {copy.pay.unavailable}
        </p>
      )}
      <div className="mt-4 flex flex-col">
        {write(
          fromFinik
            ? buildPaymentHelpMessage({ number: page.number })
            : buildOrderQuestionMessage({ number: page.number }),
        )}
      </div>
    </div>
  );
}

/** A centered state: round icon badge, heading, text, then the actions (the sent-screen language). */
function State({
  icon,
  tone = 'neutral',
  eyebrow,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  tone?: 'neutral' | 'success';
  eyebrow?: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={cn(
          'flex size-[68px] items-center justify-center rounded-full',
          tone === 'success' ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-muted',
        )}
      >
        {icon}
      </span>
      {eyebrow && <p className="mt-5 text-sm font-semibold text-muted">{eyebrow}</p>}
      <h1
        className={cn(
          'self-stretch heading text-[calc(28px*var(--fhk))] leading-[1.15]',
          eyebrow ? 'mt-1' : 'mt-5',
        )}
      >
        {title}
      </h1>
      <p role="status" className="mt-2 self-stretch text-base leading-normal text-balance text-muted">
        {text}
      </p>
      {children && <div className="mt-4 flex flex-col gap-3 self-stretch text-left">{children}</div>}
    </div>
  );
}

/** Lines, the owner's adjustment and the amount due. Always in сом: that is what Finik charges. */
function Summary({ page }: { page: PayPage }) {
  return (
    <div className={cn(card, 'mt-5 flex flex-col px-4')}>
      <ul aria-label={copy.order.lines} className="flex flex-col">
        {page.lines.map((line, index) => (
          <li
            key={index}
            className="flex items-baseline justify-between gap-3 border-b border-line-2 py-3 text-[15px] leading-[1.35]"
          >
            <span className="min-w-0">
              {orderItemLabel(line)}
              {line.qty > 1 && <span className="text-muted"> × {line.qty}</span>}
            </span>
            <span className="flex-none font-semibold whitespace-nowrap">{formatKgs(line.totalKgs)}</span>
          </li>
        ))}
      </ul>
      {page.adjustmentKgs !== 0 && (
        <div className="flex flex-col gap-1 border-b border-line-2 py-3 text-[15px] text-muted">
          <Row label={copy.pay.total} value={formatKgs(page.totalKgs)} />
          <Row
            label={page.adjustmentNote?.trim() || copy.pay.adjustment}
            value={signed(page.adjustmentKgs)}
          />
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 py-3.5">
        <span className="text-base font-semibold">
          {page.status === 'paid' ? copy.pay.paid : copy.pay.due}
        </span>
        <span className="text-[22px] font-semibold tracking-[-0.02em] whitespace-nowrap">
          {formatKgs(page.amountKgs)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">{label}</span>
      <span className="flex-none whitespace-nowrap">{value}</span>
    </div>
  );
}
