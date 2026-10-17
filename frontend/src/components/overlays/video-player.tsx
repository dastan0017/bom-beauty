'use client';

import type { VideoRef } from '@bom/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { formatDuration } from '@/lib/words';
import { ArrowRightIcon, CloseIcon, PlayIcon } from '../icons';
import { useModal, usePresence } from './use-dialog';

export interface VideoSpec {
  title: string;
  video: VideoRef;
  /** End card shown when the video finishes (design: vEnded). */
  end: { title: string; text: string; ctaLabel: string; onCta: () => void };
}

/**
 * Full-screen player from the design: native <video> (Bunny HLS first, MP4 fallback), tap to pause, progress bar,
 * end card with the next step. No player library (docs/ARCHITECTURE.md §6.2).
 */
export function VideoPlayer({ spec, onClose }: { spec: VideoSpec | null; onClose: () => void }) {
  const open = spec !== null;
  const { mounted, visible } = usePresence(open, 250);
  const panel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastSpec, setLastSpec] = useState<VideoSpec | null>(spec);
  useModal(panel, open, onClose);

  // Keep the last video while the close transition runs.
  if (spec && spec !== lastSpec) {
    setLastSpec(spec);
    setEnded(false);
    setTime(0);
    setDuration(spec.video.durationSec ?? 0);
  }

  useEffect(() => {
    if (!open) video.current?.pause();
  }, [open]);

  if (!mounted || !lastSpec) return null;
  const { video: ref, title, end } = lastSpec;

  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaying(false));
    else element.pause();
  };

  const replay = () => {
    const element = video.current;
    if (!element) return;
    element.currentTime = 0;
    setEnded(false);
    void element.play().catch(() => setPlaying(false));
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className={`fixed inset-0 z-[60] overflow-hidden bg-black transition-opacity duration-200 outline-none ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <video
        ref={video}
        className="absolute inset-0 size-full object-contain"
        poster={ref.poster ?? undefined}
        playsInline
        autoPlay
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
      >
        {ref.hls && <source src={ref.hls} type="application/vnd.apple.mpegurl" />}
        {ref.mp4 && <source src={ref.mp4} type="video/mp4" />}
      </video>

      <button
        type="button"
        aria-label={playing ? copy.video.pause : copy.common.play}
        onClick={toggle}
        className="absolute inset-0 size-full cursor-pointer"
      />

      <div className="pointer-events-none absolute inset-x-3.5 top-[calc(14px+env(safe-area-inset-top))] flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 rounded-[14px] bg-[rgba(14,14,44,.62)] px-3.5 py-2.5">
          <span className="text-[15px] font-semibold text-white">{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.video.close}
          data-autofocus
          className="pointer-events-auto flex size-11 flex-none items-center justify-center rounded-full bg-[rgba(14,14,44,.62)] text-white"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {!playing && !ended && (
        <span className="pointer-events-none absolute top-1/2 left-1/2 flex size-20 -translate-1/2 items-center justify-center rounded-full bg-white text-accent shadow-[0_12px_30px_rgba(14,14,44,.3)]">
          <PlayIcon size={28} className="ml-[3px]" />
        </span>
      )}

      {!ended && (
        <div className="absolute inset-x-3.5 bottom-[calc(14px+env(safe-area-inset-bottom))] mx-auto flex max-w-[640px] flex-col gap-2 rounded-2xl bg-[rgba(14,14,44,.62)] px-4 py-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            aria-label={copy.video.seek}
            onChange={(event) => {
              const element = video.current;
              if (element) element.currentTime = Number(event.target.value);
            }}
            className="video-range h-5 w-full cursor-pointer"
            style={{ '--progress': `${duration ? (time / duration) * 100 : 0}%` } as CSSProperties}
          />
          <div className="flex justify-between text-[13px] text-[#E7E8F3]">
            <span>{formatDuration(time) || '0:00'}</span>
            <span>{formatDuration(duration) || '0:00'}</span>
          </div>
        </div>
      )}

      {ended && (
        <div className="absolute inset-x-3.5 bottom-[calc(14px+env(safe-area-inset-bottom))] mx-auto flex max-w-[480px] flex-col rounded-[20px] bg-white p-5">
          <span className="text-[19px] leading-[1.3] font-semibold text-ink">{end.title}</span>
          <span className="mt-1 text-[15px] leading-[1.45] text-muted">{end.text}</span>
          <button
            type="button"
            onClick={end.onCta}
            className="mt-4 flex h-[54px] w-full items-center justify-center gap-3 rounded-button bg-accent text-[17px] font-semibold text-white shadow-[0_0_0_6px_var(--halo)] hover:brightness-[.94]"
          >
            <span className="whitespace-nowrap">{end.ctaLabel}</span>
            <ArrowRightIcon size={20} />
          </button>
          <button
            type="button"
            onClick={replay}
            className="mt-1.5 h-[46px] text-[15px] font-semibold text-ink"
          >
            {copy.video.replay}
          </button>
        </div>
      )}
    </div>
  );
}
