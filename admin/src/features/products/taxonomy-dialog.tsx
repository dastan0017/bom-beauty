import { nameKey } from '@bom/shared';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useDeleteBrand,
  useDeleteCategory,
  useMergeBrand,
  useMergeCategory,
  useRenameBrand,
  useRenameCategory,
} from '@/api/catalog';
import { Button, Field, inputClass } from '@/components/ui';
import { selectClass } from '@/components/ui/editor';
import { copy } from '@/content/copy';
import { errorText } from '@/lib/format';

export interface TaxonomyItem {
  id: string;
  name: string;
  /** All products of the category or brand. */
  count: number;
}

export type TaxonomyChange =
  { type: 'renamed'; name: string } | { type: 'merged'; into: TaxonomyItem } | { type: 'deleted' };

/**
 * Settings of one category or brand (owner request 2026-10-27; not in the design): rename, merge into another (its
 * products move there and it is deleted, which is how duplicates like «Dr. SGN» / «Dr.SGN» get fixed) and delete
 * when empty.
 */
export function TaxonomyDialog({
  kind,
  item,
  others,
  onClose,
  onChanged,
}: {
  kind: 'category' | 'brand';
  item: TaxonomyItem | null;
  others: TaxonomyItem[];
  onClose: () => void;
  onChanged: (item: TaxonomyItem, change: TaxonomyChange) => void;
}) {
  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,20,43,.4)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[70] flex max-h-[calc(100dvh-40px)] w-[calc(100%-40px)] max-w-[460px] -translate-1/2 flex-col gap-5 overflow-y-auto rounded-card bg-surface p-6 shadow-xl">
          {item && (
            <TaxonomyForm
              key={item.id}
              kind={kind}
              item={item}
              others={others}
              onDone={(change) => {
                onChanged(item, change);
                onClose();
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TaxonomyForm({
  kind,
  item,
  others,
  onDone,
}: {
  kind: 'category' | 'brand';
  item: TaxonomyItem;
  others: TaxonomyItem[];
  onDone: (change: TaxonomyChange) => void;
}) {
  const category = kind === 'category';
  const rename = useRenameCategory();
  const renameBrand = useRenameBrand();
  const merge = useMergeCategory();
  const mergeBrand = useMergeBrand();
  const remove = useDeleteCategory();
  const removeBrand = useDeleteBrand();
  const [name, setName] = useState(item.name);
  const [intoId, setIntoId] = useState('');
  const [asking, setAsking] = useState(false);
  const busy = [rename, renameBrand, merge, mergeBrand, remove, removeBrand].some((m) => m.isPending);
  const onError = (error: unknown) => toast.error(errorText(error));

  // Likely duplicates first («Dr. SGN» next to «Dr.SGN»), then by name.
  const key = nameKey(item.name);
  const targets = [...others].sort(
    (a, b) =>
      Number(nameKey(b.name) === key) - Number(nameKey(a.name) === key) || a.name.localeCompare(b.name, 'ru'),
  );
  const into = targets.find((target) => target.id === intoId) ?? null;
  const trimmed = name.trim();

  const saveName = () => {
    if (!trimmed || trimmed === item.name) return;
    const done = {
      onSuccess: () => {
        toast.success(copy.taxonomy.renamed);
        onDone({ type: 'renamed', name: trimmed });
      },
      onError,
    };
    if (category) rename.mutate({ id: item.id, name: trimmed }, done);
    else renameBrand.mutate({ id: item.id, name: trimmed }, done);
  };
  const mergeInto = () => {
    if (!into) return;
    const done = {
      onSuccess: () => {
        toast.success(copy.taxonomy.merged);
        onDone({ type: 'merged', into });
      },
      onError,
    };
    if (category) merge.mutate({ id: item.id, intoId: into.id }, done);
    else mergeBrand.mutate({ id: item.id, intoId: into.id }, done);
  };
  const deleteItem = () => {
    const done = {
      onSuccess: () => {
        toast.success(category ? copy.products.categoryDeleted : copy.taxonomy.deletedBrand);
        onDone({ type: 'deleted' });
      },
      onError,
    };
    if (category) remove.mutate(item.id, done);
    else removeBrand.mutate(item.id, done);
  };

  return (
    <>
      <div className="flex flex-col gap-1 pr-6">
        <Dialog.Title className="text-lg font-semibold [overflow-wrap:anywhere]">
          {category ? copy.taxonomy.categoryTitle(item.name) : copy.taxonomy.brandTitle(item.name)}
        </Dialog.Title>
        <Dialog.Description className="text-sm text-muted">
          {copy.taxonomy.count(item.count)}
        </Dialog.Description>
      </div>
      <Dialog.Close
        aria-label={copy.editor.cancel}
        className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink"
      >
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
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Dialog.Close>

      <form
        className="flex flex-col gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          saveName();
        }}
      >
        <Field label={copy.taxonomy.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className={inputClass}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          disabled={busy || !trimmed || trimmed === item.name}
          className="self-start"
        >
          {copy.taxonomy.rename}
        </Button>
      </form>

      {targets.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-5">
          <span className="text-[15px] font-semibold">{copy.taxonomy.merge}</span>
          <span className="text-[13px] leading-normal text-muted">
            {category ? copy.taxonomy.mergeHintCategory : copy.taxonomy.mergeHintBrand}
          </span>
          <Field label={copy.taxonomy.mergePick}>
            <select
              value={intoId}
              onChange={(e) => {
                setIntoId(e.target.value);
                setAsking(false);
              }}
              className={selectClass}
            >
              <option value="">{copy.taxonomy.mergePlaceholder}</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} · {copy.taxonomy.count(target.count)}
                </option>
              ))}
            </select>
          </Field>
          {asking && into ? (
            <div className="flex flex-col gap-2.5 rounded-control bg-bg p-3.5">
              <span className="text-sm leading-normal">
                {copy.taxonomy.mergeAsk(item.name, copy.taxonomy.count(item.count), into.name)}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button onClick={mergeInto} disabled={busy}>
                  {copy.taxonomy.mergeYes}
                </Button>
                <Button variant="outline" onClick={() => setAsking(false)} disabled={busy}>
                  {copy.editor.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={!into || busy}
              onClick={() => setAsking(true)}
              className="self-start"
            >
              {copy.taxonomy.mergeButton}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
        <Button variant="danger" disabled={busy || item.count > 0} onClick={deleteItem}>
          {copy.taxonomy.delete}
        </Button>
        <span className="text-[13px] leading-normal text-muted">
          {category ? copy.taxonomy.deleteHintCategory : copy.taxonomy.deleteHintBrand}
        </span>
      </div>
    </>
  );
}
