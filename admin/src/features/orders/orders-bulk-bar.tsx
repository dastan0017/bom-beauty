import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from '@bom/shared';
import { toast } from 'sonner';
import { useBulkOrders } from '@/api/orders';
import { selectClass } from '@/components/ui/editor';
import { copy } from '@/content/copy';
import { ConfirmDelete } from '@/features/products/product-editor';
import { TrashIcon } from '@/features/products/product-list';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Actions on the ticked orders (owner request 2026-11-14, D51): one status for all of them, or delete for the owner.
 * Sticks to the bottom of the screen while the list scrolls, like the products' bar.
 */
export function OrdersBulkBar({
  ids,
  canDelete,
  onClear,
}: {
  ids: string[];
  canDelete: boolean;
  onClear: () => void;
}) {
  const bulk = useBulkOrders();
  const setStatus = (status: OrderStatus) =>
    bulk.mutate(
      { ids, action: 'status', status },
      {
        onSuccess: (result) => {
          toast.success(copy.orders.bulkDone(result.count));
          onClear();
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
  const remove = () =>
    bulk.mutate(
      { ids, action: 'delete' },
      {
        onSuccess: (result) => {
          toast.success(copy.orders.bulkDone(result.count));
          onClear();
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
  const button =
    'flex h-10 items-center rounded-control border border-white/25 px-3 text-sm font-semibold whitespace-nowrap hover:bg-white/10 disabled:opacity-50';

  return (
    <div
      role="region"
      aria-label={copy.orders.bulkLabel}
      className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-card bg-ink px-4 py-3 text-white shadow-[0_18px_40px_-12px_rgba(20,20,43,.45)]"
    >
      <span className="mr-1 text-[15px] font-semibold whitespace-nowrap" aria-live="polite">
        {copy.orders.chosen(ids.length)}
      </span>
      <button type="button" onClick={onClear} className={cn(button, 'border-transparent text-white/80')}>
        {copy.orders.clearSelection}
      </button>
      <span className="hidden h-6 w-px bg-white/20 sm:block" />
      {/* Wide screens: one button per status. */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={bulk.isPending}
            onClick={() => setStatus(status)}
            className={button}
          >
            {copy.orders.bulkTo(ORDER_STATUS_LABELS[status])}
          </button>
        ))}
      </div>
      {/* Phones: the statuses in one native picker, so the bar stays two lines tall. */}
      <select
        aria-label={copy.orders.bulkStatus}
        value=""
        disabled={bulk.isPending}
        onChange={(event) => {
          const status = ORDER_STATUSES.find((value) => value === event.target.value);
          if (status) setStatus(status);
        }}
        className={cn(selectClass, 'h-10 min-w-0 flex-1 border-white/25 bg-ink text-white sm:hidden')}
      >
        <option value="">{copy.orders.bulkStatusPick}</option>
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      {canDelete && (
        <ConfirmDelete
          label={copy.orders.bulkDelete}
          title={copy.orders.bulkDeleteTitle(ids.length)}
          text={copy.orders.bulkDeleteText}
          pending={bulk.isPending}
          onConfirm={remove}
          trigger={
            <button
              type="button"
              disabled={bulk.isPending}
              className="ml-auto flex h-10 items-center gap-2 rounded-control bg-red px-3.5 text-sm font-semibold whitespace-nowrap text-white hover:brightness-110 disabled:opacity-50"
            >
              <TrashIcon />
              {copy.orders.bulkDelete}
            </button>
          }
        />
      )}
    </div>
  );
}
