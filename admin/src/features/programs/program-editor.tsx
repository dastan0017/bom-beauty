import {
  BADGES,
  formatKgs,
  programsWord,
  QUIZ_GOAL_LABELS,
  QUIZ_GOALS,
  SKIN_TYPE_LABELS,
  SKIN_TYPES,
  type AdminProgram,
  type AdminProgramItem,
  type ProgramInput,
} from '@bom/shared';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useDeleteProgram, useProducts, useProgram, usePrograms, useSaveProgram } from '@/api/catalog';
import { Button, CloseIcon, inputClass, Spinner } from '@/components/ui';
import {
  EditorHeader,
  FieldError,
  Panel,
  selectClass,
  textareaClass,
  Toggle,
  useUnsavedGuard,
} from '@/components/ui/editor';
import { ImageSlot, MediaPreview, PdfSlot, VideoSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { ConfirmDelete, Text } from '@/features/products/product-editor';
import { PlusIcon } from '@/features/products/products-page';
import { errorText, fieldErrors } from '@/lib/format';
import { cn } from '@/lib/utils';

const EMPTY: ProgramInput = {
  title: '',
  slug: '',
  headline: null,
  symptom: '',
  description: '',
  course: '',
  fit: [''],
  priceKgs: 0,
  badge: null,
  quizGoal: null,
  quizSkins: [],
  published: false,
  inStock: true,
  itemIds: [],
  steps: { am: [], pm: [] },
  videoId: null,
  protocolMediaId: null,
  coverMediaId: null,
  seoTitle: null,
  seoDescription: null,
};

function toInput(program: AdminProgram): ProgramInput {
  return {
    title: program.title,
    slug: program.slug,
    headline: program.headline,
    symptom: program.symptom,
    description: program.description,
    course: program.course,
    fit: program.fit.length ? program.fit : [''],
    priceKgs: program.priceKgs,
    badge: program.badge,
    quizGoal: program.quizGoal,
    quizSkins: program.quizSkins,
    published: program.published,
    inStock: program.inStock,
    itemIds: program.items.map((item) => item.id),
    steps: program.steps,
    videoId: program.video?.id ?? null,
    protocolMediaId: program.protocol?.id ?? null,
    coverMediaId: program.cover?.id ?? null,
    seoTitle: program.seoTitle,
    seoDescription: program.seoDescription,
  };
}

const move = <T,>(list: T[], index: number, delta: number): T[] => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
};

export function ProgramEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const program = useProgram(isNew ? null : id);
  if (!isNew && !program.data) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {program.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  return <ProgramForm key={program.data?.id ?? 'new'} program={program.data ?? null} />;
}

function ProgramForm({ program }: { program: AdminProgram | null }) {
  const navigate = useNavigate();
  const products = useProducts({});
  const programs = usePrograms();
  const save = useSaveProgram(program?.id ?? null);
  const remove = useDeleteProgram();
  const initial = program ? toInput(program) : EMPTY;
  const [baseline, setBaseline] = useState(initial);
  const [form, setForm] = useState(initial);
  const [current, setCurrent] = useState(program);
  const [video, setVideo] = useState(program?.video ?? null);
  const [protocol, setProtocol] = useState(program?.protocol ?? null);
  const [cover, setCover] = useState(program?.cover ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A just-created item arrives here with { saved: true } after the redirect to its own URL.
  const location = useLocation();
  const [saved, setSaved] = useState(Boolean((location.state as { saved?: boolean } | null)?.saved));
  const [picker, setPicker] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  useUnsavedGuard(dirty && !save.isPending);

  const set = <K extends keyof ProgramInput>(key: K, value: ProgramInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  // Item details come from the catalog list (covers items added in this session).
  const itemInfo = (id: string): AdminProgramItem | null => {
    const fromProgram = current?.items.find((item) => item.id === id);
    if (fromProgram) return fromProgram;
    const row = products.data?.find((p) => p.id === id);
    return row
      ? {
          id: row.id,
          name: row.name,
          shortName: row.name,
          brand: row.brand,
          volume: row.volume,
          priceKgs: row.priceKgs,
          image: row.image,
        }
      : null;
  };
  const items = form.itemIds
    .map((id) => itemInfo(id))
    .filter((item): item is AdminProgramItem => item !== null);
  const sum = items.reduce((total, item) => total + item.priceKgs, 0);
  const saving =
    sum > form.priceKgs && form.priceKgs > 0
      ? `${formatKgs(sum - form.priceKgs)} · ${Math.round(((sum - form.priceKgs) / sum) * 100)}%`
      : '—';
  const sameGoal =
    (programs.data ?? []).filter((p) => p.id !== program?.id && p.quizGoal === form.quizGoal).length + 1;
  const badged =
    (programs.data ?? []).filter((p) => p.id !== program?.id && p.badge).length + (form.badge ? 1 : 0);

  const submit = () =>
    save.mutate(
      { ...form, fit: form.fit.filter((line) => line.trim()) },
      {
        onSuccess: (result) => {
          toast.success(copy.saved);
          const next = toInput(result);
          setBaseline(next);
          setForm(next);
          setCurrent(result);
          setVideo(result.video);
          setProtocol(result.protocol);
          setCover(result.cover);
          setErrors({});
          setSaved(true);
          if (!program)
            setTimeout(
              () => void navigate(`/programs/${result.id}`, { replace: true, state: { saved: true } }),
              0,
            );
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          toast.error(errorText(error));
        },
      },
    );

  // Stored steps are no longer edited here but may only use the program's products, so they follow removals.
  const removeItem = (id: string) => {
    setForm((f) => ({
      ...f,
      itemIds: f.itemIds.filter((itemId) => itemId !== id),
      steps: {
        am: f.steps.am.filter((s) => s.productId !== id),
        pm: f.steps.pm.filter((s) => s.productId !== id),
      },
    }));
    setSaved(false);
  };

  const title = form.title.trim() || copy.program.new;

  return (
    <>
      <EditorHeader
        parent={{ to: '/programs', label: copy.nav.programs }}
        title={title}
        status={{ label: form.published ? copy.editor.onSite : copy.editor.draft, on: form.published }}
        saved={saved}
        saving={save.isPending}
        dirty={dirty}
        onSave={submit}
        extra={
          current && (
            <a
              href={`${env.VITE_SITE_URL}/programs/${current.slug}`}
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
          <Panel title={copy.program.basics}>
            <Text label={copy.program.title} error={errors.title}>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className={inputClass}
              />
            </Text>
            <Text label={copy.program.symptom} error={errors.symptom}>
              <input
                value={form.symptom}
                onChange={(e) => set('symptom', e.target.value)}
                placeholder={copy.program.symptomPlaceholder}
                className={inputClass}
              />
            </Text>
            <Text
              label={copy.program.description}
              hint={copy.program.descriptionHint}
              error={errors.description}
            >
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className={textareaClass}
              />
            </Text>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{copy.program.fit}</span>
              {form.fit.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={line}
                    onChange={(e) =>
                      set(
                        'fit',
                        form.fit.map((l, i) => (i === index ? e.target.value : l)),
                      )
                    }
                    placeholder={copy.program.fitPlaceholder}
                    aria-label={`${copy.program.fit} ${index + 1}`}
                    className={cn(inputClass, 'min-w-0 flex-1')}
                  />
                  <IconButton
                    label={copy.program.removeFit}
                    onClick={() =>
                      set(
                        'fit',
                        form.fit.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <CloseIcon width={16} height={16} />
                  </IconButton>
                </div>
              ))}
              {form.fit.length < 8 && (
                <button
                  type="button"
                  onClick={() => set('fit', [...form.fit, ''])}
                  className="inline-flex h-9 items-center gap-1.5 self-start text-[15px] font-semibold text-blue"
                >
                  <PlusIcon />
                  {copy.program.addFit}
                </button>
              )}
              <FieldError error={errors.fit} />
            </div>
          </Panel>

          <Panel
            title={copy.program.items(items.length)}
            aside={<span className="text-sm text-muted">{copy.program.itemsHint}</span>}
          >
            <div className="flex flex-col">
              {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-3.5 border-b border-line-2 py-3">
                  <div className="flex flex-none flex-col">
                    <ArrowButton
                      label={copy.editor.up}
                      dir="up"
                      onClick={() => set('itemIds', move(form.itemIds, index, -1))}
                    />
                    <ArrowButton
                      label={copy.editor.down}
                      dir="down"
                      onClick={() => set('itemIds', move(form.itemIds, index, 1))}
                    />
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
                    </span>
                  </div>
                  <span className="w-[90px] flex-none truncate text-right text-[15px] text-muted">
                    {formatKgs(item.priceKgs)}
                  </span>
                  <IconButton label={copy.program.removeItem} onClick={() => removeItem(item.id)}>
                    <CloseIcon width={16} height={16} />
                  </IconButton>
                </div>
              ))}
            </div>
            <FieldError error={errors.itemIds} />
            {picker ? (
              <div className="flex flex-col rounded-xl border border-input">
                <div className="flex items-center justify-between border-b border-line-2 px-3.5 py-3">
                  <span className="text-[15px] font-semibold">{copy.program.pickTitle}</span>
                  <button
                    type="button"
                    onClick={() => setPicker(false)}
                    className="text-sm font-semibold text-muted"
                  >
                    {copy.program.close}
                  </button>
                </div>
                <div className="flex max-h-[280px] flex-col overflow-y-auto">
                  {products.data
                    ?.filter((p) => !form.itemIds.includes(p.id))
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 border-b border-line-3 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-px">
                          <span className="text-[15px] font-semibold">{p.name}</span>
                          <span className="text-[13px] text-muted">
                            {p.brand} · {p.category.name}
                          </span>
                        </div>
                        <span className="truncate text-sm text-muted">{formatKgs(p.priceKgs)}</span>
                        <Button
                          variant="outline"
                          className="h-[34px] px-3 text-sm"
                          onClick={() => set('itemIds', [...form.itemIds, p.id])}
                        >
                          {copy.editor.add}
                        </Button>
                      </div>
                    ))}
                  {products.data?.every((p) => form.itemIds.includes(p.id)) && (
                    <span className="px-3.5 py-5 text-sm text-muted">{copy.program.pickEmpty}</span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="flex h-[50px] items-center justify-center gap-2 rounded-xl border border-dashed text-[15px] font-semibold hover:border-dashed-hover"
              >
                <PlusIcon />
                {copy.program.addItem}
              </button>
            )}
          </Panel>

          <Panel title={copy.program.page}>
            <Text label={copy.program.headline} hint={copy.program.headlineHint} error={errors.headline}>
              <input
                value={form.headline ?? ''}
                onChange={(e) => set('headline', e.target.value || null)}
                placeholder={copy.program.headlinePlaceholder}
                className={inputClass}
              />
            </Text>
            <Text label={copy.program.course} error={errors.course}>
              <input
                value={form.course}
                onChange={(e) => set('course', e.target.value)}
                placeholder={copy.program.coursePlaceholder}
                className={inputClass}
              />
            </Text>
            <Text
              label={copy.editor.slug}
              hint={copy.editor.slugHint(`/programs/${form.slug || '…'}`)}
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
            title={copy.program.cover}
            hint={copy.program.coverHint}
            aside={<span className="text-[13px] text-muted">{copy.media.dropHint}</span>}
          >
            <ImageSlot
              media={form.coverMediaId ? cover : null}
              label={copy.program.coverLabel}
              purpose="content"
              className="aspect-[5/4]"
              onChange={(uploaded) => {
                setCover(uploaded);
                set('coverMediaId', uploaded.id);
              }}
              {...(form.coverMediaId ? { onRemove: () => set('coverMediaId', null) } : {})}
            />
          </Panel>
          <Panel title={copy.program.video} aside={<span className="text-[13px] text-muted">9:16</span>}>
            <VideoSlot
              video={form.videoId ? video : null}
              hint={copy.media.videoHint}
              title={form.title || copy.program.new}
              onChange={(uploaded) => {
                setVideo(uploaded);
                set('videoId', uploaded.id);
              }}
              onRemove={() => set('videoId', null)}
            />
          </Panel>
          <Panel
            title={copy.program.protocol}
            hint={copy.program.protocolHint}
            aside={<span className="text-[13px] text-muted">PDF</span>}
          >
            <PdfSlot
              media={form.protocolMediaId ? protocol : null}
              hint={copy.program.protocolEmpty}
              purpose="protocol"
              onChange={(uploaded) => {
                setProtocol(uploaded);
                set('protocolMediaId', uploaded.id);
              }}
              onRemove={() => set('protocolMediaId', null)}
            />
          </Panel>
          <Panel title={copy.program.price}>
            <div className="relative">
              <input
                value={form.priceKgs ? String(form.priceKgs) : ''}
                onChange={(e) => set('priceKgs', Number(e.target.value.replace(/\D/g, '').slice(0, 8)) || 0)}
                inputMode="numeric"
                aria-label={copy.program.price}
                className={cn(inputClass, 'h-[50px] pr-[54px] text-xl font-semibold')}
              />
              <span className="absolute top-[15px] right-4 text-[15px] text-muted">{copy.editor.som}</span>
            </div>
            <FieldError error={errors.priceKgs} />
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">{copy.program.separately}</span>
                <span>{formatKgs(sum)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">{copy.program.saving}</span>
                <span className="font-semibold text-green">{saving}</span>
              </div>
            </div>
          </Panel>
          <Panel title={copy.program.quiz} hint={copy.program.quizHint}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[15px]">{copy.program.goal}</span>
              <select
                value={form.quizGoal ?? ''}
                onChange={(e) => set('quizGoal', (e.target.value || null) as ProgramInput['quizGoal'])}
                className={selectClass}
              >
                <option value="">{copy.program.noGoal}</option>
                {QUIZ_GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {QUIZ_GOAL_LABELS[goal]}
                  </option>
                ))}
              </select>
              <span className="text-[13px] leading-normal text-muted">
                {form.quizGoal
                  ? copy.program.goalHint(sameGoal, programsWord(sameGoal))
                  : copy.program.goalHintNone}
              </span>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-[15px]">{copy.program.skins}</span>
              <div className="flex flex-wrap gap-2">
                {SKIN_TYPES.map((skin) => {
                  const on = form.quizSkins.includes(skin);
                  return (
                    <button
                      key={skin}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          'quizSkins',
                          on ? form.quizSkins.filter((s) => s !== skin) : [...form.quizSkins, skin],
                        )
                      }
                      className={cn(
                        'inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold',
                        on ? 'border-ink bg-ink text-white' : 'border-input bg-surface text-ink',
                      )}
                    >
                      {SKIN_TYPE_LABELS[skin]}
                    </button>
                  );
                })}
              </div>
              <span className="text-[13px] leading-normal text-muted">{copy.program.skinsHint}</span>
            </div>
          </Panel>
          <Panel title={copy.program.publication}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{copy.editor.publish}</span>
              <Toggle
                checked={form.published}
                onChange={(v) => set('published', v)}
                label={copy.editor.publish}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{copy.editor.inStock}</span>
              <Toggle
                checked={form.inStock}
                onChange={(v) => set('inStock', v)}
                label={copy.editor.inStock}
              />
            </div>
            <Text
              label={copy.editor.badge}
              hint={copy.program.badgeHint(badged, Math.max(programs.data?.length ?? 1, 1))}
            >
              <select
                value={form.badge ?? ''}
                onChange={(e) => set('badge', (e.target.value || null) as ProgramInput['badge'])}
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
          {current && (
            <ConfirmDelete
              label={copy.program.delete}
              title={copy.program.deleteTitle}
              text={copy.program.deleteText}
              pending={remove.isPending}
              onConfirm={() =>
                remove.mutate(current.id, {
                  onSuccess: () => {
                    toast.success(copy.program.deleted);
                    void navigate('/programs');
                  },
                  onError: (error) => toast.error(errorText(error)),
                })
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

function IconButton({
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
