'use client';

import { orderContactSchema } from '@bom/shared/forms';
import type { ImageRef, OrderItemType } from '@bom/shared';
import { buildOrderMessage, formatKgs, LINE_QTY_MAX, waLink } from '@bom/shared/web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { copy, validationText } from '@/content/copy';
import { cn } from '@/lib/cn';
import { clockTime, openExternal, submissionMeta, submit } from '@/lib/submission';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { useCart } from '../cart/cart';
import { useCurrency } from '../currency';
import { BagIcon, MinusIcon, PlusIcon, TrashIcon } from '../icons';
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

export function OrderSheet({
  request,
  open,
  onClose,
  whatsapp,
  turnstileSiteKey,
}: {
  request: OrderRequest | null;
  open: boolean;
  onClose: () => void;
  whatsapp: string;
  turnstileSiteKey: string | null;
}) {
  const { code, rate, format } = useCurrency();
  const cart = useCart();
  const pathname = usePathname();
  const [directQty, setDirectQty] = useState(1);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ message: '', time: '' });
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
    /* eslint-enable react-hooks/set-state-in-effect */
    clearErrors();
  }, [request, clearErrors]);

  useEffect(() => () => window.clearTimeout(sendTimer.current), []);

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

  const send = () => {
    if (sending || lines.length === 0) return;
    const values = getValues();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        setError(field, { message: issue.message }, { shouldFocus: false });
      }
      const first = parsed.error.issues[0]?.path[0];
      if (typeof first === 'string') document.getElementById(`order-${first}`)?.focus();
      return;
    }
    const message = buildOrderMessage({
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
    });
    // WhatsApp first, still inside the click: pop-up blockers allow it and the visitor never waits for the API.
    openExternal(waLink(whatsapp, message));
    submit('/orders', {
      ...submissionMeta(message),
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
    });
    setSent({ message, time: clockTime() });
    setSending(true);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      setStep('done');
      // A cart order empties the cart; a direct program order leaves it untouched (README §7.4).
      if (!direct) cart.clear();
    }, 700);
  };

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
      {step === 'done' ? (
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
            <Field id="order-phone" label={copy.order.phone} error={errorOf('phone')}>
              <TextInput
                id="order-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={copy.order.phonePlaceholder}
                invalid={Boolean(errorOf('phone'))}
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

          <div className="mt-5 flex flex-col gap-1 border-t border-line-2 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold">{copy.order.total}</span>
              <span className="text-[22px] font-semibold tracking-[-0.02em] whitespace-nowrap">
                {format(total)}
              </span>
            </div>
            <span className="text-sm leading-normal text-muted">{copy.order.paymentNote}</span>
            {code !== 'KGS' && (
              <span className="text-sm leading-normal text-muted">{copy.order.inKgs(formatKgs(total))}</span>
            )}
          </div>

          {turnstileSiteKey && (
            <div className="mt-4">
              <Turnstile siteKey={turnstileSiteKey} onToken={(token) => (turnstileToken.current = token)} />
            </div>
          )}

          <SubmitButton sending={sending} label={sending ? copy.order.submitting : copy.order.submit} />
          <p className="mt-3.5 text-center text-sm leading-normal text-balance text-muted">
            {copy.order.whatsappHint}
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
  children,
}: {
  id: string;
  label: ReactNode;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="text-[13px] text-error">
          {error}
        </span>
      )}
    </div>
  );
}

function TextInput({
  id,
  invalid,
  registration,
  ...props
}: {
  id: string;
  invalid: boolean;
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
      aria-describedby={invalid ? `${id}-error` : undefined}
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
