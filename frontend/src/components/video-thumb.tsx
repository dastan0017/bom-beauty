import type { ProgramCard } from '@bom/shared';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/words';
import { PlayIcon, SparkleIcon } from './icons';

/** Vertical video thumbnail with play badge and duration (programs list and quiz results). */
export function VideoThumb({ program, className }: { program: ProgramCard; className?: string }) {
  const poster = program.video?.poster;
  const duration = formatDuration(program.video?.durationSec);
  return (
    <span className={cn('relative flex-none overflow-hidden rounded-xl bg-[var(--poster)]', className)}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- Bunny poster, already sized by the CDN
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-accent-ink/60">
          <SparkleIcon size={18} />
        </span>
      )}
      {program.video && (
        <>
          <span className="absolute inset-0 bg-[linear-gradient(rgba(14,14,44,0)_50%,rgba(14,14,44,.6))]" />
          <span className="absolute top-1/2 left-1/2 flex size-[26px] -translate-1/2 items-center justify-center rounded-full bg-white/95 text-accent">
            <PlayIcon size={10} className="ml-px" />
          </span>
          {duration && (
            <span className="absolute inset-x-0 bottom-1 text-center text-[11px] font-semibold text-white">
              {duration}
            </span>
          )}
        </>
      )}
    </span>
  );
}
