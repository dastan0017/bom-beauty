import { useState } from 'react';
import {
  WHOLESALE_COUNTRY_LABELS,
  type AdminContent,
  type AdminMedia,
  type AdminVideo,
  type ContentValue,
} from '@bom/shared';
import { useContent } from '@/api/content';
import { useProducts } from '@/api/catalog';
import { inputClass, Spinner } from '@/components/ui';
import { EditorHeader, FieldError, Panel, textareaClass } from '@/components/ui/editor';
import { ImageSlot, PdfSlot, VideoSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { useContentEditor } from '@/features/content/use-content-editor';
import { Text } from '@/features/products/product-editor';
import { cn } from '@/lib/utils';

type Wholesale = ContentValue<'wholesale'>;

/** Страница «Оптовикам» (design: isWholesale). */
export function WholesalePage() {
  const content = useContent('wholesale');
  if (!content.data) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {content.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  return <WholesaleForm content={content.data} />;
}

function WholesaleForm({ content }: { content: AdminContent }) {
  const products = useProducts({});
  const { form, update, submit, errors, saved, dirty, saving } = useContentEditor('wholesale', content);
  const [known, setKnown] = useState<AdminMedia[]>(content.media);
  const [videos, setVideos] = useState<AdminVideo[]>(content.videos);
  const remember = (item: AdminMedia) => setKnown((list) => [...list.filter((m) => m.id !== item.id), item]);
  const media = (id: string | null) => (id ? (known.find((m) => m.id === id) ?? null) : null);
  const video = form.videoId ? (videos.find((v) => v.id === form.videoId) ?? null) : null;
  const setList = <K extends 'facts' | 'stats' | 'benefits' | 'steps' | 'delivery'>(
    key: K,
    index: number,
    value: Wholesale[K][number],
  ) => update({ [key]: form[key].map((item, i) => (i === index ? value : item)) });

  return (
    <>
      <EditorHeader
        title={copy.wholesale.title}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={submit}
        extra={
          <a
            href={`${env.VITE_SITE_URL}/wholesale`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-11 items-center rounded-control border border-input bg-surface px-[18px] text-[15px] font-semibold hover:border-input-hover"
          >
            {copy.openSite}
          </a>
        }
      />
      <p className="mt-1 text-[15px] text-muted">{copy.wholesale.lead}</p>

      <div className="mt-[26px] flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Panel title={copy.wholesale.contacts}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Text label={copy.wholesale.phone} error={errors.phone}>
                <input
                  value={form.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  placeholder="+996 XXX XXX XXX"
                  inputMode="tel"
                  className={inputClass}
                />
              </Text>
              <Text
                label={copy.wholesale.whatsapp}
                hint={copy.wholesale.whatsappHint}
                error={errors.whatsapp}
              >
                <input
                  value={form.whatsapp ?? ''}
                  onChange={(e) => update({ whatsapp: e.target.value || null })}
                  placeholder="+996 XXX XXX XXX"
                  inputMode="tel"
                  className={inputClass}
                />
              </Text>
            </div>
            {!form.phone.replace(/\D/g, '') && (
              <span className="text-sm leading-normal text-muted">{copy.wholesale.phoneEmpty}</span>
            )}
          </Panel>

          <Panel title={copy.wholesale.hero} hint={copy.wholesale.heroHint}>
            <Text label={copy.wholesale.eyebrow} error={errors.eyebrow}>
              <input
                value={form.eyebrow}
                onChange={(e) => update({ eyebrow: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.wholesale.heading} hint={copy.wholesale.headingHint} error={errors.title}>
              <input
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.wholesale.subtitle} error={errors.subtitle}>
              <input
                value={form.subtitle}
                onChange={(e) => update({ subtitle: e.target.value })}
                className={inputClass}
              />
            </Text>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{copy.wholesale.facts}</span>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <input
                    key={index}
                    value={form.facts[index] ?? ''}
                    onChange={(e) => {
                      const facts = [0, 1, 2].map((i) =>
                        i === index ? e.target.value : (form.facts[i] ?? ''),
                      );
                      update({ facts: facts.filter((fact, i) => fact || i < form.facts.length) });
                    }}
                    aria-label={`${copy.wholesale.facts} ${index + 1}`}
                    className={inputClass}
                  />
                ))}
              </div>
            </div>
          </Panel>

          <Panel title={copy.wholesale.about} hint={copy.wholesale.aboutHint}>
            <Text label={copy.wholesale.quote} error={errors.quote}>
              <textarea
                value={form.quote}
                onChange={(e) => update({ quote: e.target.value })}
                rows={2}
                className={textareaClass}
              />
            </Text>
            <Text label={copy.wholesale.intro} hint={copy.wholesale.introHint} error={errors.intro}>
              <textarea
                value={form.intro.join('\n')}
                onChange={(e) => update({ intro: e.target.value.split('\n').slice(0, 4) })}
                rows={4}
                className={textareaClass}
              />
            </Text>
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold">{copy.wholesale.stats}</span>
              {form.stats.map((stat, index) => (
                <div key={index} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2.5">
                  <input
                    value={stat.value}
                    onChange={(e) => setList('stats', index, { ...stat, value: e.target.value })}
                    aria-label={`${copy.wholesale.stats} ${index + 1}`}
                    className={cn(inputClass, 'font-semibold')}
                  />
                  <input
                    value={stat.label}
                    onChange={(e) => setList('stats', index, { ...stat, label: e.target.value })}
                    aria-label={`${copy.wholesale.stats} ${index + 1}, ${copy.editor.caption}`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            <Text
              label={copy.wholesale.expertise}
              hint={copy.wholesale.expertiseHint}
              error={errors.expertise}
            >
              <input
                value={form.expertise.join(', ')}
                onChange={(e) =>
                  update({
                    expertise: e.target.value
                      .split(',')
                      .map((item) => item.trimStart())
                      .slice(0, 6),
                  })
                }
                className={inputClass}
              />
            </Text>
          </Panel>

          <Panel
            title={copy.wholesale.featured}
            hint={copy.wholesale.featuredHint}
            aside={
              <span className="flex-none text-sm font-semibold text-muted">
                {copy.wholesale.featuredCount(form.featuredProductIds.length)}
              </span>
            }
          >
            <div className="flex flex-wrap gap-2">
              {products.data?.map((product) => {
                const on = form.featuredProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      update({
                        featuredProductIds: on
                          ? form.featuredProductIds.filter((id) => id !== product.id)
                          : [...form.featuredProductIds, product.id].slice(0, 20),
                      })
                    }
                    className={cn(
                      'inline-flex h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-sm',
                      on
                        ? 'border-ink bg-ink pl-3 font-semibold text-white'
                        : 'border-input bg-surface text-ink',
                    )}
                  >
                    {on && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                    {product.name}
                  </button>
                );
              })}
            </div>
          </Panel>

          <TitledRows
            title={copy.wholesale.benefits}
            hint={copy.wholesale.benefitsHint}
            rows={form.benefits}
            onChange={(index, row) => setList('benefits', index, row)}
          />
          <TitledRows
            title={copy.wholesale.steps}
            rows={form.steps}
            onChange={(index, row) => setList('steps', index, row)}
          />

          <Panel title={copy.wholesale.delivery} hint={copy.wholesale.deliveryHint}>
            <Text label={copy.wholesale.stock} error={errors.stockNote}>
              <input
                value={form.stockNote}
                onChange={(e) => update({ stockNote: e.target.value })}
                className={inputClass}
              />
            </Text>
            <div className="flex flex-col">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5 pb-2 text-[13px] font-semibold text-muted">
                <span>{copy.wholesale.region}</span>
                <span>{copy.wholesale.air}</span>
                <span>{copy.wholesale.sea}</span>
              </div>
              {form.delivery.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2.5 border-t border-line-2 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs text-muted">
                      {row.flags.map((flag) => WHOLESALE_COUNTRY_LABELS[flag].label).join(', ')}
                    </span>
                    <input
                      value={row.region}
                      onChange={(e) => setList('delivery', index, { ...row, region: e.target.value })}
                      aria-label={copy.wholesale.region}
                      className={cn(inputClass, 'font-semibold')}
                    />
                  </div>
                  <input
                    value={row.airDays}
                    onChange={(e) => setList('delivery', index, { ...row, airDays: e.target.value })}
                    aria-label={copy.wholesale.air}
                    className={inputClass}
                  />
                  <input
                    value={row.seaDays}
                    onChange={(e) => setList('delivery', index, { ...row, seaDays: e.target.value })}
                    aria-label={copy.wholesale.sea}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex max-w-[440px] min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Panel title={copy.wholesale.catalog} aside={<span className="text-[13px] text-muted">PDF</span>}>
            <PdfSlot
              media={media(form.catalogMediaId)}
              hint={copy.wholesale.catalogHint}
              purpose="catalog"
              onChange={(uploaded) => {
                remember(uploaded);
                update({ catalogMediaId: uploaded.id });
              }}
              onRemove={() => update({ catalogMediaId: null })}
            />
          </Panel>
          <Panel title={copy.wholesale.protocols} aside={<span className="text-[13px] text-muted">PDF</span>}>
            <PdfSlot
              media={media(form.protocolsMediaId)}
              hint={copy.wholesale.protocolsHint}
              purpose="catalog"
              onChange={(uploaded) => {
                remember(uploaded);
                update({ protocolsMediaId: uploaded.id });
              }}
              onRemove={() => update({ protocolsMediaId: null })}
            />
          </Panel>
          <Panel title={copy.wholesale.video} aside={<span className="text-[13px] text-muted">9:16</span>}>
            <VideoSlot
              video={video}
              hint={copy.wholesale.videoHint}
              title={copy.wholesale.video}
              onChange={(uploaded) => {
                setVideos((list) => [...list, uploaded]);
                update({ videoId: uploaded.id });
              }}
              onRemove={() => update({ videoId: null })}
            />
          </Panel>
          <Panel title={copy.wholesale.portrait}>
            <ImageSlot
              media={media(form.portraitMediaId)}
              label={copy.media.photo}
              purpose="content"
              onChange={(uploaded) => {
                remember(uploaded);
                update({ portraitMediaId: uploaded.id });
              }}
              {...(form.portraitMediaId ? { onRemove: () => update({ portraitMediaId: null }) } : {})}
            />
          </Panel>
          <FieldError error={errors[''] ?? errors.data} />
        </div>
      </div>
    </>
  );
}

function TitledRows({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string;
  hint?: string;
  rows: { title: string; text: string }[];
  onChange: (index: number, row: { title: string; text: string }) => void;
}) {
  return (
    <Panel title={title} {...(hint ? { hint } : {})}>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-2.5">
          <span className="text-sm font-semibold text-muted">{index + 1}</span>
          <input
            value={row.title}
            onChange={(e) => onChange(index, { ...row, title: e.target.value })}
            aria-label={`${title} ${index + 1}`}
            className={cn(inputClass, 'font-semibold')}
          />
          <input
            value={row.text}
            onChange={(e) => onChange(index, { ...row, text: e.target.value })}
            aria-label={`${title} ${index + 1}, ${copy.editor.text}`}
            className={inputClass}
          />
        </div>
      ))}
    </Panel>
  );
}
