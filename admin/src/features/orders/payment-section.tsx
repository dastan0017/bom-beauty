import {
  formatKgs,
  MANUAL_PAYMENT_STATUSES,
  ORDER_PAYMENT_STATUS_LABELS,
  PAYMENT_CHANNEL_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  relativeDateTime,
  waLink,
  type OrderDetail,
  type OrderPaymentStatus,
  type PaymentAttempt,
  type UpdateOrder,
} from '@bom/shared';
import { AlertDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, ChevronDownIcon, inputClass, PAYMENT_STYLE, WhatsAppIcon } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/utils';

const signed = (kgs: number) => `${kgs > 0 ? '+' : '−'}${formatKgs(Math.abs(kgs))}`;

/** What the team may set by hand; «Ждёт оплаты» comes from Finik links only. */
type ManualStatus = (typeof MANUAL_PAYMENT_STATUSES)[number];

/**
 * The drawer's «Оплата» (docs/finik/SPEC.md §7.1): method and status (the team can mark a WhatsApp order paid),
 * the amount due with the owner's adjustment, the payment link to send, and Finik's attempts.
 */
export function PaymentSection({
  order,
  busy,
  save,
}: {
  order: OrderDetail;
  busy: boolean;
  save: (change: UpdateOrder, success: string) => void;
}) {
  const payment = order.payment;
  const [confirming, setConfirming] = useState<ManualStatus | null>(null);
  const succeeded = payment.attempts.find((attempt) => attempt.status === 'succeeded');
  const open = payment.status === 'unpaid' || payment.status === 'pending';

  const change = (next: OrderPaymentStatus) => {
    if (next === payment.status || next === 'pending') return;
    // Refunds happen in Finik's cabinet, and un-paying a payment Finik confirmed is rare: both ask first.
    if (next === 'refunded' || (next === 'unpaid' && succeeded)) setConfirming(next);
    else save({ paymentStatus: next }, copy.orders.paymentChanged);
  };

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[13px] font-semibold tracking-[.02em] text-muted uppercase">
        {copy.order.payment}
      </h3>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {PAYMENT_METHOD_LABELS[payment.method]}
            {succeeded?.channel && ` · ${PAYMENT_CHANNEL_LABELS[succeeded.channel]}`}
          </span>
          {payment.paidAt && (
            <span className="text-[13px] text-muted">
              {copy.order.paidAt(relativeDateTime(new Date(payment.paidAt)).toLowerCase())}
            </span>
          )}
        </div>
        <PaymentStatusSelect status={payment.status} disabled={busy} onChange={change} />
      </div>

      {/* Without an adjustment the amount is the order's «Итого» above, so it is not repeated here. */}
      {payment.adjustmentKgs !== 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-subtle px-3.5 py-3 text-[15px]">
          <Line label={copy.order.orderTotal} value={formatKgs(order.totalKgs)} muted />
          <Line
            label={payment.adjustmentNote ?? copy.order.adjustment}
            value={signed(payment.adjustmentKgs)}
            muted
          />
          <Line
            label={open ? copy.order.due : copy.order.paidSum}
            value={formatKgs(payment.amountKgs)}
            strong
          />
        </div>
      )}

      {open && payment.payUrl && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted">{copy.order.payLink}</span>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={waLink(order.phone, payment.linkMessage ?? payment.payUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-control border border-input bg-surface px-3.5 text-sm font-semibold text-ink hover:border-input-hover"
            >
              <WhatsAppIcon className="text-[#1fa855]" />
              {copy.order.sendLink}
            </a>
            <Button
              variant="outline"
              className="h-10 px-3.5 text-sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(payment.payUrl ?? '')
                  .then(() => toast.success(copy.order.linkCopied))
              }
            >
              {copy.order.copyLink}
            </Button>
          </div>
        </div>
      )}

      {open && (
        <AdjustmentForm
          key={`${payment.adjustmentKgs}:${payment.adjustmentNote}`}
          order={order}
          busy={busy}
          save={save}
        />
      )}

      {payment.attempts.length > 0 && (
        <details className="group text-sm">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 font-semibold text-muted hover:text-ink">
            {copy.order.attempts(payment.attempts.length)}
            <ChevronDownIcon className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="flex flex-col gap-1.5 pt-1">
            {payment.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-col gap-0.5 rounded-lg border border-line-2 px-3 py-2"
              >
                <span>{attemptLine(attempt)}</span>
                {attempt.error && <span className="text-[13px] break-words text-red">{attempt.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <AlertDialog.Root open={confirming !== null} onOpenChange={(value) => !value && setConfirming(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,20,43,.4)]" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] flex w-[calc(100%-40px)] max-w-[420px] -translate-1/2 flex-col gap-3 rounded-card bg-surface p-6 shadow-xl">
            <AlertDialog.Title className="text-lg font-semibold">
              {confirming === 'refunded' ? copy.order.refundTitle : copy.order.unpayTitle}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-[15px] leading-normal text-muted">
              {confirming === 'refunded' ? copy.order.refundText : copy.order.unpayText}
            </AlertDialog.Description>
            <div className="mt-2 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="outline">{copy.order.cancel}</Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  onClick={() => {
                    if (confirming) save({ paymentStatus: confirming }, copy.orders.paymentChanged);
                    setConfirming(null);
                  }}
                >
                  {copy.order.confirm}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function attemptLine(attempt: PaymentAttempt): string {
  const parts = [
    PAYMENT_STATUS_LABELS[attempt.status],
    formatKgs(attempt.paidAmountKgs ?? attempt.amountKgs),
    relativeDateTime(new Date(attempt.paidAt ?? attempt.createdAt)),
  ];
  if (attempt.channel) parts.push(PAYMENT_CHANNEL_LABELS[attempt.channel]);
  if (attempt.receiptNumber) parts.push(copy.order.receipt(attempt.receiptNumber));
  return parts.join(' · ');
}

/** Native select styled as a pill, like the order status. «Ждёт оплаты» is set by Finik links only. */
function PaymentStatusSelect({
  status,
  disabled,
  onChange,
}: {
  status: OrderPaymentStatus;
  disabled: boolean;
  onChange: (status: OrderPaymentStatus) => void;
}) {
  const options: OrderPaymentStatus[] =
    status === 'pending' ? ['pending', ...MANUAL_PAYMENT_STATUSES] : [...MANUAL_PAYMENT_STATUSES];
  return (
    <span className="relative inline-flex flex-none">
      <select
        aria-label={copy.order.paymentStatus}
        value={status}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as OrderPaymentStatus)}
        className={cn(
          'h-8 cursor-pointer appearance-none rounded-full border-0 pr-[30px] pl-3 text-[13px] font-semibold outline-none disabled:opacity-60',
          PAYMENT_STYLE[status],
        )}
      >
        {options.map((value) => (
          <option key={value} value={value} disabled={value === 'pending'}>
            {ORDER_PAYMENT_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className={cn('pointer-events-none absolute top-2.5 right-3', PAYMENT_STYLE[status].split(' ')[1])}
      />
    </span>
  );
}

/** The signed adjustment and its note, while the order is unpaid (docs/finik/SPEC.md §0.5). */
function AdjustmentForm({
  order,
  busy,
  save,
}: {
  order: OrderDetail;
  busy: boolean;
  save: (change: UpdateOrder, success: string) => void;
}) {
  const payment = order.payment;
  const [kgs, setKgs] = useState(payment.adjustmentKgs ? String(payment.adjustmentKgs) : '');
  const [note, setNote] = useState(payment.adjustmentNote ?? '');
  const value = kgs.trim() === '' ? 0 : Number(kgs);
  const valid = Number.isInteger(value);
  const dirty = value !== payment.adjustmentKgs || note.trim() !== (payment.adjustmentNote ?? '');
  const due = valid ? order.totalKgs + value : null;

  return (
    <details className="group text-sm" open={payment.adjustmentKgs !== 0 || undefined}>
      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 font-semibold text-muted hover:text-ink">
        {copy.order.adjustmentTitle}
        <ChevronDownIcon className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-2.5 pt-1">
        <span className="text-[13px] leading-normal text-muted">{copy.order.adjustmentHint}</span>
        <div className="flex flex-wrap items-end gap-2">
          <Labeled label={copy.order.adjustmentKgs} className="w-[120px]">
            <input
              type="number"
              step={1}
              value={kgs}
              onChange={(event) => setKgs(event.target.value)}
              placeholder="+300"
              className={cn(inputClass, 'h-10', !valid && 'border-red')}
            />
          </Labeled>
          <Labeled label={copy.order.adjustmentNote} className="min-w-[160px] flex-1">
            <input
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.order.adjustmentNotePlaceholder}
              className={cn(inputClass, 'h-10')}
            />
          </Labeled>
          <Button
            variant="outline"
            className="h-10 text-sm"
            disabled={!dirty || !valid || busy || (due !== null && due < 1)}
            onClick={() => save({ adjustmentKgs: value, adjustmentNote: note }, copy.order.adjustmentSaved)}
          >
            {copy.order.adjustmentSave}
          </Button>
        </div>
        {dirty && due !== null && (
          <span className={cn('text-[13px]', due < 1 ? 'text-red' : 'text-muted')}>
            {due < 1 ? copy.validation['order.adjustment.amount'] : `${copy.order.due}: ${formatKgs(due)}`}
          </span>
        )}
      </div>
    </details>
  );
}

function Labeled({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Line({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', muted && 'text-muted')}>
      <span className={cn('min-w-0', strong && 'font-semibold')}>{label}</span>
      <span className={cn('whitespace-nowrap', strong && 'text-[17px] font-semibold text-ink')}>{value}</span>
    </div>
  );
}
