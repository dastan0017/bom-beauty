import type { Metadata } from 'next';
import Link from 'next/link';
import { BbImage } from '@/components/bb-image';
import { HeroPhoto, QuizLink } from '@/components/home/home-client';
import { Reviews } from '@/components/home/reviews';
import {
  ArrowRightIcon,
  BagIcon,
  BoxIcon,
  CheckIcon,
  DashIcon,
  DropIcon,
  SparkleOutlineIcon,
  WandIcon,
} from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { QuizStickyBar } from '@/components/sticky-bar';
import { AccentTitle, ArrowBubble, card, container, SectionTitle } from '@/components/ui';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { getContent, getReviews, getSettings } from '@/lib/data';
import { organizationLd } from '@/lib/seo';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const ENTRY_LINKS = { programs: '/programs', catalog: '/catalog', wholesale: '/wholesale' } as const;
const ENTRY_ICONS = { programs: DropIcon, catalog: BagIcon, wholesale: BoxIcon } as const;

export default async function HomePage() {
  const [home, reviews, settings] = await Promise.all([getContent('home'), getReviews(), getSettings()]);
  if (!home) throw new Error('Home content is missing');
  const { data, refs } = home;
  const image = (id: string | null) => (id ? (refs.images[id] ?? null) : null);
  const greeting = data.greetingVideoId ? (refs.videos[data.greetingVideoId] ?? null) : null;
  const { shop } = settings;

  return (
    <>
      <JsonLd data={organizationLd(settings)} />

      <section className="rounded-b-[var(--hrad)] [background:var(--hbg)]">
        <div className="items-[var(--hal)] mx-auto flex max-w-[640px] flex-col px-5 pt-[26px] pb-[30px] [text-align:var(--hta)] lg:pt-12 lg:pb-12">
          <div className="mb-[22px] flex flex-col items-center gap-5">
            <HeroPhoto
              image={image(data.heroPhotoMediaId)}
              video={greeting}
              instagram={shop.instagramOwner}
              ownerName={shop.ownerName}
            />
            {data.heroBadge && (
              <span className="inline-flex h-8 items-center gap-2 rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent-ink">
                <span className="size-[7px] rounded-full bg-stock" />
                {data.heroBadge}
              </span>
            )}
          </div>
          <h1 className="self-stretch heading text-[calc(var(--h1s)*var(--fhk))] leading-[1.06] text-hero-ink lg:text-[calc(52px*var(--fhk))]">
            <AccentTitle text={data.heroTitle} accentClassName="text-highlight" />
          </h1>
          {data.heroSubtitle && (
            <p className="mt-2.5 self-stretch text-base leading-normal text-pretty text-hero-muted">
              {data.heroSubtitle}
            </p>
          )}
          <Link
            href="/programs"
            className="mt-[26px] flex h-[58px] items-center justify-center gap-3 self-stretch rounded-button border-2 border-accent bg-surface px-[22px] text-[17px] font-semibold text-accent transition-colors hover:bg-accent-soft active:brightness-[.96]"
          >
            <SparkleOutlineIcon size={20} />
            <span className="whitespace-nowrap">{copy.home.toPrograms}</span>
            <ArrowRightIcon size={20} />
          </Link>
          {data.quizPrompt && (
            <p className="mt-[22px] self-stretch text-[15px] leading-[1.45] text-balance text-hero-muted">
              {data.quizPrompt}
            </p>
          )}
          <QuizLink className="mt-3 flex h-14 items-center justify-center gap-2.5 self-stretch rounded-button bg-accent pr-3 pl-2.5 text-base font-semibold text-white shadow-[0_16px_30px_-14px_var(--acsh)] transition-[transform,filter] hover:brightness-95 active:scale-[.985]">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-full bg-white/22 text-white">
              <WandIcon size={18} />
            </span>
            <span className="whitespace-nowrap">{copy.home.toQuiz}</span>
          </QuizLink>
        </div>
      </section>

      <section
        className={cn(container, 'flex flex-col gap-2.5 px-4 pt-5 lg:grid lg:grid-cols-3 lg:gap-4 lg:pt-10')}
      >
        {data.entries.map((entry) => {
          const Icon = ENTRY_ICONS[entry.key];
          return (
            <Link
              key={entry.key}
              href={ENTRY_LINKS[entry.key]}
              className={cn(
                card,
                'flex items-stretch gap-3.5 py-3 pr-3.5 pl-3 transition-transform hover:border-line-hover active:scale-[.985]',
              )}
            >
              <span className="relative flex min-h-[88px] w-24 flex-none items-center justify-center self-stretch overflow-hidden rounded-[calc(var(--rc)-8px)] bg-accent-soft text-accent-ink">
                <BbImage
                  image={image(entry.imageMediaId)}
                  sizes="96px"
                  width={192}
                  alt=""
                  placeholder={<Icon size={30} />}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1">
                <span className="text-lg leading-[1.25] font-semibold tracking-[-0.01em]">{entry.title}</span>
                <span className="text-[15px] leading-[1.4] text-pretty text-muted">{entry.text}</span>
              </span>
              <ArrowBubble />
            </Link>
          );
        })}
      </section>

      <section className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pt-14 lg:pt-20">
        <SectionTitle center title={data.comparison.title} lead={data.comparison.subtitle} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface-2 px-3.5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted">{data.comparison.mass.eyebrow}</span>
              <span className="text-base leading-[1.25] font-semibold text-muted">
                {data.comparison.mass.title}
              </span>
            </div>
            {data.comparison.mass.points.filter(Boolean).map((point) => (
              <div key={point} className="flex items-start gap-2">
                <span className="mt-px flex size-5 flex-none items-center justify-center rounded-full bg-line text-muted">
                  <DashIcon size={10} />
                </span>
                <span className="text-sm leading-[1.4] text-muted">{point}</span>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-3 rounded-card border-[1.5px] border-accent bg-surface px-3.5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-accent-ink">{data.comparison.pro.eyebrow}</span>
              <span className="text-base leading-[1.25] font-semibold">{data.comparison.pro.title}</span>
            </div>
            {data.comparison.pro.points.filter(Boolean).map((point) => (
              <div key={point} className="flex items-start gap-2">
                <span className="mt-px flex size-5 flex-none items-center justify-center rounded-full bg-accent text-white">
                  <CheckIcon size={11} />
                </span>
                <span className="text-sm leading-[1.4] text-ink">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                  className="flex items-center gap-1.5 text-sm text-muted"
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

      <QuizStickyBar />
    </>
  );
}
