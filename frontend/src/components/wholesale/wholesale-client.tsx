'use client';

import type { ContentValue, FileRef, VideoRef, WholesaleBuyer, WholesaleCountry } from '@bom/shared';
import {
  buildWholesaleMessage,
  waLink,
  WHOLESALE_BUYER_LABELS,
  WHOLESALE_BUYERS,
  WHOLESALE_COUNTRIES,
  WHOLESALE_COUNTRY_LABELS,
} from '@bom/shared/web';
import Image from 'next/image';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { clockTime, openExternal, submissionMeta, submit, track } from '@/lib/submission';
import { formatMinutes } from '@/lib/words';
import { DownloadIcon, PhoneIcon, PlayIcon, WhatsAppBubbleIcon } from '../icons';
import { Honeypot, SubmitButton } from '../overlays/form-parts';
import { SentScreen } from '../overlays/sent-screen';
import { Sheet, SheetHandle, SheetHeader, sheetBodyClass } from '../overlays/sheet';
import { useOverlays } from '../overlays/site-overlays';
import { Turnstile } from '../overlays/turnstile';
import { StickyBar, useScrolledPast } from '../sticky-bar';
import { primaryButton } from '../ui';

type Delivery = ContentValue<'wholesale'>['delivery'];

interface WholesaleContext {
  openPriceRequest: () => void;
  whatsapp: string;
}

const Context = createContext<WholesaleContext | null>(null);

function useWholesale(): WholesaleContext {
  const value = use(Context);
  if (!value) throw new Error('useWholesale outside WholesaleProvider');
  return value;
}

/** Page-level state for /wholesale: the price-request sheet (design: sheetWs / sheetWsDone). */
export function WholesaleProvider({
  whatsapp: override,
  delivery,
  turnstileSiteKey,
  children,
}: {
  whatsapp: string | null;
  delivery: Delivery;
  turnstileSiteKey: string | null;
  children: ReactNode;
}) {
  const { whatsapp: shopWhatsapp } = useOverlays();
  const whatsapp = override || shopWhatsapp;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [buyer, setBuyer] = useState<WholesaleBuyer | undefined>();
  const [country, setCountry] = useState<WholesaleCountry | undefined>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ message: '', time: '' });
  const token = useRef<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const { register, getValues } = useForm<{ website: string }>({ defaultValues: { website: '' } });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const eta = (() => {
    if (!country) return null;
    const row = delivery.find((entry) => entry.flags.includes(country));
    if (!row) return null;
    return country === 'ru'
      ? copy.wholesaleSheet.etaMoscow(row.airDays, row.seaDays)
      : copy.wholesaleSheet.eta(row.airDays, row.seaDays);
  })();

  const send = () => {
    if (sending) return;
    const message = buildWholesaleMessage({ buyer, country });
    openExternal(waLink(whatsapp, message));
    const website = getValues('website');
    submit('/leads/wholesale', {
      ...submissionMeta(message),
      answers: { ...(buyer ? { buyer } : {}), ...(country ? { country } : {}) },
      ...(website ? { website } : {}),
      ...(token.current ? { turnstileToken: token.current } : {}),
    });
    setSent({ message, time: clockTime() });
    setSending(true);
    timer.current = window.setTimeout(() => {
      setSending(false);
      setStep('done');
    }, 700);
  };

  const close = () => setOpen(false);

  return (
    <Context
      value={{
        whatsapp,
        openPriceRequest: () => {
          window.clearTimeout(timer.current);
          setSending(false);
          setStep('form');
          setOpen(true);
        },
      }}
    >
      {children}
      <Sheet open={open} onClose={close} label={copy.wholesaleSheet.title}>
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
            <SheetHeader title={copy.wholesaleSheet.title} onClose={close} />
            <p className="mt-0.5 text-[15px] leading-normal text-pretty text-muted">
              {copy.wholesaleSheet.lead}
            </p>
            <fieldset className="mt-[22px] flex flex-col gap-2.5">
              <legend className="mb-2.5 text-sm font-semibold">{copy.wholesaleSheet.who}</legend>
              <div className="flex flex-wrap gap-2">
                {WHOLESALE_BUYERS.map((key) => (
                  <Chip
                    key={key}
                    on={buyer === key}
                    onClick={() => setBuyer(buyer === key ? undefined : key)}
                  >
                    {WHOLESALE_BUYER_LABELS[key].label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5 flex flex-col gap-2.5">
              <legend className="mb-2.5 text-sm font-semibold">{copy.wholesaleSheet.where}</legend>
              <div className="flex flex-wrap gap-2">
                {WHOLESALE_COUNTRIES.map((key) => (
                  <Chip
                    key={key}
                    on={country === key}
                    onClick={() => setCountry(country === key ? undefined : key)}
                    className="gap-2 pr-4 pl-3"
                  >
                    <Flag code={key} />
                    {WHOLESALE_COUNTRY_LABELS[key].label}
                  </Chip>
                ))}
              </div>
              {eta && (
                <span
                  className="flex items-center gap-2 text-sm leading-[1.45] text-muted"
                  aria-live="polite"
                >
                  <span className="size-[7px] flex-none rounded-full bg-stock" />
                  {eta}
                </span>
              )}
            </fieldset>
            <Honeypot registration={register('website')} />
            {turnstileSiteKey && (
              <div className="mt-4">
                <Turnstile siteKey={turnstileSiteKey} onToken={(value) => (token.current = value)} />
              </div>
            )}
            <SubmitButton
              sending={sending}
              label={sending ? copy.wholesaleSheet.submitting : copy.wholesaleSheet.submit}
            />
            <p className="mt-3.5 text-center text-sm leading-normal text-balance text-muted">
              {copy.order.whatsappHint}
            </p>
          </form>
        ) : (
          <SentScreen
            title={copy.wholesaleSheet.doneTitle}
            text={copy.wholesaleSheet.doneText}
            message={sent.message}
            time={sent.time}
            onResend={() => openExternal(waLink(whatsapp, sent.message))}
            backLabel={copy.wholesaleSheet.back}
            onBack={close}
          />
        )}
      </Sheet>
    </Context>
  );
}

function Chip({
  on,
  onClick,
  className,
  children,
}: {
  on: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 flex-none items-center rounded-full border px-[18px] text-[15px]',
        on
          ? 'border-chip bg-chip font-semibold text-white'
          : 'border-line bg-surface text-ink hover:border-line-hover',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Flag({ code }: { code: WholesaleCountry }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={22}
      height={16}
      unoptimized
      className="block h-4 w-[22px] flex-none rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(19,35,63,.14)]"
    />
  );
}

/** Opens the price-request sheet; a plain WhatsApp link before hydration. */
export function PriceRequestButton({ className, children }: { className?: string; children: ReactNode }) {
  const { openPriceRequest, whatsapp } = useWholesale();
  return (
    <a
      href={waLink(whatsapp, buildWholesaleMessage({}))}
      target="_blank"
      rel="noopener noreferrer"
      role="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openPriceRequest();
      }}
    >
      {children}
    </a>
  );
}

/** "Скачать каталог брендов": the PDF when uploaded, otherwise a note (design: catalog / catHint). */
export function CatalogButton({ file, hintClassName }: { file: FileRef | null; hintClassName?: string }) {
  const [hint, setHint] = useState(false);
  const className =
    'flex h-14 items-center justify-center gap-2.5 self-stretch rounded-button border border-line bg-white px-5 text-base font-semibold text-ink hover:brightness-[.97]';
  const content = (
    <>
      <DownloadIcon size={18} className="flex-none" />
      <span className="whitespace-nowrap">{copy.wholesale.downloadCatalog}</span>
      <span className="rounded-md bg-surface-2 px-[7px] py-[3px] text-xs leading-[1.2] font-semibold text-muted">
        PDF
      </span>
    </>
  );
  if (file) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener"
        className={className}
        onClick={() => track('wholesale_catalog_download', { place: 'wholesale' })}
      >
        {content}
      </a>
    );
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setHint(true)}>
        {content}
      </button>
      {hint && (
        <span
          role="status"
          className={cn('mt-2.5 self-stretch text-center text-sm leading-normal', hintClassName)}
        >
          {copy.wholesale.catalogPending}
        </span>
      )}
    </>
  );
}

/** Calls when the number is confirmed, otherwise explains why there is none yet (design: call / callHint). */
export function CallButton({ phone }: { phone: string }) {
  const [hint, setHint] = useState(false);
  const digits = phone.replace(/\D/g, '');
  const ready = digits.length >= 11;
  return (
    <>
      <div className="mt-[22px] flex items-center gap-3.5 self-stretch border-t border-line pt-5 text-left">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm text-hero-muted">{copy.wholesale.callLabel}</span>
          <span className="text-xl font-semibold tracking-[-0.02em] whitespace-nowrap text-hero-ink">
            {ready ? phone : copy.wholesale.phonePending}
          </span>
        </div>
        {ready ? (
          <a
            href={`tel:+${digits}`}
            aria-label={copy.wholesale.call}
            className="flex size-[52px] flex-none items-center justify-center rounded-full border border-line bg-white text-ink hover:border-line-hover"
          >
            <PhoneIcon size={20} />
          </a>
        ) : (
          <button
            type="button"
            aria-label={copy.wholesale.call}
            onClick={() => setHint(true)}
            className="flex size-[52px] flex-none items-center justify-center rounded-full border border-line bg-white text-ink hover:border-line-hover"
          >
            <PhoneIcon size={20} />
          </button>
        )}
      </div>
      {hint && (
        <span role="status" className="mt-3 self-stretch text-left text-sm leading-normal text-hero-muted">
          {copy.wholesale.phonePendingHint}
        </span>
      )}
    </>
  );
}

/** "Обо мне" media: the wholesale video when uploaded (design: wsVideo). */
export function WholesaleVideo({
  video,
  ownerName,
  children,
}: {
  video: VideoRef;
  ownerName: string;
  children: ReactNode;
}) {
  const { openVideo } = useOverlays();
  const { openPriceRequest } = useWholesale();
  const minutes = video.durationSec ? formatMinutes(video.durationSec) : null;
  return (
    <button
      type="button"
      aria-label={copy.common.play}
      className="relative h-60 bg-media-placeholder"
      onClick={() =>
        openVideo({
          title: copy.video.wholesaleTitle,
          video,
          end: {
            title: copy.video.wholesaleEnd,
            text: copy.video.wholesaleEndText,
            ctaLabel: copy.video.wholesaleCta,
            onCta: openPriceRequest,
          },
        })
      }
    >
      {children}
      {minutes && (
        <span className="absolute top-3.5 left-3.5 rounded-full bg-[rgba(14,14,44,.6)] px-2.5 py-1.5 text-[13px] font-semibold text-white">
          {copy.wholesale.videoBadge(minutes)}
        </span>
      )}
      <span className="absolute top-1/2 left-1/2 flex size-16 -translate-1/2 items-center justify-center rounded-full bg-white text-accent shadow-[0_12px_30px_rgba(14,14,44,.28)]">
        <PlayIcon size={22} className="ml-[3px]" />
      </span>
      <span className="absolute bottom-3.5 left-3.5 flex h-[34px] items-center rounded-full bg-white/95 px-3.5 text-sm font-semibold text-ink">
        {ownerName}
      </span>
    </button>
  );
}

/** "Получить прайс в WhatsApp" bar after scrolling (design: stickyWs). */
export function WholesaleStickyBar() {
  const { busy } = useOverlays();
  const scrolled = useScrolledPast(480);
  return (
    <StickyBar visible={scrolled && !busy}>
      <PriceRequestButton
        className={cn(
          primaryButton,
          'h-[52px] flex-1 gap-2.5 px-[18px] text-base shadow-[0_14px_26px_-14px_var(--acsh)]',
        )}
      >
        <WhatsAppBubbleIcon size={18} />
        {copy.wholesale.stickyCta}
      </PriceRequestButton>
    </StickyBar>
  );
}
