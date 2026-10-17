import type { AdminReview } from '@bom/shared';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useReviewActions, useReviews } from '@/api/catalog';
import { PageHeader, Spinner } from '@/components/ui';
import { DropZone, MediaPreview } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Отзывы (design: isReviews). Upload arrives with the media pipeline (M5). */
export function ReviewsPage() {
  const reviews = useReviews();
  const actions = useReviewActions();
  const list = reviews.data ?? [];
  const shown = list.filter((r) => !r.isHidden).length;
  const hasDemo = list.some((r) => r.isDemo && !r.isHidden);

  const notify = {
    onError: (error: unknown) => toast.error(errorText(error)),
    onSuccess: () => toast.success(copy.saved),
  };
  const moveTo = (index: number, delta: number) => {
    const ids = list.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const [id] = ids.splice(index, 1);
    if (id) ids.splice(target, 0, id);
    actions.reorder.mutate(ids, notify);
  };

  return (
    <>
      <PageHeader title={copy.reviews.title} lead={copy.reviews.lead}>
        <a
          href={env.VITE_SITE_URL}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 items-center rounded-xl border border-input bg-surface px-4 text-[15px] font-semibold whitespace-nowrap"
        >
          {copy.openSite}
        </a>
      </PageHeader>

      {hasDemo && (
        <div className="mt-[22px] flex items-center gap-3 rounded-[14px] border border-amber-border bg-amber-soft px-[18px] py-3.5 text-[15px] leading-[1.45] text-amber-ink">
          {copy.reviews.demo}
        </div>
      )}
      <div className="mt-4">
        <DropZone title={copy.reviews.drop} hint={copy.reviews.dropHint} accept="image/*" />
      </div>

      <div className="mt-[26px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h2 className="text-lg font-semibold">{copy.reviews.order}</h2>
        {list.length > 0 && (
          <span className="text-sm text-muted">{copy.reviews.summary(shown, list.length - shown)}</span>
        )}
      </div>
      {reviews.isPending && (
        <div className="mt-4 text-muted">
          <Spinner />
        </div>
      )}
      {list.length > 0 ? (
        <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5">
          {list.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              n={index + 1}
              busy={actions.reorder.isPending || actions.toggle.isPending || actions.remove.isPending}
              onLeft={() => moveTo(index, -1)}
              onRight={() => moveTo(index, 1)}
              onToggle={() => actions.toggle.mutate({ id: review.id, isHidden: !review.isHidden }, notify)}
              onDelete={() =>
                actions.remove.mutate(review.id, {
                  onSuccess: () => toast.success(copy.reviews.deleted),
                  onError: (error) => toast.error(errorText(error)),
                })
              }
            />
          ))}
        </div>
      ) : (
        reviews.data && (
          <div className="mt-3.5 rounded-card border border-line bg-surface p-7 text-center text-[15px] text-muted">
            {copy.reviews.empty}
          </div>
        )
      )}
    </>
  );
}

function ReviewCard({
  review,
  n,
  busy,
  onLeft,
  onRight,
  onToggle,
  onDelete,
}: {
  review: AdminReview;
  n: number;
  busy: boolean;
  onLeft: () => void;
  onRight: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="relative aspect-[9/13] overflow-hidden bg-subtle">
        <MediaPreview
          image={review.media.image}
          label={copy.media.photo}
          size={336}
          className={cn('absolute inset-0 [&_img]:object-top', review.isHidden && 'opacity-45')}
        />
        <span className="absolute top-2.5 left-2.5 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[rgba(20,20,43,.78)] px-1.5 text-[13px] font-semibold text-white">
          {n}
        </span>
        {review.isDemo && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-[#fff4d6] px-2 py-1 text-xs font-semibold text-[#8a5a00]">
            {copy.reviews.example}
          </span>
        )}
        {review.isHidden && (
          <span className="absolute inset-x-2.5 bottom-2.5 rounded-control bg-[rgba(20,20,43,.78)] px-2 py-1.5 text-center text-xs font-semibold text-white">
            {copy.reviews.hiddenBadge}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-0.5 border-t border-line-2 p-1.5">
        <CardButton label={copy.reviews.left} onClick={onLeft} disabled={busy}>
          <path d="M15 6l-6 6 6 6" />
        </CardButton>
        <CardButton label={copy.reviews.right} onClick={onRight} disabled={busy}>
          <path d="M9 6l6 6-6 6" />
        </CardButton>
        <CardButton label={copy.reviews.toggle} onClick={onToggle} disabled={busy}>
          {review.isHidden ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-3.2 4.2M6.4 6.5A12.3 12.3 0 0 0 2 12c1 2.5 5 7 10 7a9.7 9.7 0 0 0 4.5-1.1" />
            </>
          ) : (
            <>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </CardButton>
        <CardButton label={copy.reviews.delete} onClick={onDelete} disabled={busy} danger>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </CardButton>
      </div>
    </div>
  );
}

function CardButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-9 items-center justify-center rounded-control hover:bg-bg disabled:opacity-50',
        danger ? 'text-[#b42318]' : 'text-ink',
      )}
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
