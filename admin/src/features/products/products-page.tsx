import { formatKgs } from '@bom/shared';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  usePatchProduct,
  useProducts,
} from '@/api/catalog';
import { Button, Card, PageHeader, TableHead, TableMessage, TableRow } from '@/components/ui';
import { Toggle } from '@/components/ui/editor';
import { MediaPreview } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { errorText } from '@/lib/format';
import { cn } from '@/lib/utils';

const COLUMNS = '2.4fr 1fr .7fr .8fr .8fr 110px';

/** Товары (design: isProducts): category chips, add category, table with the stock switch. */
export function ProductsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? undefined;
  const categories = useCategories();
  const products = useProducts(category ? { category } : {});
  const allProducts = useProducts({});
  const patch = usePatchProduct();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const total = allProducts.data?.length ?? 0;
  const catCount = categories.data?.length ?? 0;
  const setCategory = (id?: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('category', id);
      else next.delete('category');
      return next;
    });

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return setAdding(false);
    createCategory.mutate(name, {
      onSuccess: () => {
        toast.success(copy.products.categoryAdded);
        setNewName('');
        setAdding(false);
      },
      onError: (error) => toast.error(errorText(error)),
    });
  };

  const chips = [
    { id: undefined, name: copy.products.all, count: total },
    ...(categories.data ?? []).map((c) => ({ id: c.id, name: c.name, count: c.count })),
  ];

  return (
    <>
      <PageHeader
        title={copy.products.title}
        lead={allProducts.data && categories.data ? copy.products.count(total, catCount) : undefined}
      >
        <Button
          onClick={() =>
            void navigate({ pathname: '/products/new', search: category ? `?category=${category}` : '' })
          }
        >
          <PlusIcon />
          {copy.products.add}
        </Button>
      </PageHeader>

      <Card className="mt-6 flex flex-col gap-3.5 px-5 py-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold">{copy.products.categories}</span>
          <span className="text-[13px] text-muted">{copy.products.categoriesHint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => {
            const on = chip.id === category;
            return (
              <span
                key={chip.id ?? 'all'}
                className={cn(
                  'inline-flex h-[38px] items-center gap-1 rounded-full border pr-1.5 pl-3.5 text-sm font-semibold',
                  on ? 'border-ink bg-ink text-white' : 'border-input bg-surface text-ink',
                )}
              >
                <button
                  type="button"
                  onClick={() => setCategory(chip.id)}
                  aria-pressed={on}
                  className="flex h-full items-center gap-1.5 pr-2"
                >
                  {chip.name}
                  <span className="font-normal opacity-70">{chip.count}</span>
                </button>
                {chip.id && chip.count === 0 && (
                  <button
                    type="button"
                    aria-label={`${copy.products.deleteCategory} ${chip.name}`}
                    onClick={() =>
                      deleteCategory.mutate(chip.id ?? '', {
                        onSuccess: () => {
                          toast.success(copy.products.categoryDeleted);
                          if (on) setCategory(undefined);
                        },
                        onError: (error) => toast.error(errorText(error)),
                      })
                    }
                    className="-ml-1 flex size-[26px] items-center justify-center rounded-full hover:bg-black/10"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </span>
            );
          })}
          {adding ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key === 'Enter') addCategory();
                  if (event.key === 'Escape') setAdding(false);
                }}
                placeholder={copy.products.categoryPlaceholder}
                aria-label={copy.products.categoryPlaceholder}
                className="h-[38px] w-[180px] rounded-full border border-ink bg-surface px-3 text-sm outline-none"
              />
              <button
                type="button"
                onClick={addCategory}
                disabled={createCategory.isPending}
                className="h-[38px] rounded-full bg-ink px-3.5 text-sm font-semibold text-white"
              >
                {copy.editor.add}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="h-[38px] px-2.5 text-sm font-semibold text-muted"
              >
                {copy.editor.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-dashed px-3.5 text-sm font-semibold"
            >
              <PlusIcon />
              {copy.products.addCategory}
            </button>
          )}
        </div>
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <div role="table" style={{ '--table-min': '760px' } as CSSProperties}>
          <TableHead columns={COLUMNS}>
            <span>{copy.products.columns.product}</span>
            <span>{copy.products.columns.category}</span>
            <span>{copy.products.columns.volume}</span>
            <span>{copy.products.columns.price}</span>
            <span>{copy.products.columns.stock}</span>
            <span />
          </TableHead>
          {products.data?.map((product) => (
            <TableRow
              key={product.id}
              style={{ gridTemplateColumns: COLUMNS }}
              className="grid min-h-[68px] min-w-[760px] items-center gap-3 border-b border-line-2 px-[22px] last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <MediaPreview
                  image={product.image}
                  label={copy.media.photo}
                  size={88}
                  className="size-11 flex-none rounded-control"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
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
                </span>
              </span>
              <span className="text-sm text-muted">{product.category.name}</span>
              <span className="text-sm text-muted">{product.volume}</span>
              <span className="text-[15px] font-semibold whitespace-nowrap">
                {formatKgs(product.priceKgs)}
              </span>
              <Toggle
                checked={product.inStock}
                label={`${copy.products.columns.stock}: ${product.name}`}
                onChange={(inStock) =>
                  patch.mutate(
                    { id: product.id, change: { inStock } },
                    {
                      onSuccess: () => toast.success(copy.saved),
                      onError: (error) => toast.error(errorText(error)),
                    },
                  )
                }
              />
              <Link
                to={`/products/${product.id}`}
                className="flex h-[38px] items-center justify-center rounded-control border border-input bg-surface px-3.5 text-sm font-semibold hover:border-input-hover"
              >
                {copy.products.edit}
              </Link>
            </TableRow>
          ))}
          {products.isPending && <TableMessage>{copy.loading}</TableMessage>}
          {products.isError && !products.data && <TableMessage>{copy.errors.load}</TableMessage>}
          {products.data?.length === 0 && <TableMessage>{copy.products.empty}</TableMessage>}
        </div>
      </Card>
    </>
  );
}

export function PlusIcon() {
  return (
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
  );
}
