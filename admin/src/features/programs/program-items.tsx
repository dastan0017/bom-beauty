import { formatKgs, matchesSearch, type AdminProductRow, type AdminProgramItem } from '@bom/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, CloseIcon, inputClass } from '@/components/ui';
import { FieldError } from '@/components/ui/editor';
import { MediaPreview } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { PlusIcon } from '@/features/products/products-page';
import { cn } from '@/lib/utils';

export const moveItem = <T,>(list: T[], index: number, delta: number): T[] => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
};

/**
 * An ordered product list with the catalog picker: the main variant's products and each variant's, and a product's
 * «С этим средством ещё берут». The order here is the order on the site.
 */
export function ProgramItemList({
  items,
  products,
  error,
  removeLabel,
  onMove,
  onRemove,
  onAdd,
  extra,
  addLabel = copy.program.addItem,
  pickEmpty = copy.program.pickEmpty,
  full,
}: {
  items: AdminProgramItem[];
  products: AdminProductRow[] | undefined;
  error?: string | undefined;
  removeLabel: string;
  onMove: (index: number, delta: number) => void;
  onRemove: (id: string) => void;
  onAdd: (id: string) => void;
  /** Shown beside «Добавить средство» (a variant offers to copy the main variant's products). */
  extra?: ReactNode;
  addLabel?: string;
  /** The picker's text once every product is in the list. */
  pickEmpty?: string;
  /** Set when the list is full: shown in place of the add button. */
  full?: string | undefined;
}) {
  const [picker, setPicker] = useState(false);
  const chosen = new Set(items.map((item) => item.id));
  return (
    <>
      {items.length > 0 && (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 border-b border-line-2 py-3 sm:gap-3.5">
              <div className="flex flex-none flex-col">
                <ArrowButton label={copy.editor.up} dir="up" onClick={() => onMove(index, -1)} />
                <ArrowButton label={copy.editor.down} dir="down" onClick={() => onMove(index, 1)} />
              </div>
              <MediaPreview
                image={item.image}
                label={copy.media.photo}
                size={96}
                className="size-12 flex-none rounded-control"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{item.name}</span>
                <span className="text-[13px] text-muted">
                  {item.brand} · {item.volume}
                  {/* Phones: the price joins this line, so the name keeps its width. */}
                  <span className="sm:hidden"> · {formatKgs(item.priceKgs)}</span>
                </span>
              </div>
              <span className="hidden w-[90px] flex-none truncate text-right text-[15px] text-muted sm:block">
                {formatKgs(item.priceKgs)}
              </span>
              <IconButton label={removeLabel} onClick={() => onRemove(item.id)}>
                <CloseIcon width={16} height={16} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <FieldError error={error} />
      {full ? (
        <p className="text-sm text-muted">{full}</p>
      ) : picker ? (
        <ProductPicker
          products={products}
          chosen={chosen}
          pickEmpty={pickEmpty}
          onAdd={onAdd}
          onClose={() => setPicker(false)}
        />
      ) : (
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed text-[15px] font-semibold hover:border-dashed-hover"
          >
            <PlusIcon />
            {addLabel}
          </button>
          {extra}
        </div>
      )}
    </>
  );
}

/**
 * «Выберите средство из каталога» with a search over name, brand and category (owner request 2026-11-10: finding a
 * product by scrolling took too long). After «Добавить» the search box keeps its text and the focus, so several
 * products go in quickly.
 */
function ProductPicker({
  products,
  chosen,
  pickEmpty,
  onAdd,
  onClose,
}: {
  products: AdminProductRow[] | undefined;
  chosen: ReadonlySet<string>;
  pickEmpty: string;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  // The picker opens for one thing: finding a product.
  useEffect(() => search.current?.focus(), []);
  const available = products?.filter((p) => !chosen.has(p.id)) ?? [];
  const found = available.filter((p) => matchesSearch(query, [p.name, p.brand, p.category.name]));
  return (
    <div className="flex flex-col rounded-xl border border-input">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-3.5 py-3">
        <span className="text-[15px] font-semibold">{copy.program.pickTitle}</span>
        <button
          type="button"
          onClick={onClose}
          className="h-8 text-sm font-semibold text-muted hover:text-ink"
        >
          {copy.program.close}
        </button>
      </div>
      <div className="border-b border-line-2 p-2.5">
        <input
          ref={search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              setQuery('');
            }
          }}
          placeholder={copy.program.pickSearch}
          aria-label={copy.program.pickSearch}
          className={inputClass}
        />
      </div>
      <div className="flex max-h-[320px] flex-col overflow-y-auto" aria-live="polite">
        {found.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 border-b border-line-3 px-3.5 py-2.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="text-[15px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-muted">
                {p.brand} · {p.category.name}
                <span className="sm:hidden"> · {formatKgs(p.priceKgs)}</span>
              </span>
            </div>
            <span className="hidden truncate text-sm text-muted sm:block">{formatKgs(p.priceKgs)}</span>
            <Button
              variant="outline"
              className="h-[34px] flex-none px-3 text-sm"
              onClick={() => {
                onAdd(p.id);
                search.current?.focus();
              }}
            >
              {copy.editor.add}
            </Button>
          </div>
        ))}
        {products && found.length === 0 && (
          <span className="px-3.5 py-5 text-sm text-muted">
            {available.length ? copy.program.pickNothing : pickEmpty}
          </span>
        )}
        {!products && <span className="px-3.5 py-5 text-sm text-muted">{copy.loading}</span>}
      </div>
    </div>
  );
}

/** Price input with «По отдельности» and «Экономия клиента» under it. */
export function ProgramPriceField({
  label,
  priceKgs,
  sumKgs,
  error,
  onChange,
}: {
  label: string;
  priceKgs: number;
  sumKgs: number;
  error?: string | undefined;
  onChange: (priceKgs: number) => void;
}) {
  const saving =
    sumKgs > priceKgs && priceKgs > 0
      ? `${formatKgs(sumKgs - priceKgs)} · ${Math.round(((sumKgs - priceKgs) / sumKgs) * 100)}%`
      : '—';
  return (
    <>
      <div className="relative">
        <input
          value={priceKgs ? String(priceKgs) : ''}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 8)) || 0)}
          inputMode="numeric"
          aria-label={label}
          className={cn(inputClass, 'h-[50px] pr-[54px] text-xl font-semibold')}
        />
        <span className="absolute top-[15px] right-4 text-[15px] text-muted">{copy.editor.som}</span>
      </div>
      <FieldError error={error} />
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">{copy.program.separately}</span>
          <span>{formatKgs(sumKgs)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{copy.program.saving}</span>
          <span className="font-semibold text-green">{saving}</span>
        </div>
      </div>
    </>
  );
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 flex-none items-center justify-center rounded-control border border-line text-muted hover:border-[#c5c9da]"
    >
      {children}
    </button>
  );
}

function ArrowButton({ label, dir, onClick }: { label: string; dir: 'up' | 'down'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-[22px] w-7 items-center justify-center text-muted hover:text-ink"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
      </svg>
    </button>
  );
}
