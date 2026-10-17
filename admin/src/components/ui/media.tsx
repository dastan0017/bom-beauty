import type { AdminMedia, AdminVideo, ImageRef } from '@bom/shared';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { cn } from '@/lib/utils';
import { Spinner } from './index';

// Media slots of the editors (design: image-slot, PDF and video cards). Uploading is wired in M5 through `onUpload`;
// without it the drop zone is shown disabled.

const thumbUrl = (image: ImageRef, target: number): string => {
  const sorted = [...image.widths].sort((a, b) => a - b);
  const width = sorted.find((w) => w >= target) ?? sorted[sorted.length - 1] ?? target;
  return `${env.VITE_MEDIA_URL}/p/${image.id}/${width}.webp`;
};

export function MediaPreview({
  image,
  label,
  size = 320,
  className,
}: {
  image: ImageRef | null | undefined;
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('relative flex items-center justify-center overflow-hidden bg-subtle', className)}>
      {image ? (
        <img
          src={thumbUrl(image, size)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="font-mono text-[11px] text-muted">{label}</span>
      )}
    </span>
  );
}

function StatusOverlay({ media }: { media: AdminMedia }) {
  if (media.status === 'ready') return null;
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-[13px] font-semibold text-muted">
      {media.status === 'failed' ? (
        copy.media.failed
      ) : (
        <>
          <Spinner />
          {copy.media.processing}
        </>
      )}
    </span>
  );
}

/** Square photo slot: preview, status, remove. */
export function ImageSlot({
  media,
  label,
  onRemove,
  className,
}: {
  media: AdminMedia | null;
  label: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('group relative aspect-square overflow-hidden rounded-[14px] bg-subtle', className)}>
      <MediaPreview image={media?.image} label={label} className="absolute inset-0" />
      {media && <StatusOverlay media={media} />}
      {media && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={copy.media.remove}
          className="absolute top-2 right-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-red opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
        >
          {copy.media.remove}
        </button>
      )}
    </div>
  );
}

/** Dashed drop zone (design: "Загрузить PDF" / "Загрузить видео"). */
export function DropZone({
  icon,
  title,
  hint,
  onUpload,
  accept,
}: {
  icon?: ReactNode;
  title: string;
  hint: string;
  onUpload?: (file: File) => void;
  accept: string;
}) {
  const disabled = !onUpload;
  return (
    <label
      title={disabled ? copy.media.later : undefined}
      className={cn(
        'flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed px-4 py-7 text-center',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-dashed-hover',
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-subtle">
        {icon ?? <UploadIcon />}
      </span>
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-[13px] leading-normal text-muted">{disabled ? copy.media.later : hint}</span>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onUpload) onUpload(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}

export function PdfSlot({
  media,
  hint,
  onRemove,
  onUpload,
}: {
  media: AdminMedia | null;
  hint: string;
  onRemove: () => void;
  onUpload?: (file: File) => void;
}) {
  if (!media)
    return (
      <DropZone
        title={copy.media.uploadPdf}
        hint={hint}
        accept="application/pdf,.pdf"
        {...(onUpload ? { onUpload } : {})}
      />
    );
  const file = media.file;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <span className="flex h-[58px] w-12 flex-none items-center justify-center rounded-control bg-subtle text-xs font-bold text-red">
          PDF
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">
            {file?.name ?? copy.media.processing}
          </span>
          {file?.bytes ? <span className="text-sm text-muted">{formatSize(file.bytes)}</span> : null}
          {media.status === 'failed' && <span className="text-sm text-red">{copy.media.failed}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        {file && (
          <a
            href={file.url}
            target="_blank"
            rel="noopener"
            className="flex h-[42px] flex-1 items-center justify-center rounded-control border border-input text-sm font-semibold hover:border-input-hover"
          >
            {copy.media.open}
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-[42px] items-center px-2.5 text-sm font-semibold text-red"
        >
          {copy.media.remove}
        </button>
      </div>
    </div>
  );
}

export function VideoSlot({
  video,
  hint,
  onRemove,
  onUpload,
}: {
  video: AdminVideo | null;
  hint: string;
  onRemove: () => void;
  onUpload?: (file: File) => void;
}) {
  if (!video)
    return (
      <DropZone
        title={copy.media.uploadVideo}
        hint={hint}
        accept="video/*"
        {...(onUpload ? { onUpload } : {})}
      />
    );
  return (
    <div className="flex gap-4">
      <div className="relative h-[220px] w-[124px] flex-none overflow-hidden rounded-[14px] bg-[#d9dbe5]">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {video.status !== 'ready' && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-xs font-semibold text-muted">
            {video.status === 'failed' ? (
              copy.media.failed
            ) : (
              <>
                <Spinner />
                {copy.media.processing}
              </>
            )}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-semibold break-all">{video.title}</span>
        {video.durationSec ? (
          <span className="text-sm text-muted">
            {Math.floor(video.durationSec / 60)}:{String(video.durationSec % 60).padStart(2, '0')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="mt-auto flex h-[38px] items-center text-sm font-semibold text-red"
        >
          {copy.media.remove}
        </button>
      </div>
    </div>
  );
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} ${copy.editor.kb}`
    : `${(bytes / 1048576).toFixed(1).replace('.', ',')} ${copy.editor.mb}`;
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}
