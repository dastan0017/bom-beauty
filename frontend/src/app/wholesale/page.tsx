import type { Metadata } from 'next';
import Link from 'next/link';
import { BbImage, PhotoPlaceholder } from '@/components/bb-image';
import {
  ArrowRightIcon,
  ChatIcon,
  CheckIcon,
  ClipboardIcon,
  RepeatIcon,
  TrendIcon,
  TruckIcon,
} from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { AccentTitle, BackLink, card, SectionTitle } from '@/components/ui';
import {
  CallButton,
  CatalogButton,
  Flag,
  PriceRequestButton,
  WholesaleProvider,
  WholesaleStickyBar,
  WholesaleVideo,
} from '@/components/wholesale/wholesale-client';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getBrands, getContent, getSettings } from '@/lib/data';
import { breadcrumbsLd, excerpt } from '@/lib/seo';

const BENEFIT_ICONS = [TruckIcon, ClipboardIcon, TrendIcon, RepeatIcon];
const wrap = 'mx-auto w-full max-w-[1100px] lg:px-6';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getContent('wholesale').catch(() => null);
  return {
    title: copy.seo.wholesale,
    description: content ? excerpt(content.data.subtitle) : copy.wholesale.contactLead,
    alternates: { canonical: '/wholesale' },
  };
}

export default async function WholesalePage() {
  const [content, brands, settings] = await Promise.all([
    getContent('wholesale'),
    getBrands(),
    getSettings(),
  ]);
  if (!content) throw new Error('Wholesale content is missing');
  const { data, refs } = content;
  const catalogFile = data.catalogMediaId ? (refs.files[data.catalogMediaId] ?? null) : null;
  const video = data.videoId ? (refs.videos[data.videoId] ?? null) : null;
  const portrait = data.portraitMediaId ? (refs.images[data.portraitMediaId] ?? null) : null;
  const products = data.featuredProductIds
    .map((id) => refs.products.find((product) => product.id === id))
    .filter((product) => product !== undefined);
  const ownerName = settings.shop.ownerName;

  const portraitImage = (
    <BbImage
      image={portrait}
      sizes="(min-width: 1024px) 520px, 100vw"
      width={640}
      alt={ownerName}
      placeholder={<span className="absolute inset-0 bg-[var(--poster)]" />}
    />
  );

  return (
    <WholesaleProvider
      whatsapp={data.whatsapp}
      delivery={data.delivery}
      turnstileSiteKey={settings.turnstileSiteKey}
    >
      <JsonLd
        data={breadcrumbsLd([
          { name: copy.common.toHome, path: '/' },
          { name: copy.header.tabs.wholesale, path: '/wholesale' },
        ])}
      />

      <section className="rounded-b-[28px] [background:var(--whb,var(--hdr))]">
        <div className="mx-auto flex max-w-[720px] flex-col items-start px-5 pt-2.5 pb-8 lg:pt-6 lg:pb-14">
          <BackLink href="/" className="text-[var(--whi,var(--ti))] hover:text-hero-ink">
            {copy.wholesale.toHome}
          </BackLink>
          {data.eyebrow && (
            <span className="mt-2.5 inline-flex min-h-8 items-center rounded-full px-3.5 py-[5px] text-sm leading-[1.3] font-semibold text-hero-ink [background:var(--wht,var(--tt))]">
              {data.eyebrow}
            </span>
          )}
          <h1 className="mt-4 self-stretch heading text-[calc(30px*var(--fhk))] leading-[1.1] text-hero-ink lg:text-[calc(44px*var(--fhk))]">
            <AccentTitle text={data.title} accentClassName="text-highlight" />
          </h1>
          {data.subtitle && (
            <p className="mt-3.5 self-stretch text-[17px] leading-[1.45] text-pretty text-[var(--whi,var(--ti))]">
              {data.subtitle}
            </p>
          )}
          {data.facts.some(Boolean) && (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 self-stretch">
              {data.facts.filter(Boolean).map((fact) => (
                <li
                  key={fact}
                  className="inline-flex items-center gap-1.5 text-sm leading-[1.3] font-semibold text-hero-ink"
                >
                  <CheckIcon size={16} strokeWidth={2.4} className="flex-none text-accent" />
                  {fact}
                </li>
              ))}
            </ul>
          )}
          <PriceRequestButton className="mt-6 flex min-h-[58px] items-center justify-center self-stretch rounded-button bg-accent px-5 py-2.5 text-center text-[17px] leading-[1.25] font-semibold text-white shadow-[0_0_0_8px_rgba(255,255,255,.45),0_18px_32px_-14px_var(--acsh)] hover:brightness-[.94] active:brightness-[.88]">
            <span className="text-balance">{copy.wholesale.getPrice}</span>
          </PriceRequestButton>
          <div className="mt-5 flex flex-col self-stretch">
            <CatalogButton file={catalogFile} hintClassName="text-[var(--whi,var(--ti))]" />
          </div>
          <span className="mt-3.5 self-stretch text-center text-sm leading-[1.4] text-[var(--whi,var(--ti))]">
            {copy.wholesale.personalReply}
          </span>
        </div>
      </section>

      <section className={cn(wrap, 'flex flex-col gap-3.5 px-4 pt-9 lg:pt-16')}>
        <div className="flex flex-col gap-2 px-1">
          <span className="text-sm font-semibold text-accent-ink">{copy.wholesale.aboutEyebrow}</span>
          <h2 className="heading text-[calc(26px*var(--fhk))] leading-[1.15] lg:text-[calc(32px*var(--fhk))]">
            {copy.wholesale.aboutTitle}
          </h2>
        </div>
        <div className={cn(card, 'flex flex-col overflow-hidden lg:grid lg:grid-cols-[420px_minmax(0,1fr)]')}>
          {video ? (
            <WholesaleVideo video={video} ownerName={ownerName}>
              {portraitImage}
            </WholesaleVideo>
          ) : (
            <div className="relative h-60 bg-surface-2 lg:h-auto lg:min-h-[420px]">
              {portraitImage}
              <span className="absolute bottom-3.5 left-3.5 flex h-[34px] items-center rounded-full bg-white/95 px-3.5 text-sm font-semibold text-ink">
                {ownerName}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-3 px-5 pt-5 pb-[22px] lg:p-8">
            {data.quote && (
              <p className="text-xl leading-[1.35] font-semibold tracking-[-0.015em] text-pretty">
                «{data.quote}»
              </p>
            )}
            {data.intro.filter(Boolean).map((paragraph) => (
              <p key={paragraph} className="text-base leading-[1.55] text-pretty text-muted">
                {paragraph}
              </p>
            ))}
            {data.stats.length > 0 && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                {data.stats.map((stat) => (
                  <div
                    key={stat.value}
                    className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface-2 p-3.5"
                  >
                    <span className="text-2xl leading-[1.1] font-semibold tracking-[-0.03em] whitespace-nowrap">
                      {stat.value}
                    </span>
                    <span className="text-[13px] leading-[1.4] text-muted">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
            {data.expertise.some((item) => item.trim()) && (
              <div className="mt-1.5 flex flex-col gap-2.5">
                <span className="text-sm font-semibold">{copy.wholesale.expertise}</span>
                <div className="flex flex-wrap gap-2">
                  {data.expertise
                    .filter((item) => item.trim())
                    .map((item) => (
                      <span
                        key={item}
                        className="inline-flex min-h-[34px] items-center rounded-full bg-accent-soft px-3 py-1.5 text-sm leading-[1.3] font-semibold text-accent-ink"
                      >
                        {item}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={cn(wrap, 'flex flex-col gap-3.5 pt-14 lg:pt-20')}>
        <div className="flex items-end justify-between gap-3 px-5 lg:px-1">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="heading text-[calc(26px*var(--fhk))] leading-[1.15] lg:text-[calc(32px*var(--fhk))]">
              {copy.wholesale.brandsTitle}
            </h2>
            <span className="text-[15px] leading-[1.45] text-muted">{copy.wholesale.brandsLead}</span>
          </div>
          <Link
            href="/catalog"
            className="inline-flex h-11 flex-none items-center gap-1 text-[15px] font-semibold whitespace-nowrap text-accent"
          >
            {copy.wholesale.toCatalog}
            <ArrowRightIcon size={16} />
          </Link>
        </div>
        {brands.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-5 lg:px-1">
            {brands.map((brand) => (
              <li
                key={brand.slug}
                className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[15px] font-semibold tracking-[-0.01em] text-ink"
              >
                {brand.name}
              </li>
            ))}
          </ul>
        )}
        {products.length > 0 && (
          <ul className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-2.5 overflow-x-auto px-5 pt-1 pb-0.5 lg:scroll-px-1 lg:px-1">
            {products.map((product) => (
              <li key={product.slug} className="flex-none snap-start">
                <Link
                  href={`/catalog/${product.slug}`}
                  className={cn(
                    card,
                    'flex w-[150px] flex-col px-2 pt-2 pb-3 hover:border-line-hover lg:w-[180px]',
                  )}
                >
                  <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[calc(var(--rc)-8px)] bg-surface-2">
                    <BbImage
                      image={product.image}
                      sizes="180px"
                      width={360}
                      alt={product.name}
                      placeholder={<PhotoPlaceholder label={copy.common.productPhoto} />}
                    />
                  </span>
                  <span className="mt-2.5 px-1 text-[13px] text-muted">{product.brand}</span>
                  <span className="mt-0.5 px-1 text-[15px] leading-[1.3] font-semibold">{product.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.benefits.length > 0 && (
        <section className={cn(wrap, 'flex flex-col gap-3.5 px-4 pt-14 lg:pt-20')}>
          <SectionTitle title={copy.wholesale.benefitsTitle} />
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {data.benefits.map((benefit, index) => {
              const Icon = BENEFIT_ICONS[index % BENEFIT_ICONS.length] ?? TruckIcon;
              return (
                <div key={benefit.title} className={cn(card, 'flex min-w-0 flex-col gap-2.5 px-3.5 py-4')}>
                  <span className="flex size-11 flex-none items-center justify-center rounded-[14px] bg-accent-soft text-accent-ink">
                    <Icon size={22} />
                  </span>
                  <span className="text-[15px] leading-[1.3] font-semibold">{benefit.title}</span>
                  <span className="text-[13px] leading-[1.45] text-muted">{benefit.text}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className={cn(wrap, 'lg:grid lg:grid-cols-2 lg:gap-8')}>
        {data.steps.length > 0 && (
          <section className="flex flex-col gap-3 px-4 pt-14 lg:px-0 lg:pt-20">
            <SectionTitle title={copy.wholesale.stepsTitle} className="mb-0.5" />
            <ol className={cn(card, 'flex flex-col p-[18px]')}>
              {data.steps.map((step, index) => {
                const last = index === data.steps.length - 1;
                return (
                  <li key={step.title} className="flex gap-3.5">
                    <div className="flex w-8 flex-none flex-col items-center">
                      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-[15px] font-semibold text-white">
                        {index + 1}
                      </span>
                      {!last && <span className="my-1.5 w-0.5 flex-1 rounded-sm bg-accent-soft" />}
                    </div>
                    <div className={cn('flex min-w-0 flex-col gap-[3px] pt-[5px]', !last && 'pb-5')}>
                      <span className="text-[17px] leading-[1.3] font-semibold">{step.title}</span>
                      <span className="text-[15px] leading-[1.45] text-pretty text-muted">{step.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {(data.stockNote || data.delivery.length > 0) && (
          <section className="flex flex-col gap-3 px-4 pt-14 lg:px-0 lg:pt-20">
            <SectionTitle title={copy.wholesale.deliveryTitle} className="mb-0.5" />
            {data.stockNote && (
              <div className="flex items-center gap-3 rounded-card bg-accent-soft px-4 py-3.5">
                <span className="size-2 flex-none rounded-full bg-stock" />
                <span className="text-[15px] leading-[1.4] font-semibold text-accent-ink">
                  {data.stockNote}
                </span>
              </div>
            )}
            {data.delivery.length > 0 && (
              <div className={cn(card, 'flex flex-col px-[18px] pt-4 pb-[18px]')}>
                <span className="text-[13px] font-semibold text-muted">{copy.wholesale.preorderSupply}</span>
                {data.delivery.map((row, index) => (
                  <div
                    key={row.region}
                    className={cn(
                      'flex flex-col gap-2.5',
                      index === 0 ? 'mt-3' : 'mt-4 border-t border-line-2 pt-4',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                      <span className="flex gap-1.5">
                        {row.flags.map((flag) => (
                          <Flag key={flag} code={flag} />
                        ))}
                      </span>
                      <span className="text-base leading-[1.35] font-semibold">{row.region}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          [copy.wholesale.air, row.airDays],
                          [copy.wholesale.container, row.seaDays],
                        ] as const
                      ).map(([label, days]) => (
                        <div
                          key={label}
                          className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-surface-2 px-3.5 py-3"
                        >
                          <span className="text-[13px] text-muted">{label}</span>
                          <span className="flex flex-wrap items-baseline gap-x-[5px]">
                            <span className="text-[22px] font-semibold tracking-[-0.02em] whitespace-nowrap">
                              {days}
                            </span>
                            <span className="text-[15px] text-muted">{copy.wholesale.days}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section className="mx-auto max-w-[720px] px-4 pt-14 lg:pt-20">
        <div className="flex flex-col items-center rounded-card border border-line [background-color:var(--cbg)] [background-image:var(--cbgi)] px-5 pt-[30px] pb-6 text-center">
          <h2 className="heading text-[calc(28px*var(--fhk))] leading-[1.15] text-hero-ink">
            {copy.wholesale.contactTitle}
          </h2>
          <p className="mt-2.5 text-base leading-normal text-balance text-hero-muted">
            {copy.wholesale.contactLead}
          </p>
          <PriceRequestButton className="mt-6 flex h-[58px] items-center justify-center gap-3 self-stretch rounded-button bg-accent px-[22px] text-[17px] font-semibold text-white shadow-[0_0_0_6px_var(--hhalo)] hover:brightness-[.94] active:brightness-[.88]">
            <ChatIcon size={20} className="flex-none" />
            <span className="whitespace-nowrap">{copy.wholesale.contactCta}</span>
            <ArrowRightIcon size={20} className="flex-none" />
          </PriceRequestButton>
          <div className="mt-[18px] flex flex-col self-stretch">
            <CatalogButton file={catalogFile} hintClassName="text-hero-muted" />
          </div>
          <CallButton phone={data.phone} />
        </div>
      </section>

      <WholesaleStickyBar />
    </WholesaleProvider>
  );
}
