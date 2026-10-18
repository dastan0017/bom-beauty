import type { AdminMedia, AdminVideo, ImageRef, MediaPurpose } from '@bom/shared';
import { useState, type DragEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { uploadMedia, uploadVideo, useVideoStatus } from '@/api/media';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Spinner } from './index';

// Media slots of the editors (design: image-slot, PDF and video cards): click or drop a file to upload.

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

/** Upload state shared by the slots. `run` reports failures as toasts and resolves to null. */
function useUploader() {
  const [progress, setProgress] = useState<number | null>(null);
  const run = async <T,>(task: (onProgress: (share: number) => void) => Promise<T>): Promise<T | null> => {
    setProgress(0);
    try {
      return await task((share) => setProgress(Math.round(share * 100)));
    } catch (error) {
      toast.error(errorText(error) === copy.errors.generic ? copy.media.uploadFailed : errorText(error));
      return null;
    } finally {
      setProgress(null);
    }
  };
  return { progress, uploading: progress !== null, run };
}

const firstFile = (event: DragEvent): File | undefined => event.dataTransfer.files[0];

function Busy({ progress }: { progress: number | null }) {
  return (
    <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85 text-[13px] font-semibold text-muted">
      <Spinner />
      {progress !== null && progress < 100 ? copy.media.uploading(progress) : copy.media.processing}
    </span>
  );
}

/** Square photo slot: preview, upload (click or drop), replace, remove. */
export function ImageSlot({
  media,
  label,
  purpose,
  onChange,
  onRemove,
  className,
}: {
  media: AdminMedia | null;
  label: string;
  purpose?: MediaPurpose;
  onChange?: (media: AdminMedia) => void;
  onRemove?: () => void;
  className?: string;
}) {
  const { progress, uploading, run } = useUploader();
  const [over, setOver] = useState(false);
  const interactive = Boolean(purpose && onChange);
  const upload = async (file: File | undefined) => {
    if (!file || !purpose || !onChange) return;
    const result = await run((onProgress) => uploadMedia(file, purpose, onProgress));
    if (!result) return;
    if (result.status === 'failed') toast.error(copy.media.failed);
    else onChange(result);
  };
  const processing = media && media.status !== 'ready';

  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-[14px] bg-subtle',
        over && 'ring-2 ring-ink',
        className,
      )}
      onDragOver={(event) => {
        if (!interactive) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (!interactive) return;
        event.preventDefault();
        setOver(false);
        void upload(firstFile(event));
      }}
    >
      <MediaPreview image={media?.image} label={label} className="absolute inset-0" />
      {(uploading || processing) && media?.status !== 'failed' && <Busy progress={progress} />}
      {media?.status === 'failed' && !uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/85 px-3 text-center text-[13px] font-semibold text-red">
          {copy.media.failed}
        </span>
      )}
      {interactive && !uploading && (
        <label
          className={cn(
            'absolute inset-0 flex cursor-pointer items-end justify-center p-2',
            media ? 'opacity-0 group-hover:opacity-100 focus-within:opacity-100' : '',
          )}
          title={copy.media.dropHint}
        >
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-sm">
            {media ? copy.media.replace : copy.media.uploadPhoto}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
      )}
      {media && onRemove && !uploading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={copy.media.remove}
          className="absolute top-2 right-2 z-20 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-red opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
        >
          {copy.media.remove}
        </button>
      )}
    </div>
  );
}

/** Dashed drop zone (design: "Загрузить PDF" / "Загрузить видео"; `large` is the reviews drop area). */
export function DropZone({
  icon,
  title,
  hint,
  onFiles,
  accept,
  multiple = false,
  busy,
  note,
  large = false,
}: {
  icon?: ReactNode;
  title: string;
  hint: string;
  onFiles?: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  busy?: ReactNode;
  note?: string;
  large?: boolean;
}) {
  const [over, setOver] = useState(false);
  const disabled = !onFiles || Boolean(busy);
  return (
    <label
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (disabled || !onFiles) return;
        event.preventDefault();
        setOver(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        'flex flex-col items-center gap-2 border-[1.5px] border-dashed bg-surface text-center focus-within:ring-2 focus-within:ring-blue',
        large ? 'rounded-card px-5 py-7' : 'rounded-[14px] px-4 py-7',
        disabled ? 'cursor-default' : 'cursor-pointer hover:border-dashed-hover',
        over && 'border-ink',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center bg-subtle',
          large ? 'size-12 rounded-[14px]' : 'size-11 rounded-full',
        )}
      >
        {busy ? <Spinner /> : (icon ?? <UploadIcon />)}
      </span>
      <span className={cn('font-semibold', large ? 'text-base' : 'text-[15px]')}>{busy ?? title}</span>
      {!busy && (
        <span className={cn('leading-normal text-muted', large ? 'text-sm' : 'text-[13px]')}>
          {onFiles ? hint : copy.media.later}
        </span>
      )}
      {note && !busy && <span className="mt-1.5 text-sm font-semibold text-green">{note}</span>}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length && onFiles) onFiles(files);
          event.target.value = '';
        }}
      />
    </label>
  );
}

export function PdfSlot({
  media,
  hint,
  purpose,
  onChange,
  onRemove,
}: {
  media: AdminMedia | null;
  hint: string;
  purpose: 'protocol' | 'catalog';
  onChange: (media: AdminMedia) => void;
  onRemove: () => void;
}) {
  const { progress, uploading, run } = useUploader();
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const result = await run((onProgress) => uploadMedia(file, purpose, onProgress));
    if (!result) return;
    if (result.status === 'failed') toast.error(copy.media.failed);
    else onChange(result);
  };
  if (!media || uploading) {
    return (
      <DropZone
        title={copy.media.uploadPdf}
        hint={hint}
        accept="application/pdf,.pdf"
        onFiles={(files) => void upload(files[0])}
        busy={
          uploading
            ? progress !== null && progress < 100
              ? copy.media.uploading(progress)
              : copy.media.processing
            : undefined
        }
      />
    );
  }
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
        <label className="flex h-[42px] flex-1 cursor-pointer items-center justify-center rounded-control border border-input text-sm font-semibold hover:border-input-hover">
          {copy.media.replace}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
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

/** Video slot: TUS upload to Bunny with progress, then polls Bunny's processing until ready. */
export function VideoSlot({
  video,
  hint,
  title,
  onChange,
  onRemove,
}: {
  video: AdminVideo | null;
  hint: string;
  title: string;
  onChange: (video: AdminVideo) => void;
  onRemove: () => void;
}) {
  const { progress, uploading, run } = useUploader();
  const current = useVideoStatus(video);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const result = await run((onProgress) => uploadVideo(file, title, onProgress));
    if (result) onChange(result);
  };

  if (!current || uploading) {
    return (
      <DropZone
        title={copy.media.uploadVideo}
        hint={hint}
        accept="video/mp4,video/quicktime,video/*"
        onFiles={(files) => void upload(files[0])}
        busy={uploading ? copy.media.uploading(progress ?? 0) : undefined}
      />
    );
  }
  return (
    <div className="flex gap-4">
      <div className="relative h-[220px] w-[124px] flex-none overflow-hidden rounded-[14px] bg-[#d9dbe5]">
        {current.thumbnailUrl && (
          // The admin sends no referrer (Caddy: Referrer-Policy no-referrer), and Bunny refuses thumbnail requests
          // without one, so this image sends just the origin.
          <img
            src={current.thumbnailUrl}
            alt=""
            referrerPolicy="strict-origin"
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {current.status !== 'ready' && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 px-2 text-center text-xs font-semibold text-muted">
            {current.status === 'failed' ? copy.media.failed : <Spinner />}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-semibold break-all">{current.title}</span>
        {current.durationSec ? (
          <span className="text-sm text-muted">
            {Math.floor(current.durationSec / 60)}:{String(current.durationSec % 60).padStart(2, '0')}
          </span>
        ) : null}
        {current.status !== 'ready' && current.status !== 'failed' && (
          <span className="text-[13px] leading-normal text-muted">{copy.media.videoProcessing}</span>
        )}
        <label className="mt-auto flex h-[42px] cursor-pointer items-center justify-center rounded-control border border-input text-sm font-semibold hover:border-input-hover">
          {copy.media.replace}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/*"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-[38px] items-center text-sm font-semibold text-red"
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
