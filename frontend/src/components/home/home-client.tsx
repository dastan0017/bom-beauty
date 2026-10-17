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
import { PlayIcon } from '../icons';
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
          <span className="flex size-full items-center justify-center bg-accent-soft heading text-[34px] text-accent-ink">
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
