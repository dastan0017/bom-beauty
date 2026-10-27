import { PRODUCT_IMAGES_MAX, type AdminMedia } from '@bom/shared';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { uploadMedia } from '@/api/media';
import { Spinner } from '@/components/ui';
import { ImageSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif';
const isImage = (file: File) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);

type Update = (change: (list: AdminMedia[]) => AdminMedia[]) => void;

/**
 * Product photos. The design has a main photo and two more; since 2026-10 a product takes up to PRODUCT_IMAGES_MAX:
 * the main photo on top, the others in a grid with arrows to reorder, and a tile that uploads several files at once.
 */
export function ProductPhotos({ images, onChange }: { images: AdminMedia[]; onChange: Update }) {
  const [queue, setQueue] = useState<{ n: number; total: number } | null>(null);
  const main = images[0] ?? null;
  const rest = images.slice(1);
  const room = PRODUCT_IMAGES_MAX - images.length;

  // By id rather than position: the list may be reordered while a replacement uploads.
  const put = (previous: AdminMedia | null, media: AdminMedia) =>
    onChange((list) =>
      previous
        ? list.map((item) => (item.id === previous.id ? media : item))
        : list.length < PRODUCT_IMAGES_MAX
          ? [...list, media]
          : list,
    );
  const remove = (id: string) => onChange((list) => list.filter((item) => item.id !== id));
  const move = (id: string, delta: number) =>
    onChange((list) => {
      const from = list.findIndex((item) => item.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });

  const addFiles = async (files: File[]) => {
    if (queue) return;
    const photos = files.filter(isImage);
    const batch = photos.slice(0, Math.max(0, room));
    if (photos.length > batch.length) toast.error(copy.media.tooMany);
    let failed = 0;
    for (const [index, file] of batch.entries()) {
      setQueue({ n: index + 1, total: batch.length });
      try {
        const media = await uploadMedia(file, 'product');
        if (media.status === 'ready') put(null, media);
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setQueue(null);
    if (failed) toast.error(copy.media.failedOf(failed));
  };

  return (
    <>
      <ImageSlot
        media={main}
        label={copy.media.mainPhoto}
        purpose="product"
        onChange={(media) => put(main, media)}
        {...(main ? { onRemove: () => remove(main.id) } : {})}
      />
      <div className="grid grid-cols-3 gap-2.5">
        {rest.map((media, i) => {
          const n = i + 2;
          return (
            <div key={media.id} className="flex min-w-0 flex-col gap-1">
              <ImageSlot
                media={media}
                label={copy.media.photoN(n)}
                purpose="product"
                onChange={(next) => put(media, next)}
                onRemove={() => remove(media.id)}
                className="rounded-xl"
              />
              <div role="group" aria-label={copy.media.photoActions(n)} className="flex justify-center gap-1">
                <MoveButton
                  label={n === 2 ? copy.media.makeMain : copy.media.moveLeft}
                  onClick={() => move(media.id, -1)}
                >
                  <path d="M15 6l-6 6 6 6" />
                </MoveButton>
                <MoveButton
                  label={copy.media.moveRight}
                  disabled={n === images.length}
                  onClick={() => move(media.id, 1)}
                >
                  <path d="M9 6l6 6-6 6" />
                </MoveButton>
              </div>
            </div>
          );
        })}
        {room > 0 && (
          <AddTile queue={queue} wide={rest.length === 0} onFiles={(files) => void addFiles(files)} />
        )}
      </div>
      <p className="text-[13px] leading-normal text-muted">{copy.media.photosHint}</p>
    </>
  );
}

/** Dashed tile: click or drop one or more photos. A full-width row until there is a second photo. */
function AddTile({
  queue,
  wide,
  onFiles,
}: {
  queue: { n: number; total: number } | null;
  wide: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(event) => {
        if (queue) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        if (queue) return;
        event.preventDefault();
        setOver(false);
        onFiles([...event.dataTransfer.files]);
      }}
      className={cn(
        'flex items-center justify-center rounded-xl border-[1.5px] border-dashed bg-surface px-2 text-center focus-within:ring-2 focus-within:ring-blue',
        wide ? 'col-span-3 min-h-[72px] gap-3' : 'aspect-square flex-col gap-1.5',
        queue ? 'cursor-default' : 'cursor-pointer hover:border-dashed-hover',
        over && 'border-ink',
      )}
    >
      {queue ? (
        <>
          <Spinner />
          <span className="text-xs leading-snug font-semibold text-muted">
            {copy.media.uploadingOf(queue.n, queue.total)}
          </span>
        </>
      ) : (
        <>
          <span className="flex size-8 items-center justify-center rounded-full bg-subtle">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className={cn('flex flex-col', wide ? 'items-start text-left' : 'items-center')}>
            <span className="text-[13px] leading-snug font-semibold">{copy.media.addPhotos}</span>
            {wide && <span className="text-xs leading-snug text-muted">{copy.media.addPhotosHint}</span>}
          </span>
        </>
      )}
      <input
        type="file"
        accept={ACCEPT}
        multiple
        disabled={Boolean(queue)}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

function MoveButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded-control text-ink hover:bg-bg disabled:opacity-35"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
