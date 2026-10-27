import { BADGES, type AdminMedia, type AdminProduct, type AdminVideo, type ProductInput } from '@bom/shared';
import { AlertDialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  useBrands,
  useCategories,
  useDeleteProduct,
  useProduct,
  useProducts,
  useSaveProduct,
} from '@/api/catalog';
import { Button, Field, inputClass, Spinner } from '@/components/ui';
import {
  EditorHeader,
  FieldError,
  Panel,
  selectClass,
  textareaClass,
  Toggle,
  useUnsavedGuard,
} from '@/components/ui/editor';
import { VideoSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { errorText, fieldErrors } from '@/lib/format';
import { ProductPhotos } from './product-photos';

const EMPTY: ProductInput = {
  name: '',
  slug: '',
  shortName: null,
  brandName: '',
  brandDescription: null,
  categoryId: '',
  volume: '',
  priceKgs: 0,
  purpose: '',
  description: '',
  howToUse: '',
  inci: null,
  badge: null,
  inStock: true,
  published: true,
  bestseller: false,
  seoulChoice: false,
  isNew: false,
  imageIds: [],
  videoId: null,
  seoTitle: null,
  seoDescription: null,
};

function toInput(product: AdminProduct): ProductInput {
  return {
    name: product.name,
    slug: product.slug,
    shortName: product.shortName,
    brandName: product.brandName,
    // Null until edited: «О бренде» belongs to the brand, and a save sends it only when it changed.
    brandDescription: null,
    categoryId: product.categoryId,
    volume: product.volume,
    priceKgs: product.priceKgs,
    purpose: product.purpose,
    description: product.description,
    howToUse: product.howToUse,
    inci: product.inci,
    badge: product.badge,
    inStock: product.inStock,
    published: product.published,
    bestseller: product.bestseller,
    seoulChoice: product.seoulChoice,
    isNew: product.isNew,
    imageIds: product.images.map((image) => image.id),
    videoId: product.video?.id ?? null,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
  };
}

/** Route wrapper: loads the product, then mounts the form with its data. */
export function ProductEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const product = useProduct(isNew ? null : id);
  const [params] = useSearchParams();
  if (!isNew && !product.data) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {product.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  const initial = product.data
    ? toInput(product.data)
    : { ...EMPTY, categoryId: params.get('category') ?? '', brandName: params.get('brand') ?? '' };
  return <ProductForm key={product.data?.id ?? 'new'} product={product.data ?? null} initial={initial} />;
}

function ProductForm({ product, initial }: { product: AdminProduct | null; initial: ProductInput }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const allProducts = useProducts({});
  const save = useSaveProduct(product?.id ?? null);
  const remove = useDeleteProduct();
  const [baseline, setBaseline] = useState<ProductInput>(initial);
  const [form, setForm] = useState<ProductInput>(initial);
  const [images, setImages] = useState<AdminMedia[]>(product?.images ?? []);
  const [video, setVideo] = useState<AdminVideo | null>(product?.video ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A just-created item arrives here with { saved: true } after the redirect to its own URL.
  const location = useLocation();
  const [saved, setSaved] = useState(Boolean((location.state as { saved?: boolean } | null)?.saved));
  const brands = useBrands(form.brandName.trim());
  // «О бренде» as stored for the brand in the form: the saved product's brand first, other brands from the
  // autocomplete (a new brand has none yet).
  const [savedBrand, setSavedBrand] = useState({
    name: product?.brandName ?? '',
    text: product?.brandDescription ?? '',
  });
  const brandKey = form.brandName.trim().toLowerCase();
  const brandText =
    brandKey === savedBrand.name.toLowerCase()
      ? savedBrand.text
      : (brands.data?.find((brand) => brand.name.toLowerCase() === brandKey)?.description ?? '');
  const editedBrandText =
    form.brandDescription !== null && form.brandDescription.trim() !== brandText.trim()
      ? form.brandDescription
      : null;
  // The photo list is its own state (uploads append to it one by one); the form takes its ids.
  const input: ProductInput = {
    ...form,
    brandDescription: editedBrandText,
    imageIds: images.map((image) => image.id),
  };
  const dirty = JSON.stringify(input) !== JSON.stringify(baseline);
  useUnsavedGuard(dirty && !save.isPending);

  const categoryId = form.categoryId || categories.data?.[0]?.id || '';
  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
    setSaved(false);
  };
  const changePhotos = (change: (list: AdminMedia[]) => AdminMedia[]) => {
    setImages(change);
    setErrors(({ imageIds: _removed, ...rest }) => rest);
    setSaved(false);
  };

  const submit = () =>
    save.mutate(
      { ...input, categoryId },
      {
        onSuccess: (result) => {
          toast.success(copy.saved);
          const next = toInput(result);
          setBaseline(next);
          setForm(next);
          setImages(result.images);
          setVideo(result.video);
          setSavedBrand({ name: result.brandName, text: result.brandDescription });
          setSaved(true);
          setErrors({});
          // After the baseline update has rendered, so the unsaved-changes guard lets the redirect through.
          if (!product)
            setTimeout(
              () => void navigate(`/products/${result.id}`, { replace: true, state: { saved: true } }),
              0,
            );
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          toast.error(errorText(error));
        },
      },
    );

  const badged =
    (allProducts.data ?? []).filter((p) => p.id !== product?.id && p.badge).length + (form.badge ? 1 : 0);
  const title = form.name.trim() || copy.product.new;

  return (
    <>
      <EditorHeader
        parent={{ to: '/products', label: copy.products.title }}
        title={title}
        status={
          product
            ? { label: form.published ? copy.editor.onSite : copy.editor.draft, on: form.published }
            : undefined
        }
        saved={saved}
        saving={save.isPending}
        dirty={dirty}
        onSave={submit}
        extra={
          product && (
            <a
              href={`${env.VITE_SITE_URL}/catalog/${product.slug}`}
              target="_blank"
              rel="noopener"
              className="text-sm font-semibold text-muted hover:text-ink"
            >
              {copy.editor.openOnSite}
            </a>
          )
        }
      />

      <div className="mt-[26px] flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Panel>
            <Text label={copy.product.name} error={errors.name}>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={copy.product.namePlaceholder}
                className={inputClass}
              />
            </Text>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Text label={copy.product.brand} error={errors.brandName}>
                <input
                  value={form.brandName}
                  onChange={(e) => set('brandName', e.target.value)}
                  list="brand-options"
                  autoComplete="off"
                  className={inputClass}
                />
                <datalist id="brand-options">
                  {brands.data?.map((brand) => (
                    <option key={brand.id} value={brand.name} />
                  ))}
                </datalist>
              </Text>
              <Text label={copy.product.category} error={errors.categoryId}>
                <select
                  value={categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}
                  className={selectClass}
                >
                  {categories.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Text>
              <Text label={copy.product.volume} error={errors.volume}>
                <input
                  value={form.volume}
                  onChange={(e) => set('volume', e.target.value)}
                  placeholder={copy.product.volumePlaceholder}
                  className={inputClass}
                />
              </Text>
              <Text label={copy.product.price} error={errors.priceKgs}>
                <input
                  value={form.priceKgs ? String(form.priceKgs) : ''}
                  onChange={(e) =>
                    set('priceKgs', Number(e.target.value.replace(/\D/g, '').slice(0, 8)) || 0)
                  }
                  inputMode="numeric"
                  className={inputClass}
                />
              </Text>
            </div>
            <Text label={copy.product.purpose} error={errors.purpose}>
              <input
                value={form.purpose}
                onChange={(e) => set('purpose', e.target.value)}
                placeholder={copy.product.purposePlaceholder}
                className={inputClass}
              />
            </Text>
            <Text
              label={copy.product.aboutBrand}
              hint={
                form.brandName.trim()
                  ? copy.product.aboutBrandHint(form.brandName.trim())
                  : copy.product.aboutBrandNoBrand
              }
              error={errors.brandDescription}
            >
              <textarea
                value={form.brandDescription ?? brandText}
                onChange={(e) => set('brandDescription', e.target.value)}
                rows={3}
                placeholder={copy.product.aboutBrandPlaceholder}
                className={textareaClass}
              />
            </Text>
            <Text label={copy.product.description} error={errors.description}>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </Text>
            <Text label={copy.product.inci} error={errors.inci}>
              <textarea
                value={form.inci ?? ''}
                onChange={(e) => set('inci', e.target.value || null)}
                rows={3}
                placeholder={copy.product.inciPlaceholder}
                className={textareaClass}
              />
            </Text>
            <Text label={copy.product.howToUse} error={errors.howToUse}>
              <textarea
                value={form.howToUse}
                onChange={(e) => set('howToUse', e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </Text>
            <Text label={copy.product.shortName} hint={copy.product.shortNameHint} error={errors.shortName}>
              <input
                value={form.shortName ?? ''}
                onChange={(e) => set('shortName', e.target.value || null)}
                className={inputClass}
              />
            </Text>
          </Panel>

          <Panel title={copy.editor.seo}>
            <Text
              label={copy.editor.slug}
              hint={copy.editor.slugHint(`/catalog/${form.slug || '…'}`)}
              error={errors.slug}
            >
              <input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase())}
                className={inputClass}
                spellCheck={false}
              />
            </Text>
            <Text label={copy.editor.seoTitle} hint={copy.editor.seoHint} error={errors.seoTitle}>
              <input
                value={form.seoTitle ?? ''}
                onChange={(e) => set('seoTitle', e.target.value || null)}
                className={inputClass}
              />
            </Text>
            <Text label={copy.editor.seoDescription} error={errors.seoDescription}>
              <textarea
                value={form.seoDescription ?? ''}
                onChange={(e) => set('seoDescription', e.target.value || null)}
                rows={2}
                className={textareaClass}
              />
            </Text>
          </Panel>
        </div>

        <div className="flex max-w-[440px] min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Panel
            title={copy.product.photos}
            aside={<span className="text-[13px] text-muted">{copy.media.photosCount(images.length)}</span>}
          >
            <ProductPhotos images={images} onChange={changePhotos} />
            <FieldError error={errors.imageIds} />
          </Panel>
          <Panel title={copy.product.video}>
            <VideoSlot
              video={form.videoId ? video : null}
              hint={copy.product.videoHint}
              title={form.name.trim() || copy.product.new}
              onChange={(uploaded) => {
                setVideo(uploaded);
                set('videoId', uploaded.id);
              }}
              onRemove={() => set('videoId', null)}
            />
            <FieldError error={errors.videoId} />
          </Panel>
          <SwitchRow label={copy.editor.inStock} checked={form.inStock} onChange={(v) => set('inStock', v)} />
          <SwitchRow
            label={copy.editor.publish}
            checked={form.published}
            onChange={(v) => set('published', v)}
          />
          <Panel>
            <Text
              label={copy.editor.badge}
              hint={
                form.isNew
                  ? copy.product.newBadgeHint
                  : copy.product.badgeHint(badged, Math.max(allProducts.data?.length ?? 1, 1))
              }
            >
              <select
                value={form.badge ?? ''}
                onChange={(e) => set('badge', (e.target.value || null) as ProductInput['badge'])}
                className={selectClass}
              >
                <option value="">{copy.editor.noBadge}</option>
                {BADGES.map((badge) => (
                  <option key={badge} value={badge}>
                    {badge}
                  </option>
                ))}
              </select>
            </Text>
          </Panel>
          <Panel title={copy.product.home} hint={copy.product.homeHint} className="gap-3.5">
            <ToggleRow
              label={copy.product.bestseller}
              checked={form.bestseller}
              onChange={(v) => set('bestseller', v)}
            />
            <ToggleRow label={copy.product.isNew} checked={form.isNew} onChange={(v) => set('isNew', v)} />
            <ToggleRow
              label={copy.product.seoulChoice}
              checked={form.seoulChoice}
              onChange={(v) => set('seoulChoice', v)}
            />
          </Panel>
        </div>
      </div>

      {product && (
        // At the end of the product's info, as the owner asked (2026-10-26).
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line pt-6">
          <ConfirmDelete
            label={copy.product.delete}
            title={copy.product.deleteTitle}
            text={
              product.programs.length > 0
                ? copy.product.deleteInPrograms(product.programs.map((p) => `«${p.title}»`).join(', '))
                : copy.product.deleteText
            }
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate(product.id, {
                onSuccess: () => {
                  toast.success(copy.product.deleted);
                  // After the baseline update has rendered, so the unsaved-changes guard lets the redirect through.
                  setBaseline(input);
                  setTimeout(() => void navigate('/products'), 0);
                },
                onError: (error) => toast.error(errorText(error)),
              })
            }
          />
          <span className="text-sm leading-normal text-muted">{copy.product.deleteHint}</span>
        </div>
      )}
    </>
  );
}

export function Text({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {children}
      <FieldError error={error} />
    </Field>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-[18px]">
      <span className="text-[15px] font-semibold">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** A label and a switch inside a panel («На главной странице»). */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function ConfirmDelete({
  label,
  title,
  text,
  pending,
  onConfirm,
  trigger,
}: {
  label: string;
  title: string;
  text: string;
  pending: boolean;
  onConfirm: () => void;
  /** Replaces the default «Удалить …» button (the products table uses an icon button). */
  trigger?: ReactNode;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        {trigger ?? <Button variant="danger">{label}</Button>}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(20,20,43,.4)]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] flex w-[calc(100%-40px)] max-w-[420px] -translate-1/2 flex-col gap-3 rounded-card bg-surface p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-[15px] leading-normal text-muted">
            {text}
          </AlertDialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">{copy.editor.cancel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" disabled={pending} onClick={onConfirm}>
                {copy.editor.delete}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
