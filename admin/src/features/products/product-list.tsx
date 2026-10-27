import { formatKgs, type AdminProductRow, type ProductBulkAction } from '@bom/shared';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useBulkProducts, useDeleteProduct, usePatchProduct } from '@/api/catalog';
import { TableHead, TableRow } from '@/components/ui';
import { selectClass, Toggle } from '@/components/ui/editor';
import { MediaPreview } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { ConfirmDelete } from '@/features/products/product-editor';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

const COLUMNS = '36px 2.4fr 1fr .7fr .8fr .8fr 160px';

/** A click on the row opens the product, unless it landed on one of its own controls. */
const onControl = (event: MouseEvent) =>
  event.target instanceof Element && Boolean(event.target.closest('a, button, input, label, select'));

export interface Selection {
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Ticks every listed row, or unticks them all when they already are. */
  toggleAll: (ids: string[]) => void;
}

/**
 * The products list: a table from 640 px, cards on phones (a table there needs sideways scrolling to reach the price
 * and the switches). Rows open the product; the checkboxes feed the bulk bar.
 */
export function ProductList({
  rows,
  selection,
  footer,
}: {
  rows: AdminProductRow[];
  selection: Selection;
  footer: ReactNode;
}) {
  const navigate = useNavigate();
  const patch = usePatchProduct();
  const remove = useDeleteProduct();
  const ids = rows.map((row) => row.id);
  const all = ids.length > 0 && ids.every((id) => selection.has(id));
  const some = !all && ids.some((id) => selection.has(id));
  const open = (id: string) => (event: MouseEvent) => {
    if (!onControl(event)) void navigate(`/products/${id}`);
  };
  const setStock = (product: AdminProductRow, inStock: boolean) =>
    patch.mutate(
      { id: product.id, change: { inStock } },
      {
        onSuccess: () => toast.success(copy.saved),
        onError: (error) => toast.error(errorText(error)),
      },
    );

  return (
    <>
      <div className="hidden sm:block">
        <div role="table" className="overflow-x-auto" style={{ '--table-min': '850px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <Check
              label={copy.products.selectAll}
              checked={all}
              indeterminate={some}
              onChange={() => selection.toggleAll(ids)}
              disabled={!ids.length}
            />
            <span>{copy.products.columns.product}</span>
            <span>{copy.products.columns.category}</span>
            <span>{copy.products.columns.volume}</span>
            <span>{copy.products.columns.price}</span>
            <span>{copy.products.columns.stock}</span>
            <span />
          </TableHead>
          {rows.map((product) => (
            <TableRow
              key={product.id}
              onClick={open(product.id)}
              style={{ gridTemplateColumns: COLUMNS }}
              className={cn(
                'grid min-h-[68px] min-w-[850px] cursor-pointer items-center gap-3 border-b border-line-2 px-[22px] last:border-b-0 hover:bg-table-head',
                selection.has(product.id) && 'bg-table-head',
              )}
            >
              <Check
                label={copy.products.select(product.name)}
                checked={selection.has(product.id)}
                onChange={() => selection.toggle(product.id)}
              />
              <ProductName product={product} />
              <span className="text-sm text-muted">{product.category.name}</span>
              <span className="text-sm text-muted">{product.volume}</span>
              <span className="text-[15px] font-semibold whitespace-nowrap">
                {formatKgs(product.priceKgs)}
              </span>
              <Toggle
                checked={product.inStock}
                label={`${copy.products.columns.stock}: ${product.name}`}
                onChange={(inStock) => setStock(product, inStock)}
              />
              <span className="flex items-center gap-1.5">
                <Link
                  to={`/products/${product.id}`}
                  className="flex h-[38px] flex-1 items-center justify-center rounded-control border border-input bg-surface px-3.5 text-sm font-semibold hover:border-input-hover"
                >
                  {copy.products.edit}
                </Link>
                <ConfirmDelete
                  label={copy.product.delete}
                  title={copy.product.deleteNamed(product.name)}
                  text={
                    product.programCount > 0
                      ? copy.product.deleteInProgramCount(product.programCount)
                      : copy.product.deleteText
                  }
                  pending={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(product.id, {
                      onSuccess: () => toast.success(copy.product.deleted),
                      onError: (error) => toast.error(errorText(error)),
                    })
                  }
                  trigger={
                    <button
                      type="button"
                      aria-label={`${copy.product.delete}: ${product.name}`}
                      title={copy.product.delete}
                      className="flex size-[38px] flex-none items-center justify-center rounded-control border border-red-border bg-surface text-red hover:bg-red-hover"
                    >
                      <TrashIcon />
                    </button>
                  }
                />
              </span>
            </TableRow>
          ))}
          {footer}
        </div>
      </div>

      <div className="sm:hidden">
        <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2 text-[13px] text-muted">
          <Check
            label={copy.products.selectAll}
            checked={all}
            indeterminate={some}
            onChange={() => selection.toggleAll(ids)}
            disabled={!ids.length}
          />
          {copy.products.selectAll}
        </div>
        <ul>
          {rows.map((product) => (
            <li
              key={product.id}
              onClick={open(product.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 border-b border-line-2 py-2.5 pr-3.5 pl-3 last:border-b-0',
                selection.has(product.id) && 'bg-table-head',
              )}
            >
              <Check
                label={copy.products.select(product.name)}
                checked={selection.has(product.id)}
                onChange={() => selection.toggle(product.id)}
              />
              <ProductName
                product={product}
                detail={`${product.category.name} · ${formatKgs(product.priceKgs)}`}
              />
              <Toggle
                checked={product.inStock}
                label={`${copy.products.columns.stock}: ${product.name}`}
                onChange={(inStock) => setStock(product, inStock)}
              />
            </li>
          ))}
        </ul>
        {footer}
      </div>
    </>
  );
}

function ProductName({ product, detail }: { product: AdminProductRow; detail?: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <MediaPreview
        image={product.image}
        label={copy.media.photo}
        size={88}
        className="size-11 flex-none rounded-control"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] leading-snug font-semibold">
          <Link to={`/products/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
          {!product.published && (
            <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
              {copy.products.hidden}
            </span>
          )}
        </span>
        <span className="text-[13px] text-muted">{product.brand}</span>
        {detail && <span className="text-[13px] text-muted">{detail}</span>}
      </span>
    </span>
  );
}

/** A checkbox with a 36 px hit area. */
function Check({
  label,
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex size-9 flex-none cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        ref={(input) => {
          if (input) input.indeterminate = indeterminate;
        }}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="size-[18px] cursor-pointer accent-ink"
      />
    </label>
  );
}

/**
 * Actions on the ticked products (owner request 2026-10-27): stock, visibility, category and delete in one go. Sticks
 * to the bottom of the screen while the list scrolls.
 */
export function BulkBar({
  chosen,
  categories,
  onClear,
}: {
  chosen: AdminProductRow[];
  categories: { id: string; name: string }[];
  onClear: () => void;
}) {
  const bulk = useBulkProducts();
  const ids = chosen.map((product) => product.id);
  const inPrograms = chosen.filter((product) => product.programCount > 0).length;
  const run = (action: ProductBulkAction, categoryId?: string) =>
    bulk.mutate(
      { ids, action, ...(categoryId ? { categoryId } : {}) },
      {
        onSuccess: (result) => {
          toast.success(copy.products.bulkDone(result.count));
          if (action === 'delete') onClear();
        },
        onError: (error) => toast.error(errorText(error)),
      },
    );
  const button =
    'flex h-10 items-center rounded-control border border-white/25 px-3 text-sm font-semibold whitespace-nowrap hover:bg-white/10 disabled:opacity-50';

  return (
    <div
      role="region"
      aria-label={copy.products.bulkLabel}
      className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-card bg-ink px-4 py-3 text-white shadow-[0_18px_40px_-12px_rgba(20,20,43,.45)]"
    >
      <span className="mr-1 text-[15px] font-semibold whitespace-nowrap" aria-live="polite">
        {copy.products.chosen(chosen.length)}
      </span>
      <button type="button" onClick={onClear} className={cn(button, 'border-transparent text-white/80')}>
        {copy.products.clearSelection}
      </button>
      <span className="hidden h-6 w-px bg-white/20 sm:block" />
      {/* Wide screens: one button per action. */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <button type="button" disabled={bulk.isPending} onClick={() => run('inStock')} className={button}>
          {copy.products.bulk.inStock}
        </button>
        <button type="button" disabled={bulk.isPending} onClick={() => run('outOfStock')} className={button}>
          {copy.products.bulk.outOfStock}
        </button>
        <button type="button" disabled={bulk.isPending} onClick={() => run('show')} className={button}>
          {copy.products.bulk.show}
        </button>
        <button type="button" disabled={bulk.isPending} onClick={() => run('hide')} className={button}>
          {copy.products.bulk.hide}
        </button>
        <select
          aria-label={copy.products.bulk.moveTo}
          value=""
          disabled={bulk.isPending}
          onChange={(event) => event.target.value && run('category', event.target.value)}
          className={cn(selectClass, 'h-10 w-auto border-white/25 bg-ink text-white')}
        >
          <option value="">{copy.products.bulk.moveTo}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {/* Phones: the same actions in one native picker, so the bar stays two lines tall. */}
      <select
        aria-label={copy.products.bulk.pick}
        value=""
        disabled={bulk.isPending}
        onChange={(event) => {
          const [action, categoryId] = event.target.value.split(':') as [ProductBulkAction, string?];
          if (action) run(action, categoryId);
        }}
        className={cn(selectClass, 'h-10 min-w-0 flex-1 border-white/25 bg-ink text-white sm:hidden')}
      >
        <option value="">{copy.products.bulk.pick}</option>
        <option value="inStock">{copy.products.bulk.inStock}</option>
        <option value="outOfStock">{copy.products.bulk.outOfStock}</option>
        <option value="show">{copy.products.bulk.show}</option>
        <option value="hide">{copy.products.bulk.hide}</option>
        <optgroup label={copy.products.bulk.moveTo}>
          {categories.map((category) => (
            <option key={category.id} value={`category:${category.id}`}>
              {category.name}
            </option>
          ))}
        </optgroup>
      </select>
      <ConfirmDelete
        label={copy.products.bulk.delete}
        title={copy.products.bulk.deleteTitle(chosen.length)}
        text={copy.products.bulk.deleteText(inPrograms)}
        pending={bulk.isPending}
        onConfirm={() => run('delete')}
        trigger={
          <button
            type="button"
            disabled={bulk.isPending}
            className="ml-auto flex h-10 items-center gap-2 rounded-control bg-red px-3.5 text-sm font-semibold whitespace-nowrap text-white hover:brightness-110 disabled:opacity-50"
          >
            <TrashIcon />
            {copy.products.bulk.delete}
          </button>
        }
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}
