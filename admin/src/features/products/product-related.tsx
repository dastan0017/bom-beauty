import { PRODUCT_RELATED_MAX, type AdminProductRow, type AdminProgramItem } from '@bom/shared';
import { Button } from '@/components/ui';
import { Panel } from '@/components/ui/editor';
import { copy } from '@/content/copy';
import { moveItem, ProgramItemList } from '@/features/programs/program-items';

const toItem = (row: AdminProductRow): AdminProgramItem => ({
  id: row.id,
  name: row.name,
  shortName: row.name,
  brand: row.published ? row.brand : `${row.brand} · ${copy.products.hidden}`,
  volume: row.volume,
  priceKgs: row.priceKgs,
  image: row.image,
});

/**
 * «С этим средством ещё берут» (owner request 2026-11-14, D49): the products shown on this product's page, in order.
 * While the list is empty the site picks them itself; the panel shows that pick and can take it over as a start.
 */
export function RelatedPanel({
  productId,
  ids,
  autoIds,
  products,
  error,
  onChange,
}: {
  productId: string | null;
  ids: string[];
  /** The site's own pick as last saved; empty for a new product. */
  autoIds: string[];
  products: AdminProductRow[] | undefined;
  error?: string | undefined;
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(products?.map((row) => [row.id, row]));
  const rows = (list: string[]) =>
    list.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  const items = rows(ids).map(toItem);
  const auto = rows(autoIds);

  return (
    <Panel
      title={copy.product.related}
      aside={<span className="text-[13px] text-muted">{copy.product.relatedAside(ids.length)}</span>}
      hint={copy.product.relatedHint}
    >
      {ids.length === 0 && (
        <div className="flex flex-col gap-2.5 rounded-xl bg-subtle px-4 py-3.5 text-sm leading-[1.45]">
          <p className="text-muted">
            {auto.length ? copy.product.relatedAuto : copy.product.relatedAutoEmpty}
          </p>
          {auto.length > 0 && (
            <>
              <ol className="flex list-decimal flex-col gap-0.5 pl-5">
                {auto.map((row) => (
                  <li key={row.id}>{row.name}</li>
                ))}
              </ol>
              <Button
                variant="outline"
                className="h-10 self-start px-3.5 text-sm"
                onClick={() => onChange(auto.map((row) => row.id).slice(0, PRODUCT_RELATED_MAX))}
              >
                {copy.product.relatedTakeAuto}
              </Button>
            </>
          )}
        </div>
      )}
      <ProgramItemList
        items={items}
        products={products?.filter((row) => row.id !== productId)}
        error={error}
        removeLabel={copy.product.relatedRemove}
        addLabel={copy.product.relatedAdd}
        pickEmpty={copy.product.relatedPickEmpty}
        full={ids.length >= PRODUCT_RELATED_MAX ? copy.product.relatedFull : undefined}
        onMove={(index, delta) =>
          onChange(
            moveItem(
              items.map((item) => item.id),
              index,
              delta,
            ),
          )
        }
        onRemove={(id) => onChange(ids.filter((item) => item !== id))}
        onAdd={(id) => onChange([...ids, id])}
      />
    </Panel>
  );
}
