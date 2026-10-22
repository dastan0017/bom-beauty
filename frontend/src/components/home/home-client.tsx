'use client';

import type { ImageRef, VideoRef } from '@bom/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { track } from '@/lib/submission';
import { readyProgramsCount } from '@/lib/words';
import { BbImage } from '../bb-image';
import { useCart } from '../cart/cart';
import { ArrowRightIcon, PlayIcon, SparkleOutlineIcon } from '../icons';
import { useOverlays } from '../overlays/site-overlays';

/** Opens the quiz; without JavaScript it is a plain link to the programs list. */
export function QuizLink({ className, children }: { className?: string; children: ReactNode }) {
  const { openQuiz } = useOverlays();
  return (
    <Link
      href="/programs"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openQuiz();
      }}
    >
      {children}
    </Link>
  );
}

/** «Не знаете, что выбрать?» card that opens the quiz (home under the programs grid, programs list). */
export function QuizBanner({ className }: { className?: string }) {
  return (
    <QuizLink
      className={cn(
        'flex items-center gap-3 rounded-card bg-accent-soft py-3.5 pr-3.5 pl-4 transition-transform active:scale-[.985]',
        className,
      )}
    >
      <SparkleOutlineIcon size={22} className="flex-none text-accent" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base leading-[1.3] font-semibold">{copy.programs.quizTitle}</span>
        <span className="text-sm leading-[1.4] text-muted">{copy.programs.quizText}</span>
      </span>
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface">
        <ArrowRightIcon size={16} />
      </span>
    </QuizLink>
  );
}

/**
 * Hero content box: while the home cart pill shows under the header, the top padding grows from 26 to 72 px so the
 * pill never covers the photo (README §1.1). Wide screens have room beside the photo and keep their padding.
 */
export function HeroContent({ className, children }: { className?: string; children: ReactNode }) {
  const { count } = useCart();
  return (
    <div
      data-cart={count > 0 ? '' : undefined}
      className={cn(
        'pt-[26px] transition-[padding-top] duration-[250ms] ease-[ease] data-[cart]:pt-[72px] lg:pt-12 lg:data-[cart]:pt-12',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Нурайым's photo in the hero: plays the greeting video, or opens her Instagram (design: heroTap). */
export function HeroPhoto({
  image,
  video,
  instagram,
  ownerName,
}: {
  image: ImageRef | null;
  video: VideoRef | null;
  instagram: string;
  ownerName: string;
}) {
  const { openVideo, programsCount } = useOverlays();
  const router = useRouter();
  const initials = ownerName
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2);

  const frame = (
    <>
      <BbImage
        image={image}
        sizes="96px"
        width={96}
        alt={ownerName}
        priority
        placeholder={
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center bg-accent-soft heading text-[34px] text-accent-ink"
          >
            {initials}
          </span>
        }
      />
      {video && (
        <span className="absolute top-1/2 left-1/2 flex size-9 -translate-1/2 items-center justify-center rounded-full bg-white text-accent shadow-[0_6px_16px_rgba(14,14,44,.3)]">
          <PlayIcon size={14} className="ml-0.5" />
        </span>
      )}
    </>
  );
  const frameClass =
    'relative block size-24 overflow-hidden rounded-[28px] shadow-[0_24px_40px_-18px_rgba(20,20,43,.5)]';

  if (video) {
    return (
      <button
        type="button"
        aria-label={copy.home.playGreeting}
        className={frameClass}
        onClick={() =>
          openVideo({
            title: copy.video.greetingTitle,
            video,
            end: {
              title: copy.video.greetingEnd,
              text: readyProgramsCount(programsCount),
              ctaLabel: copy.video.greetingCta,
              onCta: () => router.push('/programs'),
            },
          })
        }
      >
        {frame}
      </button>
    );
  }
  if (!instagram) return <span className={frameClass}>{frame}</span>;
  return (
    <a
      href={`https://instagram.com/${instagram}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ownerName}, Instagram`}
      className={cn(frameClass)}
      onClick={() => track('instagram_click', { place: 'hero' })}
    >
      {frame}
    </a>
  );
}
