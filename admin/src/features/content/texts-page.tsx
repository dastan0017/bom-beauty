import type { AdminContent, ContentValue } from '@bom/shared';
import { NavLink, Navigate, useParams } from 'react-router';
import { useContent, type ContentKey } from '@/api/content';
import { CloseIcon, inputClass, Spinner } from '@/components/ui';
import { EditorHeader, FieldError, Panel, textareaClass } from '@/components/ui/editor';
import { ImageSlot, VideoSlot } from '@/components/ui/media';
import { copy } from '@/content/copy';
import { Text } from '@/features/products/product-editor';
import { PlusIcon } from '@/features/products/products-page';
import { cn } from '@/lib/utils';
import { useContentEditor } from './use-content-editor';

const TABS = ['home', 'delivery', 'privacy', 'offer'] as const;
type TextKey = (typeof TABS)[number];

/** Тексты (gap: the design edits these inline in the prototype). One route per block keeps the unsaved guard simple. */
export function TextsPage() {
  const { key } = useParams();
  if (!TABS.includes(key as TextKey)) return <Navigate to="/content/home" replace />;
  const current = key as TextKey;
  return (
    <>
      <nav
        aria-label={copy.texts.title}
        className="mb-6 flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 lg:self-start"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab}
            to={`/content/${tab}`}
            className={({ isActive }) =>
              cn(
                'flex h-9 flex-none items-center rounded-[9px] px-3.5 text-sm font-semibold',
                isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink',
              )
            }
          >
            {copy.texts.tabs[tab]}
          </NavLink>
        ))}
      </nav>
      <Block key={current} contentKey={current} />
    </>
  );
}

function Block({ contentKey }: { contentKey: ContentKey }) {
  const content = useContent(contentKey);
  if (!content.data) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {content.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  if (contentKey === 'home') return <HomeForm content={content.data} />;
  if (contentKey === 'delivery') return <DeliveryForm content={content.data} />;
  return <LegalForm content={content.data} contentKey={contentKey as 'privacy' | 'offer'} />;
}

function HomeForm({ content }: { content: AdminContent }) {
  const { form, update, submit, errors, saved, dirty, saving } = useContentEditor('home', content);
  const media = (id: string | null) => (id ? (content.media.find((m) => m.id === id) ?? null) : null);
  const video = form.greetingVideoId
    ? (content.videos.find((v) => v.id === form.greetingVideoId) ?? null)
    : null;
  type Home = ContentValue<'home'>;
  const setSide = (side: 'mass' | 'pro', patch: Partial<Home['comparison']['mass']>) =>
    update({ comparison: { ...form.comparison, [side]: { ...form.comparison[side], ...patch } } });

  return (
    <>
      <EditorHeader
        title={copy.texts.tabs.home}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={submit}
      />
      <div className="mt-[26px] flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Panel title={copy.texts.hero}>
            <Text label={copy.texts.heroBadge} error={errors.heroBadge}>
              <input
                value={form.heroBadge}
                onChange={(e) => update({ heroBadge: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.heroTitle} hint={copy.texts.heroTitleHint} error={errors.heroTitle}>
              <input
                value={form.heroTitle}
                onChange={(e) => update({ heroTitle: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.heroSubtitle} error={errors.heroSubtitle}>
              <input
                value={form.heroSubtitle}
                onChange={(e) => update({ heroSubtitle: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.quizPrompt} error={errors.quizPrompt}>
              <input
                value={form.quizPrompt}
                onChange={(e) => update({ quizPrompt: e.target.value })}
                className={inputClass}
              />
            </Text>
          </Panel>

          <Panel title={copy.texts.entries}>
            {form.entries.map((entry, index) => (
              <div
                key={entry.key}
                className="grid gap-3 border-t border-line-2 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[96px_minmax(0,1fr)]"
              >
                <ImageSlot
                  media={media(entry.imageMediaId)}
                  label={copy.media.photo}
                  className="w-24 rounded-xl"
                  {...(entry.imageMediaId
                    ? {
                        onRemove: () =>
                          update({
                            entries: form.entries.map((e, i) =>
                              i === index ? { ...e, imageMediaId: null } : e,
                            ),
                          }),
                      }
                    : {})}
                />
                <div className="flex flex-col gap-2.5">
                  <span className="text-[13px] font-semibold text-muted">
                    {copy.texts.entryNames[entry.key]}
                  </span>
                  <input
                    value={entry.title}
                    onChange={(e) =>
                      update({
                        entries: form.entries.map((x, i) =>
                          i === index ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                    aria-label={`${copy.texts.entryNames[entry.key]}: ${copy.texts.entryTitle}`}
                    className={cn(inputClass, 'font-semibold')}
                  />
                  <input
                    value={entry.text}
                    onChange={(e) =>
                      update({
                        entries: form.entries.map((x, i) =>
                          i === index ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                    aria-label={`${copy.texts.entryNames[entry.key]}: ${copy.texts.entryText}`}
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </Panel>

          <Panel title={copy.texts.comparison}>
            <Text label={copy.texts.comparisonTitle} error={errors['comparison.title']}>
              <input
                value={form.comparison.title}
                onChange={(e) => update({ comparison: { ...form.comparison, title: e.target.value } })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.comparisonSubtitle} error={errors['comparison.subtitle']}>
              <input
                value={form.comparison.subtitle}
                onChange={(e) => update({ comparison: { ...form.comparison, subtitle: e.target.value } })}
                className={inputClass}
              />
            </Text>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['mass', 'pro'] as const).map((side) => (
                <div key={side} className="flex flex-col gap-2.5 rounded-xl bg-bg p-3.5">
                  <span className="text-sm font-semibold">
                    {side === 'mass' ? copy.texts.mass : copy.texts.pro}
                  </span>
                  <input
                    value={form.comparison[side].eyebrow}
                    onChange={(e) => setSide(side, { eyebrow: e.target.value })}
                    aria-label={copy.texts.eyebrow}
                    placeholder={copy.texts.eyebrow}
                    className={inputClass}
                  />
                  <input
                    value={form.comparison[side].title}
                    onChange={(e) => setSide(side, { title: e.target.value })}
                    aria-label={copy.texts.columnTitle}
                    placeholder={copy.texts.columnTitle}
                    className={cn(inputClass, 'font-semibold')}
                  />
                  <textarea
                    value={form.comparison[side].points.join('\n')}
                    onChange={(e) => setSide(side, { points: e.target.value.split('\n').slice(0, 5) })}
                    aria-label={copy.texts.points}
                    placeholder={copy.texts.points}
                    rows={3}
                    className={textareaClass}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={copy.texts.about}>
            <Text label={copy.texts.caption} error={errors['about.caption']}>
              <input
                value={form.about.caption}
                onChange={(e) => update({ about: { ...form.about, caption: e.target.value } })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.aboutText} error={errors['about.text']}>
              <textarea
                value={form.about.text}
                onChange={(e) => update({ about: { ...form.about, text: e.target.value } })}
                rows={4}
                className={textareaClass}
              />
            </Text>
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold">{copy.texts.stats}</span>
              {form.about.stats.map((stat, index) => (
                <div key={index} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2.5">
                  <input
                    value={stat.value}
                    onChange={(e) =>
                      update({
                        about: {
                          ...form.about,
                          stats: form.about.stats.map((s, i) =>
                            i === index ? { ...s, value: e.target.value } : s,
                          ),
                        },
                      })
                    }
                    aria-label={`${copy.texts.stats} ${index + 1}`}
                    className={cn(inputClass, 'font-semibold')}
                  />
                  <input
                    value={stat.label}
                    onChange={(e) =>
                      update({
                        about: {
                          ...form.about,
                          stats: form.about.stats.map((s, i) =>
                            i === index ? { ...s, label: e.target.value } : s,
                          ),
                        },
                      })
                    }
                    aria-label={`${copy.texts.stats} ${index + 1}: ${copy.texts.label}`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={copy.texts.reviews}>
            <Text label={copy.texts.reviewsTitle} error={errors.reviewsTitle}>
              <input
                value={form.reviewsTitle}
                onChange={(e) => update({ reviewsTitle: e.target.value })}
                className={inputClass}
              />
            </Text>
            <Text label={copy.texts.reviewsSubtitle} error={errors.reviewsSubtitle}>
              <input
                value={form.reviewsSubtitle}
                onChange={(e) => update({ reviewsSubtitle: e.target.value })}
                className={inputClass}
              />
            </Text>
          </Panel>
        </div>

        <div className="flex max-w-[440px] min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Panel title={copy.texts.heroPhoto}>
            <ImageSlot
              media={media(form.heroPhotoMediaId)}
              label={copy.media.photo}
              {...(form.heroPhotoMediaId ? { onRemove: () => update({ heroPhotoMediaId: null }) } : {})}
            />
          </Panel>
          <Panel
            title={copy.texts.greetingVideo}
            aside={<span className="text-[13px] text-muted">9:16</span>}
          >
            <VideoSlot
              video={video}
              hint={copy.media.videoHint}
              onRemove={() => update({ greetingVideoId: null })}
            />
          </Panel>
          <Panel title={`${copy.texts.about}: ${copy.media.photo}`}>
            <ImageSlot
              media={media(form.about.photoMediaId)}
              label={copy.media.photo}
              {...(form.about.photoMediaId
                ? { onRemove: () => update({ about: { ...form.about, photoMediaId: null } }) }
                : {})}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function DeliveryForm({ content }: { content: AdminContent }) {
  const { form, update, submit, errors, saved, dirty, saving } = useContentEditor('delivery', content);
  return (
    <>
      <EditorHeader
        title={copy.texts.tabs.delivery}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={submit}
      />
      <div className="mt-[26px] flex max-w-[860px] flex-col gap-4">
        <Panel title={copy.texts.programFacts} hint={copy.texts.programFactsHint}>
          {form.programFacts.map((fact, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={fact.label}
                onChange={(e) =>
                  update({
                    programFacts: form.programFacts.map((f, i) =>
                      i === index ? { ...f, label: e.target.value } : f,
                    ),
                  })
                }
                aria-label={`${copy.texts.label} ${index + 1}`}
                placeholder={copy.texts.label}
                className={cn(inputClass, 'min-w-0 flex-1')}
              />
              <input
                value={fact.value}
                onChange={(e) =>
                  update({
                    programFacts: form.programFacts.map((f, i) =>
                      i === index ? { ...f, value: e.target.value } : f,
                    ),
                  })
                }
                aria-label={`${copy.texts.value} ${index + 1}`}
                placeholder={copy.texts.value}
                className={cn(inputClass, 'min-w-0 flex-1 font-semibold')}
              />
              <RemoveButton
                onClick={() => update({ programFacts: form.programFacts.filter((_, i) => i !== index) })}
              />
            </div>
          ))}
          {form.programFacts.length < 5 && (
            <AddButton
              onClick={() => update({ programFacts: [...form.programFacts, { label: '', value: '' }] })}
            >
              {copy.texts.addRow}
            </AddButton>
          )}
        </Panel>
        <Panel title={copy.texts.page} hint={copy.texts.markdownHint}>
          <textarea
            value={form.markdown}
            onChange={(e) => update({ markdown: e.target.value })}
            rows={14}
            aria-label={copy.texts.page}
            className={cn(textareaClass, 'font-mono text-sm')}
          />
          <FieldError error={errors.markdown} />
        </Panel>
        <Panel title={copy.texts.faq}>
          {form.faq.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 border-t border-line-2 pt-4 first:border-t-0 first:pt-0"
            >
              <div className="flex gap-2">
                <input
                  value={item.q}
                  onChange={(e) =>
                    update({ faq: form.faq.map((f, i) => (i === index ? { ...f, q: e.target.value } : f)) })
                  }
                  aria-label={`${copy.texts.question} ${index + 1}`}
                  placeholder={copy.texts.question}
                  className={cn(inputClass, 'min-w-0 flex-1 font-semibold')}
                />
                <RemoveButton onClick={() => update({ faq: form.faq.filter((_, i) => i !== index) })} />
              </div>
              <textarea
                value={item.a}
                onChange={(e) =>
                  update({ faq: form.faq.map((f, i) => (i === index ? { ...f, a: e.target.value } : f)) })
                }
                aria-label={`${copy.texts.answer} ${index + 1}`}
                placeholder={copy.texts.answer}
                rows={2}
                className={textareaClass}
              />
              <FieldError error={errors[`faq.${index}.q`] ?? errors[`faq.${index}.a`]} />
            </div>
          ))}
          <AddButton onClick={() => update({ faq: [...form.faq, { q: '', a: '' }] })}>
            {copy.texts.addFaq}
          </AddButton>
        </Panel>
      </div>
    </>
  );
}

function LegalForm({ content, contentKey }: { content: AdminContent; contentKey: 'privacy' | 'offer' }) {
  const { form, update, submit, errors, saved, dirty, saving } = useContentEditor(contentKey, content);
  return (
    <>
      <EditorHeader
        title={copy.texts.tabs[contentKey]}
        saved={saved}
        saving={saving}
        dirty={dirty}
        onSave={submit}
      />
      <div className="mt-[26px] flex max-w-[860px] flex-col gap-4">
        <Panel title={copy.texts.legal} hint={`${copy.texts.legalHint} ${copy.texts.markdownHint}`}>
          <textarea
            value={form.markdown}
            onChange={(e) => update({ markdown: e.target.value })}
            rows={24}
            aria-label={copy.texts.legal}
            className={cn(textareaClass, 'font-mono text-sm')}
          />
          <FieldError error={errors.markdown} />
        </Panel>
      </div>
    </>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 self-start text-[15px] font-semibold text-blue"
    >
      <PlusIcon />
      {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copy.editor.remove}
      title={copy.editor.remove}
      className="flex size-11 flex-none items-center justify-center rounded-control border border-line text-muted hover:border-[#c5c9da]"
    >
      <CloseIcon width={16} height={16} />
    </button>
  );
}
