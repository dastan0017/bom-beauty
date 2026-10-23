'use client';

import { orderContactSchema } from '@bom/shared/forms';
import type { ImageRef, OrderItemType, PaymentMethod, PublicSettings } from '@bom/shared';
import { buildOrderMessage, formatKgs, LINE_QTY_MAX, waLink } from '@bom/shared/web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { copy, validationText } from '@/content/copy';
import { cn } from '@/lib/cn';
import { createOnlineOrder } from '@/lib/pay-client';
import { readPendingPayment, savePendingPayment, tokenOf, type PendingPayment } from '@/lib/pending-payment';
import { clockTime, openExternal, submissionMeta, submit, track } from '@/lib/submission';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { useCart } from '../cart/cart';
import { useCurrency } from '../currency';
import { ArrowRightIcon, BagIcon, MinusIcon, PlusIcon, TrashIcon, WhatsAppIcon } from '../icons';
import { outlineButton, primaryButton } from '../ui';
import { Honeypot, SubmitButton } from './form-parts';
import { Sheet, SheetHandle, SheetHeader, sheetBodyClass } from './sheet';
import { SentScreen } from './sent-screen';
import { Turnstile } from './turnstile';

/** A program ordered directly from its page or video (README §7.4, direct mode). */
export interface OrderItem {
  type: OrderItemType;
  slug: string;
  /** Program title. */
  title: string;
  /** "5 средств · курс на 6–8 недель". */
  meta: string;
  priceKgs: number;
  image: ImageRef | null;
}

/** Cart mode shows and sends the cart; direct mode sends one program and leaves the cart as it is. */
export type OrderRequest =
  | { id: number; mode: 'cart' }
  | { id: number; mode: 'direct'; item: OrderItem; qty: number; fromQuiz: boolean };

interface SheetLine {
  type: OrderItemType;
  slug: string;
  title: string;
  meta: string;
  priceKgs: number;
  qty: number;
  image: ImageRef | null;
}

const formSchema = orderContactSchema.extend({
  comment: z.string().trim().max(500, 'order.comment.max'),
});
type FormValues = z.input<typeof formSchema> & { website: string };
type FieldName = keyof z.input<typeof formSchema>;

const EMPTY: FormValues = { name: '', phone: '+996 ', address: '', comment: '', website: '' };

/** An online order sent to Finik, kept for the way back (browser back button, WhatsApp fallback). */
interface OnlineOrder {
  number: number;
  /** The order's payment page: it reuses a live Finik link or asks for a new one. */
  page: string;
  /** The order message with "Номер заказа на сайте", for WhatsApp. */
  whatsappMessage: string;
}

type Notice = { kind: 'unavailable' } | { kind: 'network' } | { kind: 'error'; text: string };

export function OrderSheet({
  request,
  open,
  onClose,
  whatsapp,
  turnstileSiteKey,
  payments,
}: {
  request: OrderRequest | null;
  open: boolean;
  onClose: () => void;
  whatsapp: string;
  turnstileSiteKey: string | null;
  payments: PublicSettings['payments'];
}) {
  const { code, rate, format } = useCurrency();
  const cart = useCart();
  const pathname = usePathname();
  const [directQty, setDirectQty] = useState(1);
  const [step, setStep] = useState<'form' | 'done' | 'waiting'>('form');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ message: '', time: '' });
  // The visitor's choice stays while the page is open; without online payment it is always WhatsApp.
  const [chosen, setChosen] = useState<PaymentMethod>(payments.defaultMethod);
  const method: PaymentMethod = payments.finik ? chosen : 'whatsapp';
  const [notice, setNotice] = useState<Notice | null>(null);
  const [unpaid, setUnpaid] = useState<PendingPayment | null>(null);
  const [online, setOnline] = useState<OnlineOrder | null>(null);
  const onlineRef = useRef<OnlineOrder | null>(null);
  // One clientRef per submission: a retry after a network error returns the order the first try may have stored.
  const clientRef = useRef<string | null>(null);
  const turnstileToken = useRef<string | undefined>(undefined);
  const sendTimer = useRef<number | undefined>(undefined);
  const { register, getValues, setError, clearErrors, formState } = useForm<FormValues>({
    defaultValues: EMPTY,
  });

  // A new request resets the sheet; the contact fields keep what the visitor typed before.
  useEffect(() => {
    if (!request) return;
    window.clearTimeout(sendTimer.current);
    /* eslint-disable react-hooks/set-state-in-effect -- reset local state when the sheet is opened again */
    setDirectQty(request.mode === 'direct' ? request.qty : 1);
    setStep('form');
    setSending(false);
    setNotice(null);
    // An online order of the cart that was not paid yet: offer its payment page instead of a second order.
    const pending = readPendingPayment();
    setUnpaid(pending && request.mode === 'cart' && pending.fromCart ? pending : null);
    /* eslint-enable react-hooks/set-state-in-effect */
    clientRef.current = null;
    clearErrors();
  }, [request, clearErrors]);

  useEffect(() => () => window.clearTimeout(sendTimer.current), []);

  // Back from Finik with the browser's back button: the page comes back frozen on «Переходим к оплате…».
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || !onlineRef.current) return;
      setSending(false);
      setStep('waiting');
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);

  if (!request) return null;
  const direct = request.mode === 'direct' ? request : null;
  const lines: SheetLine[] = direct
    ? [{ ...direct.item, qty: directQty }]
    : cart.lines.map((line) => ({
        type: 'product' as const,
        slug: line.slug,
        title: line.name,
        meta: [line.brand, line.volume].filter(Boolean).join(' · '),
        priceKgs: line.priceKgs,
        qty: line.qty,
        image: line.image,
      }));
  const total = lines.reduce((sum, line) => sum + line.priceKgs * line.qty, 0);

  const showFieldErrors = (fields: Record<string, string>): boolean => {
    const names = Object.keys(fields).filter((name): name is FieldName =>
      ['name', 'phone', 'address', 'comment'].includes(name),
    );
    for (const name of names) setError(name, { message: fields[name] }, { shouldFocus: false });
    if (names[0]) document.getElementById(`order-${names[0]}`)?.focus();
    return names.length > 0;
  };

  /** Valid form values and the order message, or null after marking the invalid fields. */
  const prepare = (closing: 'details' | 'online') => {
    const values = getValues();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        setError(field, { message: issue.message }, { shouldFocus: false });
      }
      const first = parsed.error.issues[0]?.path[0];
      if (typeof first === 'string') document.getElementById(`order-${first}`)?.focus();
      return null;
    }
    const order = {
      lines: lines.map((line) => ({
        type: line.type,
        title: line.title,
        qty: line.qty,
        total: format(line.priceKgs * line.qty),
      })),
      total: format(total),
      ...(code !== 'KGS' ? { totalKgs: formatKgs(total) } : {}),
      name: values.name,
      phone: values.phone,
      address: values.address,
      comment: values.comment,
    };
    const message = buildOrderMessage(order, { closing });
    clientRef.current ??= crypto.randomUUID();
    const body = {
      ...submissionMeta(message),
      clientRef: clientRef.current,
      items: lines.map((line) => ({ type: line.type, slug: line.slug, qty: line.qty })),
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
      displayCurrency: code,
      ...(code !== 'KGS' ? { displayRate: rate } : {}),
      ...(direct?.fromQuiz ? { fromQuiz: true } : {}),
      ...(values.website ? { website: values.website } : {}),
      ...(turnstileToken.current ? { turnstileToken: turnstileToken.current } : {}),
    };
    return { order, message, body };
  };

  /** Today's flow: WhatsApp opens inside the click, the record goes out in the background (outbox). */
  const sendWhatsapp = () => {
    if (sending || lines.length === 0) return;
    const prepared = prepare('details');
    if (!prepared) return;
    openExternal(waLink(whatsapp, prepared.message));
    submit('/orders', { ...prepared.body, ...(payments.finik ? { paymentMethod: 'whatsapp' } : {}) });
    clientRef.current = null;
    setNotice(null);
    setSent({ message: prepared.message, time: clockTime() });
    setSending(true);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      setStep('done');
      // A cart order empties the cart; a direct program order leaves it untouched (README §7.4).
      if (!direct) cart.clear();
    }, 700);
  };

  /** Online: the order is stored first, then the visitor goes to Finik's page for the amount the API computed. */
  const sendOnline = async () => {
    if (sending || lines.length === 0) return;
    const prepared = prepare('online');
    if (!prepared) return;
    setNotice(null);
    setSending(true);
    track('payment_start', { place: 'sheet' });
    const result = await createOnlineOrder({ ...prepared.body, paymentMethod: 'finik' });
    if (!result.ok) {
      setSending(false);
      const failure = result.failure;
      track('payment_error', {
        reason: failure.kind === 'api' ? (failure.code ?? String(failure.status)) : 'network',
      });
      if (failure.kind === 'api' && failure.code === 'payment_unavailable') {
        setChosen('whatsapp');
        setNotice({ kind: 'unavailable' });
      } else if (failure.kind === 'api' && failure.status === 400 && showFieldErrors(failure.fields)) {
        clientRef.current = null;
      } else if (failure.kind === 'api' && failure.status < 500 && failure.status !== 429) {
        clientRef.current = null;
        setNotice({ kind: 'error', text: failure.message ?? copy.payment.networkError });
      } else {
        setNotice({ kind: 'network' });
      }
      return;
    }
    const { number, payment } = result.value;
    if (!payment) {
      // Only a bot (honeypot) gets here.
      setSending(false);
      return;
    }
    const token = tokenOf(payment.page);
    if (token) savePendingPayment({ token, number, fromCart: !direct });
    const sentOrder: OnlineOrder = {
      number,
      page: payment.page,
      whatsappMessage: buildOrderMessage(prepared.order, { number }),
    };
    onlineRef.current = sentOrder;
    setOnline(sentOrder);
    clientRef.current = null;
    window.location.assign(payment.url ?? payment.page);
  };

  const send = () => (method === 'finik' ? void sendOnline() : sendWhatsapp());

  const field = (name: FieldName) =>
    register(name, {
      onChange: () => {
        if (formState.errors[name]) clearErrors(name);
      },
    });
  const errorOf = (name: FieldName): string | undefined => {
    const code = formState.errors[name]?.message;
    return code ? (validationText[code] ?? validationText['phone.invalid']) : undefined;
  };

  // "+ Добавить ещё средства" closes the sheet on the catalog, elsewhere it leads there (navigation closes it).
  const onCatalog = pathname === '/catalog';

  return (
    <Sheet open={open} onClose={onClose} label={copy.order.title}>
      {step === 'waiting' && online ? (
        <WaitingScreen
          order={online}
          onPay={() => window.location.assign(online.page)}
          onWhatsapp={() => openExternal(waLink(whatsapp, online.whatsappMessage))}
        />
      ) : step === 'done' ? (
        <SentScreen
          title={copy.order.doneTitle}
          text={copy.order.doneText}
          message={sent.message}
          time={sent.time}
          onResend={() => openExternal(waLink(whatsapp, sent.message))}
          backLabel={copy.order.continueShopping}
          onBack={onClose}
        />
      ) : lines.length === 0 ? (
        <div className={sheetBodyClass}>
          <SheetHandle />
          <SheetHeader title={copy.order.title} onClose={onClose} />
          <div className="flex flex-col items-center gap-2 px-2 pt-7 pb-2 text-center">
            <span className="flex size-[60px] items-center justify-center rounded-full bg-surface-2 text-muted">
              <BagIcon size={22} strokeWidth={1.9} />
            </span>
            <span className="mt-1.5 text-lg font-semibold">{copy.cart.emptyTitle}</span>
            <span className="text-[15px] leading-normal text-balance text-muted">{copy.cart.emptyText}</span>
            <div className="mt-3.5 flex flex-col gap-2 self-stretch">
              <Link
                href="/programs"
                onClick={onClose}
                className="flex h-[52px] items-center justify-center rounded-button bg-accent text-base font-semibold text-white"
              >
                {copy.cart.emptyPrograms}
              </Link>
              <Link
                href="/catalog"
                onClick={onClose}
                className="flex h-[52px] items-center justify-center rounded-button border border-line bg-white text-base font-semibold text-ink"
              >
                {copy.cart.emptyCatalog}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form
          noValidate
          className={sheetBodyClass}
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <SheetHandle />
          <SheetHeader title={copy.order.title} onClose={onClose} />
          {payments.finik && unpaid && (
            <a
              href={`/pay/${unpaid.token}`}
              className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-2.5 text-[15px] font-semibold text-accent-ink"
            >
              {copy.payment.unpaidBanner(unpaid.number)}
              <ArrowRightIcon size={16} className="flex-none" />
            </a>
          )}
          <ul aria-label={copy.order.lines} className="mt-3.5 flex flex-col rounded-2xl bg-bg px-3 py-0.5">
            {lines.map((line, index) => (
              <li
                key={`${line.type}:${line.slug}`}
                className={cn('flex flex-col gap-2.5 py-3', index > 0 && 'border-t border-line-2')}
              >
                <div className="flex items-center gap-3">
                  <span className="relative flex size-[52px] flex-none items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                    <BbImage
                      image={line.image}
                      sizes="52px"
                      width={104}
                      alt=""
                      placeholder={<PhotoPlaceholder label={copy.common.photo} className="text-[10px]" />}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] leading-[1.3] font-semibold">
                      {line.type === 'program' ? copy.order.programLabel(line.title) : line.title}
                    </span>
                    <span className="text-[13px] leading-[1.35] text-muted">{line.meta}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pl-16">
                  <LineStepper
                    qty={line.qty}
                    name={line.title}
                    // A program line stays at 1 or more; a cart line at 1 shows a bin that removes it.
                    removable={!direct}
                    onChange={(qty) =>
                      direct ? setDirectQty(Math.max(1, qty)) : cart.setQty(line.slug, qty)
                    }
                  />
                  <span className="flex-none text-base font-semibold whitespace-nowrap">
                    {format(line.priceKgs * line.qty)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {!direct && (
            <div className="mt-1 flex items-center justify-between gap-3">
              <Link
                href="/catalog"
                onClick={(event) => {
                  if (onCatalog) {
                    event.preventDefault();
                    onClose();
                  }
                }}
                className="inline-flex h-11 items-center gap-1.5 text-[15px] font-semibold text-accent-ink"
              >
                <PlusIcon size={14} strokeWidth={2.6} />
                {copy.cart.addMore}
              </Link>
              <button
                type="button"
                onClick={cart.clear}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-hover bg-white px-4 text-[15px] font-semibold whitespace-nowrap text-ink hover:border-ink active:bg-surface-2"
              >
                <TrashIcon size={15} />
                {copy.cart.clear}
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3.5">
            <Field id="order-name" label={copy.order.name} error={errorOf('name')}>
              <TextInput
                id="order-name"
                autoComplete="name"
                placeholder={copy.order.namePlaceholder}
                invalid={Boolean(errorOf('name'))}
                registration={field('name')}
              />
            </Field>
            <Field
              id="order-phone"
              label={copy.order.phone}
              error={errorOf('phone')}
              hint={method === 'finik' ? copy.payment.phoneHint : undefined}
            >
              <TextInput
                id="order-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={copy.order.phonePlaceholder}
                invalid={Boolean(errorOf('phone'))}
                hinted={method === 'finik'}
                registration={field('phone')}
              />
            </Field>
            <Field id="order-address" label={copy.order.address} error={errorOf('address')}>
              <TextInput
                id="order-address"
                autoComplete="street-address"
                placeholder={copy.order.addressPlaceholder}
                invalid={Boolean(errorOf('address'))}
                registration={field('address')}
              />
            </Field>
            <Field
              id="order-comment"
              label={
                <>
                  {copy.order.comment} <span className="font-normal text-muted">{copy.order.optional}</span>
                </>
              }
              error={errorOf('comment')}
            >
              <TextInput
                id="order-comment"
                placeholder={copy.order.commentPlaceholder}
                invalid={Boolean(errorOf('comment'))}
                registration={field('comment')}
              />
            </Field>
            <Honeypot registration={register('website')} />
          </div>

          {payments.finik && (
            <MethodPicker
              value={method}
              visa={payments.visa}
              onChange={(next) => {
                setChosen(next);
                setNotice(null);
              }}
            />
          )}

          <div className="mt-5 flex flex-col gap-1 border-t border-line-2 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold">{copy.order.total}</span>
              <span className="text-[22px] font-semibold tracking-[-0.02em] whitespace-nowrap">
                {format(total)}
              </span>
            </div>
            {/* With online payment on, the caption under the method picker says how the order is paid. */}
            {!payments.finik && (
              <span className="text-sm leading-normal text-muted">{copy.order.paymentNote}</span>
            )}
            {code !== 'KGS' && (
              <span className="text-sm leading-normal text-muted">{copy.order.inKgs(formatKgs(total))}</span>
            )}
          </div>

          {turnstileSiteKey && (
            <div className="mt-4">
              <Turnstile siteKey={turnstileSiteKey} onToken={(token) => (turnstileToken.current = token)} />
            </div>
          )}

          {notice && (
            <div
              role="alert"
              className="mt-4 flex flex-col items-start gap-1 rounded-xl bg-surface-2 px-4 py-3 text-[15px] leading-normal"
            >
              <span>
                {notice.kind === 'unavailable'
                  ? copy.payment.unavailable
                  : notice.kind === 'network'
                    ? copy.payment.networkError
                    : notice.text}
              </span>
              {notice.kind !== 'unavailable' && (
                <button
                  type="button"
                  onClick={sendWhatsapp}
                  className="inline-flex h-11 items-center font-semibold text-accent-ink underline underline-offset-[3px]"
                >
                  {copy.payment.sendWhatsapp}
                </button>
              )}
            </div>
          )}

          {method === 'finik' ? (
            <SubmitButton
              sending={sending}
              icon={null}
              label={sending ? copy.payment.submitting : copy.payment.submit(formatKgs(total))}
            />
          ) : (
            <SubmitButton sending={sending} label={sending ? copy.order.submitting : copy.order.submit} />
          )}
          <p className="mt-3.5 text-center text-sm leading-normal text-balance text-muted">
            {method === 'finik' ? copy.payment.hint : copy.order.whatsappHint}
          </p>
          <p className="mt-2 text-center text-xs leading-normal text-muted">
            {copy.order.consent}
            <Link href="/privacy" className="underline underline-offset-2" onClick={onClose}>
              {copy.order.consentLink}
            </Link>
          </p>
        </form>
      )}
    </Sheet>
  );
}

/** − / + with 40 px round buttons; at 1 the minus becomes a bin that removes a cart line (README §7.4). */
function LineStepper({
  qty,
  name,
  removable,
  onChange,
}: {
  qty: number;
  name: string;
  removable: boolean;
  onChange: (qty: number) => void;
}) {
  const round =
    'flex size-10 flex-none items-center justify-center rounded-full border border-line bg-white text-ink disabled:opacity-40';
  const bin = removable && qty === 1;
  return (
    <div className="flex items-center gap-1" role="group" aria-label={name}>
      <button
        type="button"
        aria-label={bin ? copy.order.remove : copy.cart.less}
        disabled={!removable && qty <= 1}
        className={cn(round, bin && 'text-muted')}
        onClick={() => onChange(qty - 1)}
      >
        {bin ? <TrashIcon size={15} /> : <MinusIcon size={14} strokeWidth={2.6} />}
      </button>
      <span aria-live="polite" className="min-w-7 text-center text-base font-semibold">
        {qty}
      </span>
      <button
        type="button"
        aria-label={copy.cart.more}
        disabled={qty >= LINE_QTY_MAX}
        className={round}
        onClick={() => onChange(qty + 1)}
      >
        <PlusIcon size={14} strokeWidth={2.6} />
      </button>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-[13px] text-error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-[13px] leading-[1.35] text-muted">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

function TextInput({
  id,
  invalid,
  hinted = false,
  registration,
  ...props
}: {
  id: string;
  invalid: boolean;
  /** A hint sits under the field (Field's `hint`). */
  hinted?: boolean;
  registration: UseFormRegisterReturn;
  type?: string;
  inputMode?: 'tel' | 'text';
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : hinted ? `${id}-hint` : undefined}
      className={cn(
        'h-[52px] w-full rounded-xl border bg-white px-4 text-base text-ink outline-none placeholder:text-muted/70',
        'focus:border-accent focus:shadow-[0_0_0_4px_var(--halo)]',
        invalid ? 'border-error-border' : 'border-line',
      )}
      {...props}
      {...registration}
    />
  );
}

/**
 * «Онлайн» / «WhatsApp»: a two-option segmented control (native radios, so arrows and screen readers work as usual)
 * with one caption line saying how the order is paid.
 */
function MethodPicker({
  value,
  visa,
  onChange,
}: {
  value: PaymentMethod;
  visa: boolean;
  onChange: (method: PaymentMethod) => void;
}) {
  const options: { method: PaymentMethod; label: string }[] = [
    { method: 'finik', label: copy.payment.online },
    { method: 'whatsapp', label: copy.payment.whatsapp },
  ];
  return (
    <div className="mt-5 flex flex-col gap-1.5">
      <span id="order-method-label" className="text-sm font-semibold">
        {copy.payment.method}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="order-method-label"
        aria-describedby="order-method-note"
        className="flex gap-0.5 rounded-tabs bg-surface-2 p-0.5"
      >
        {options.map((option) => (
          <label
            key={option.method}
            className={cn(
              'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-tab text-[15px] font-semibold',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              value === option.method
                ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,20,43,.12)]'
                : 'text-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name="order-method"
              value={option.method}
              checked={value === option.method}
              onChange={() => onChange(option.method)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <span id="order-method-note" className="text-sm leading-normal text-muted">
        {value === 'finik'
          ? visa
            ? copy.payment.onlineNoteVisa
            : copy.payment.onlineNote
          : copy.order.paymentNote}
      </span>
    </div>
  );
}

/** Back from Finik unpaid (browser back button): the order exists, so only its payment or WhatsApp is offered. */
function WaitingScreen({
  order,
  onPay,
  onWhatsapp,
}: {
  order: OnlineOrder;
  onPay: () => void;
  onWhatsapp: () => void;
}) {
  return (
    <div className={`${sheetBodyClass} items-center text-center`}>
      <SheetHandle />
      <span className="mt-7 flex size-[68px] items-center justify-center rounded-full bg-surface-2 text-muted">
        <BagIcon size={26} strokeWidth={1.9} />
      </span>
      <h2
        data-autofocus
        tabIndex={-1}
        className="mt-5 self-stretch heading text-[calc(26px*var(--fhk))] leading-[1.15] outline-none"
      >
        {copy.payment.waitingTitle}
      </h2>
      <p className="mt-2 self-stretch text-base leading-normal text-balance text-muted">
        {copy.payment.waitingText(order.number)}
      </p>
      <button
        type="button"
        onClick={onPay}
        className={cn(primaryButton, 'mt-6 h-14 w-full px-5 text-[17px]')}
      >
        {copy.payment.toPayment}
      </button>
      <button
        type="button"
        onClick={onWhatsapp}
        className={cn(outlineButton, 'mt-3 h-[54px] w-full text-base')}
      >
        <WhatsAppIcon size={18} className="text-whatsapp" />
        {copy.payment.sendWhatsapp}
      </button>
    </div>
  );
}
