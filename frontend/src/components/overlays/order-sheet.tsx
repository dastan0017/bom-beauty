'use client';

import { createOrderSchema } from '@bom/shared/forms';
import type { ImageRef, OrderItemType } from '@bom/shared';
import { buildOrderMessage, formatKgs, waLink } from '@bom/shared/web';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';
import { copy, validationText } from '@/content/copy';
import { cn } from '@/lib/cn';
import { clockTime, openExternal, submissionMeta, submit } from '@/lib/submission';
import { BbImage, PhotoPlaceholder } from '../bb-image';
import { useCurrency } from '../currency';
import { Honeypot, QtyStepper, SubmitButton } from './form-parts';
import { Sheet, SheetHandle, SheetHeader, sheetBodyClass } from './sheet';
import { SentScreen } from './sent-screen';
import { Turnstile } from './turnstile';

export interface OrderItem {
  type: OrderItemType;
  slug: string;
  /** Product name or program title. */
  title: string;
  /** "Dr. SGN · 50 мл" or "5 средств · курс 4–6 недель". */
  meta: string;
  priceKgs: number;
  image: ImageRef | null;
}

export interface OrderRequest {
  item: OrderItem;
  qty: number;
  fromQuiz: boolean;
}

const formSchema = z.object({
  name: createOrderSchema.shape.name,
  phone: createOrderSchema.shape.phone,
  address: createOrderSchema.shape.address,
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
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ message: '', time: '' });
  const turnstileToken = useRef<string | undefined>(undefined);
  const sendTimer = useRef<number | undefined>(undefined);
  const { register, getValues, setError, clearErrors, formState } = useForm<FormValues>({
    defaultValues: EMPTY,
  });

  // A new order request resets the sheet; the contact fields keep what the visitor typed before.
  useEffect(() => {
    if (!request) return;
    window.clearTimeout(sendTimer.current);
    /* eslint-disable react-hooks/set-state-in-effect -- reset local state when a new item is opened */
    setQty(request.qty);
    setStep('form');
    setSending(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    clearErrors();
  }, [request, clearErrors]);

  useEffect(() => () => window.clearTimeout(sendTimer.current), []);

  if (!request) return null;
  const { item } = request;
  const total = item.priceKgs * qty;

  const send = () => {
    if (sending) return;
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
      item: { type: item.type, title: item.title },
      qty,
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
      item: { type: item.type, slug: item.slug },
      qty,
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
      displayCurrency: code,
      ...(code !== 'KGS' ? { displayRate: rate } : {}),
      ...(request.fromQuiz ? { fromQuiz: true } : {}),
      ...(values.website ? { website: values.website } : {}),
      ...(turnstileToken.current ? { turnstileToken: turnstileToken.current } : {}),
    });
    setSent({ message, time: clockTime() });
    setSending(true);
    sendTimer.current = window.setTimeout(() => {
      setSending(false);
      setStep('done');
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

  return (
    <Sheet open={open} onClose={onClose} label={copy.order.title}>
      {step === 'form' ? (
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
          <div className="mt-3.5 flex flex-col gap-3 rounded-2xl bg-bg p-3">
            <div className="flex items-center gap-3">
              <div className="relative flex size-[52px] flex-none items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                <BbImage
                  image={item.image}
                  sizes="52px"
                  width={52}
                  placeholder={<PhotoPlaceholder label={copy.common.photo} className="text-[10px]" />}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base leading-[1.3] font-semibold">
                  {item.type === 'program' ? copy.order.programLabel(item.title) : item.title}
                </span>
                <span className="text-sm text-muted">{item.meta}</span>
              </div>
              <span className="flex-none text-base font-semibold whitespace-nowrap">
                {format(item.priceKgs)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
              <span className="text-[15px] text-muted">{copy.order.quantity}</span>
              <QtyStepper value={qty} onChange={setQty} bordered />
            </div>
          </div>

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
      ) : (
        <SentScreen
          title={copy.order.doneTitle}
          text={copy.order.doneText}
          message={sent.message}
          time={sent.time}
          onResend={() => openExternal(waLink(whatsapp, sent.message))}
          backLabel={item.type === 'program' ? copy.order.backToProgram : copy.order.continueShopping}
          onBack={onClose}
        />
      )}
    </Sheet>
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
