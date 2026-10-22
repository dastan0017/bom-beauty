import type { ContentValue } from '@bom/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BbImage, PhotoPlaceholder } from '@/components/bb-image';
import { ProductRail } from '@/components/catalog/product-rail';
import { HeroBranches } from '@/components/home/hero-branches';
import { HeroContent, HeroPhoto, QuizBanner, QuizLink } from '@/components/home/home-client';
import { Reviews } from '@/components/home/reviews';
import { ArrowRightIcon, CheckIcon, CloseIcon, FlaskIcon, TruckIcon, WandIcon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { ProgramTile } from '@/components/program/program-tile';
import { QuizStickyBar } from '@/components/sticky-bar';
import { AccentTitle, card, SectionTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import {
  getCategories,
  getContent,
  getProductsSafe,
  getProgramsSafe,
  getReviews,
  getSettings,
} from '@/lib/data';
import { organizationLd } from '@/lib/seo';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// Block order from design/updates-2026-10/README.md §1: hero, programs, catalog, comparison, about, reviews, rails.
export default async function HomePage() {
  const [home, reviews, settings, programs, products, categories] = await Promise.all([
    getContent('home'),
    getReviews(),
    getSettings(),
    getProgramsSafe(),
    getProductsSafe(),
    getCategories().catch(() => []),
  ]);
  if (!home) throw new Error('Home content is missing');
  const { data, refs } = home;
  const image = (id: string | null) => (id ? (refs.images[id] ?? null) : null);
  const greeting = data.greetingVideoId ? (refs.videos[data.greetingVideoId] ?? null) : null;
  const { shop } = settings;

  return (
    <>
      <JsonLd data={organizationLd(settings)} />

      <section className="relative isolate rounded-b-[var(--hrad)] [background:var(--hbg)]">
        <HeroBranches />
        <HeroContent className="items-[var(--hal)] mx-auto flex max-w-[640px] flex-col px-5 pb-[30px] [text-align:var(--hta)] lg:pb-12">
          <div className="mb-[22px] flex flex-col items-center gap-5">
            <HeroPhoto
              image={image(data.heroPhotoMediaId)}
              video={greeting}
              instagram={shop.instagramOwner}
              ownerName={shop.ownerName}
            />
            <span className="inline-flex h-[34px] items-center gap-2 rounded-full bg-accent-soft px-4 text-[15px] font-semibold whitespace-nowrap text-accent-ink">
              <span lang="ko" className="font-korean text-[17px] leading-none font-medium">
                {copy.home.pillKorean}
              </span>
              <span>{copy.home.pillRest}</span>
            </span>
          </div>
          <h1 className="self-stretch heading text-[calc(var(--h1s)*var(--fhk))] leading-[1.06] text-hero-ink lg:text-[calc(52px*var(--fhk))]">
            <AccentTitle text={data.heroTitle} accentClassName="text-highlight" />
          </h1>
          {data.heroSubtitle && (
            <p className="mt-2.5 self-stretch text-base leading-normal text-pretty text-hero-muted">
              {data.heroSubtitle}
            </p>
          )}
          <ul className="mt-[22px] flex flex-col gap-3 [align-self:var(--hal)] text-left">
            <TrustRow
              icon={
                <Image
                  src="/flags/kr.svg"
                  alt=""
                  width={22}
                  height={16}
                  unoptimized
                  className="block h-4 w-[22px] rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(19,35,63,.14)]"
                />
              }
              text={copy.home.trust.origin}
            />
            <TrustRow
              icon={<FlaskIcon size={20} className="text-accent" />}
              text={copy.home.trust.formulas}
            />
            <TrustRow
              icon={<TruckIcon size={20} strokeWidth={1.9} className="text-accent" />}
              text={copy.home.trust.delivery}
            />
          </ul>
          <QuizLink className="mt-[26px] flex min-h-16 items-center justify-center gap-3.5 self-stretch rounded-button bg-accent px-4 py-2.5 text-left text-white shadow-[0_16px_30px_-14px_var(--acsh)] transition-[transform,filter] duration-[120ms] hover:brightness-95 active:scale-[.985]">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-white/22">
              <WandIcon size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[17px] leading-[1.2] font-semibold">{copy.home.quizCta}</span>{' '}
              <span className="text-[15px] leading-[1.25]">{copy.home.quizCtaSub}</span>
            </span>
          </QuizLink>
        </HeroContent>
      </section>

      {programs.length > 0 && (
        <section className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 pt-14 lg:px-6 lg:pt-20">
          <SectionTitle center title={copy.home.programsTitle} lead={copy.home.programsLead} />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {programs.map((program) => (
              <ProgramTile key={program.slug} program={program} />
            ))}
          </div>
          <QuizBanner />
        </section>
      )}

      <section className="mx-auto max-w-[1100px] px-4 pt-14 lg:px-6 lg:pt-20">
        <div className={cn(card, 'flex flex-col overflow-hidden lg:grid lg:grid-cols-2')}>
          <Link
            href="/catalog"
            tabIndex={-1}
            aria-hidden="true"
            className="relative flex aspect-[2/1] items-center justify-center bg-surface-2 lg:aspect-auto lg:min-h-[320px]"
          >
            <BbImage
              image={image(data.catalogImageMediaId)}
              sizes="(min-width: 1024px) 540px, 100vw"
              width={640}
              alt=""
              placeholder={<PhotoPlaceholder label={copy.home.catalogPhoto} className="text-xs" />}
            />
          </Link>
          <div className="flex flex-col gap-3.5 px-[18px] pt-[18px] pb-5 lg:justify-center lg:p-8">
            <div className="flex flex-col gap-1.5">
              <h2 className="heading text-[calc(26px*var(--fhk))] leading-[1.15] lg:text-[calc(32px*var(--fhk))]">
                {copy.home.catalogTitle}
              </h2>
              <p className="text-[15px] leading-normal text-pretty text-muted">{copy.home.catalogLead}</p>
            </div>
            {categories.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {categories
                  .filter((category) => category.count > 0)
                  .map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={`/catalog?category=${category.slug}`}
                        className="tap inline-flex h-10 items-center rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-ink hover:border-line-hover"
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            <Link
              href="/catalog"
              className="flex h-[52px] items-center justify-center gap-2.5 rounded-button border-[1.5px] border-ink bg-surface px-5 text-base font-semibold text-ink hover:bg-surface-2"
            >
              {copy.home.catalogOpen}
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </div>
      </section>

      <Comparison comparison={data.comparison} />

      <section className="mx-auto max-w-[760px] px-4 pt-14 lg:pt-20">
        <div className={cn(card, 'flex flex-col gap-[18px] px-5 py-[22px]')}>
          <div className="flex items-center gap-3.5">
            <span className="relative size-16 flex-none overflow-hidden rounded-full">
              <BbImage
                image={image(data.about.photoMediaId)}
                sizes="64px"
                width={128}
                alt={shop.ownerName}
                placeholder={
                  <span className="flex size-full items-center justify-center bg-accent-soft heading text-2xl text-accent-ink">
                    {shop.ownerName.charAt(0)}
                  </span>
                }
              />
            </span>
            <div className="flex flex-col gap-[3px]">
              <span className="text-sm text-muted">{data.about.caption}</span>
              <span className="text-[19px] leading-[1.2] font-semibold tracking-[-0.01em]">
                {shop.ownerName}
              </span>
              {shop.instagramOwner && (
                <a
                  href={`https://instagram.com/${shop.instagramOwner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap flex items-center gap-1.5 text-sm text-muted"
                >
                  @{shop.instagramOwner}
                  <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-pink text-white">
                    <CheckIcon size={8} strokeWidth={4} />
                  </span>
                </a>
              )}
            </div>
          </div>
          <p className="text-base leading-[1.55] text-pretty whitespace-pre-line text-muted">
            {data.about.text}
          </p>
          {data.about.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 border-t border-line-2 pt-[18px]">
              {data.about.stats.map((stat) => (
                <div key={stat.value} className="flex flex-col gap-0.5">
                  <span className="text-[26px] font-semibold tracking-[-0.03em]">{stat.value}</span>
                  <span className="text-sm leading-[1.4] text-muted">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="flex flex-col gap-3.5 pt-14 lg:pt-20">
          <SectionTitle center className="px-5" title={data.reviewsTitle} lead={data.reviewsSubtitle} />
          <Reviews reviews={reviews} />
        </section>
      )}

      <ProductRail
        className="pt-14 lg:pt-20"
        title={copy.home.rails.bestseller}
        products={products.filter((product) => product.bestseller)}
      />
      <ProductRail
        className="pt-14 lg:pt-20"
        title={copy.home.rails.isNew}
        products={products.filter((product) => product.isNew)}
      />
      <ProductRail
        className="pt-14 lg:pt-20"
        title={copy.home.rails.seoulChoice}
        products={products.filter((product) => product.seoulChoice)}
      />

      <QuizStickyBar />
    </>
  );
}

function TrustRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3 text-[15px] leading-[1.35] font-semibold text-hero-ink">
      <span className="flex w-6 flex-none items-center justify-center">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

/**
 * «Профессиональный уход vs масс-маркет» as two columns (README §1.4). Both cards share the outer grid's rows through
 * subgrid, so matching points line up across the columns whatever their length.
 */
function Comparison({ comparison }: { comparison: ContentValue<'home'>['comparison'] }) {
  const rows = 1 + Math.max(comparison.mass.points.length, comparison.pro.points.length);
  const sides = [
    { key: 'mass', side: comparison.mass, pro: false },
    { key: 'pro', side: comparison.pro, pro: true },
  ] as const;
  return (
    <section className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pt-14 lg:pt-20">
      <SectionTitle center title={comparison.title} lead={comparison.subtitle} />
      <div className="grid grid-cols-2 gap-x-2" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {sides.map(({ key, side, pro }) => (
          <div
            key={key}
            style={{ gridRow: `span ${rows}` }}
            className={cn(
              'grid min-w-0 grid-rows-subgrid gap-y-4 rounded-card px-3 pt-4 pb-[18px]',
              pro
                ? 'border-[1.5px] border-accent bg-surface shadow-[0_24px_44px_-32px_var(--acsh)]'
                : 'border border-line bg-surface-2',
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-xs font-semibold',
                  pro ? 'tracking-[0.02em] text-accent-ink' : 'text-muted',
                )}
              >
                {side.eyebrow}
              </span>
              <span className="text-base leading-[1.25] font-semibold">{side.title}</span>
            </div>
            {side.points
              .filter((point) => point.title)
              .map((point) => (
                <div key={point.title} className="flex min-w-0 items-start gap-2">
                  <span
                    className={cn(
                      'mt-px flex size-[18px] flex-none items-center justify-center rounded-full',
                      pro ? 'bg-accent text-white' : 'bg-line text-muted',
                    )}
                  >
                    {pro ? (
                      <CheckIcon size={10} strokeWidth={3.2} />
                    ) : (
                      <CloseIcon size={8} strokeWidth={3.6} />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-sm leading-[1.3] font-semibold">{point.title}</span>
                    {point.text && (
                      <span className="text-[13px] leading-[1.45] text-muted">{point.text}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
