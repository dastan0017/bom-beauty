import type { AdminQuiz, QuizInput } from '@bom/shared';
import { QUIZ_ITEMS_MAX } from '@bom/shared';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useQuizLists, useSaveQuizLists } from '@/api/catalog';
import { CloseIcon, inputClass, Spinner } from '@/components/ui';
import {
  EditorHeader,
  FieldError,
  Panel,
  textareaClass,
  Toggle,
  useUnsavedGuard,
} from '@/components/ui/editor';
import { copy } from '@/content/copy';
import { ConfirmDelete, Text } from '@/features/products/product-editor';
import { PlusIcon } from '@/features/products/products-page';
import { errorText, fieldErrors } from '@/lib/format';
import { cn } from '@/lib/utils';
import { moveItem } from './program-items';

type Goal = QuizInput['goals'][number];
type Skin = QuizInput['skins'][number];

function toInput(quiz: AdminQuiz): QuizInput {
  return {
    goals: quiz.goals.map(({ key, name, answer, related, bonusSkins }) => ({
      key,
      name,
      answer,
      related,
      bonusSkins,
    })),
    skins: quiz.skins.map(({ key, name, answer, alsoMatches, avoidMax }) => ({
      key,
      name,
      answer,
      alsoMatches,
      avoidMax,
    })),
  };
}

/** A key for a new item; it never changes, programs and leads refer to the item by it. */
const newKey = () => crypto.randomUUID().slice(0, 8);

/**
 * «Подбор в тесте» (owner request 2026-11-10, D47): the answers of the quiz's first two questions. Goals and skin types
 * can be added, renamed, reordered and deleted; the design's ranking rules are settings of each item.
 */
export function QuizListsPage() {
  const quiz = useQuizLists();
  if (!quiz.data) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-muted">
        {quiz.isError ? copy.errors.load : <Spinner />}
      </div>
    );
  }
  return <QuizForm quiz={quiz.data} />;
}

function QuizForm({ quiz }: { quiz: AdminQuiz }) {
  const save = useSaveQuizLists();
  const [counts, setCounts] = useState(() => usage(quiz));
  const [baseline, setBaseline] = useState(() => toInput(quiz));
  const [form, setForm] = useState(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  useUnsavedGuard(dirty && !save.isPending);

  const update = (next: QuizInput) => {
    setForm(next);
    setSaved(false);
  };
  const setGoal = (index: number, patch: Partial<Goal>) =>
    update({ ...form, goals: form.goals.map((g, i) => (i === index ? { ...g, ...patch } : g)) });
  const setSkin = (index: number, patch: Partial<Skin>) =>
    update({ ...form, skins: form.skins.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

  // A deleted item also leaves the rules of the others, so the save stays valid.
  const removeGoal = (key: string) =>
    update({
      ...form,
      goals: form.goals
        .filter((g) => g.key !== key)
        .map((g) => ({ ...g, related: g.related.filter((k) => k !== key) })),
    });
  const removeSkin = (key: string) =>
    update({
      goals: form.goals.map((g) => ({ ...g, bonusSkins: g.bonusSkins.filter((k) => k !== key) })),
      skins: form.skins
        .filter((s) => s.key !== key)
        .map((s) => ({ ...s, alsoMatches: s.alsoMatches.filter((k) => k !== key) })),
    });

  const submit = () =>
    save.mutate(form, {
      onSuccess: (result) => {
        toast.success(copy.saved);
        const next = toInput(result);
        setCounts(usage(result));
        setBaseline(next);
        setForm(next);
        setErrors({});
        setSaved(true);
      },
      onError: (error) => {
        setErrors(fieldErrors(error));
        toast.error(errorText(error));
      },
    });

  const nameOf = (list: { key: string; name: string }[], key: string) =>
    list.find((item) => item.key === key)?.name.trim() || copy.quizLists.unnamed;

  return (
    <>
      <EditorHeader
        parent={{ to: '/programs', label: copy.nav.programs }}
        title={copy.quizLists.title}
        saved={saved}
        saving={save.isPending}
        dirty={dirty}
        onSave={submit}
      />
      <p className="mt-2 max-w-[760px] text-[15px] leading-normal text-muted">{copy.quizLists.lead}</p>

      <div className="mt-[26px] flex flex-wrap items-start gap-4">
        <Panel
          title={copy.quizLists.goals}
          hint={copy.quizLists.goalsHint}
          className="min-w-0 flex-[1_1_480px]"
        >
          <FieldError error={errors.goals} />
          {form.goals.map((goal, index) => (
            <Item
              key={goal.key}
              testId={`goal-${index}`}
              title={copy.quizLists.goalN(index + 1)}
              programCount={counts.goals.get(goal.key) ?? 0}
              deleteTitle={copy.quizLists.deleteGoalTitle(goal.name.trim() || copy.quizLists.unnamed)}
              deleteText={copy.quizLists.deleteGoalText}
              canDelete={form.goals.length > 1}
              onMove={(delta) => update({ ...form, goals: moveItem(form.goals, index, delta) })}
              onDelete={() => removeGoal(goal.key)}
            >
              <Text
                label={copy.quizLists.name}
                hint={copy.quizLists.goalNameHint}
                error={errors[`goals.${index}.name`]}
              >
                <input
                  value={goal.name}
                  onChange={(e) => setGoal(index, { name: e.target.value })}
                  className={inputClass}
                />
              </Text>
              <Text label={copy.quizLists.answer} error={errors[`goals.${index}.answer`]}>
                <textarea
                  value={goal.answer}
                  onChange={(e) => setGoal(index, { answer: e.target.value })}
                  rows={2}
                  className={textareaClass}
                />
              </Text>
              <Chips
                label={copy.quizLists.related}
                hint={copy.quizLists.relatedHint}
                options={form.goals
                  .filter((other) => other.key !== goal.key)
                  .map((other) => ({ key: other.key, label: nameOf(form.goals, other.key) }))}
                value={goal.related}
                onChange={(related) => setGoal(index, { related })}
              />
              <Chips
                label={copy.quizLists.bonusSkins}
                hint={copy.quizLists.bonusSkinsHint}
                options={form.skins.map((skin) => ({ key: skin.key, label: nameOf(form.skins, skin.key) }))}
                value={goal.bonusSkins}
                onChange={(bonusSkins) => setGoal(index, { bonusSkins })}
              />
            </Item>
          ))}
          {form.goals.length < QUIZ_ITEMS_MAX && (
            <AddButton
              label={copy.quizLists.addGoal}
              onClick={() =>
                update({
                  ...form,
                  goals: [
                    ...form.goals,
                    { key: newKey(), name: '', answer: '', related: [], bonusSkins: [] },
                  ],
                })
              }
            />
          )}
        </Panel>

        <Panel
          title={copy.quizLists.skins}
          hint={copy.quizLists.skinsHint}
          className="min-w-0 flex-[1_1_480px]"
        >
          <FieldError error={errors.skins} />
          {form.skins.map((skin, index) => (
            <Item
              key={skin.key}
              testId={`skin-${index}`}
              title={copy.quizLists.skinN(index + 1)}
              programCount={counts.skins.get(skin.key) ?? 0}
              deleteTitle={copy.quizLists.deleteSkinTitle(skin.name.trim() || copy.quizLists.unnamed)}
              deleteText={copy.quizLists.deleteSkinText}
              canDelete={form.skins.length > 1}
              onMove={(delta) => update({ ...form, skins: moveItem(form.skins, index, delta) })}
              onDelete={() => removeSkin(skin.key)}
            >
              <Text
                label={copy.quizLists.name}
                hint={copy.quizLists.skinNameHint}
                error={errors[`skins.${index}.name`]}
              >
                <input
                  value={skin.name}
                  onChange={(e) => setSkin(index, { name: e.target.value })}
                  className={inputClass}
                />
              </Text>
              <Text label={copy.quizLists.answer} error={errors[`skins.${index}.answer`]}>
                <textarea
                  value={skin.answer}
                  onChange={(e) => setSkin(index, { answer: e.target.value })}
                  rows={2}
                  className={textareaClass}
                />
              </Text>
              <Chips
                label={copy.quizLists.alsoMatches}
                hint={copy.quizLists.alsoMatchesHint}
                options={form.skins
                  .filter((other) => other.key !== skin.key)
                  .map((other) => ({ key: other.key, label: nameOf(form.skins, other.key) }))}
                value={skin.alsoMatches}
                onChange={(alsoMatches) => setSkin(index, { alsoMatches })}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px]">{copy.quizLists.avoidMax}</span>
                  <span className="text-[13px] leading-normal text-muted">{copy.quizLists.avoidMaxHint}</span>
                </div>
                <Toggle
                  checked={skin.avoidMax}
                  onChange={(avoidMax) => setSkin(index, { avoidMax })}
                  label={copy.quizLists.avoidMax}
                />
              </div>
            </Item>
          ))}
          {form.skins.length < QUIZ_ITEMS_MAX && (
            <AddButton
              label={copy.quizLists.addSkin}
              onClick={() =>
                update({
                  ...form,
                  skins: [
                    ...form.skins,
                    { key: newKey(), name: '', answer: '', alsoMatches: [], avoidMax: false },
                  ],
                })
              }
            />
          )}
        </Panel>
      </div>
    </>
  );
}

function usage(quiz: AdminQuiz) {
  return {
    goals: new Map(quiz.goals.map((goal) => [goal.key, goal.programCount])),
    skins: new Map(quiz.skins.map((skin) => [skin.key, skin.programCount])),
  };
}

/** One goal or skin type: order arrows, number, delete (asks first when programs use it), then its fields. */
function Item({
  testId,
  title,
  programCount,
  deleteTitle,
  deleteText,
  canDelete,
  onMove,
  onDelete,
  children,
}: {
  testId: string;
  title: string;
  programCount: number;
  deleteTitle: string;
  deleteText: string;
  canDelete: boolean;
  onMove: (delta: number) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const removeClass =
    'flex size-11 flex-none items-center justify-center rounded-control border border-line text-muted hover:border-[#c5c9da]';
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className="flex flex-col gap-4 rounded-xl border border-line p-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-none">
          <Arrow label={copy.editor.up} dir="up" onClick={() => onMove(-1)} />
          <Arrow label={copy.editor.down} dir="down" onClick={() => onMove(1)} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className="text-[13px] text-muted">{copy.quizLists.usedBy(programCount)}</span>
        </div>
        {canDelete &&
          (programCount > 0 ? (
            <ConfirmDelete
              label={copy.quizLists.remove}
              title={deleteTitle}
              text={`${copy.quizLists.usedBy(programCount)}. ${deleteText}`}
              pending={false}
              onConfirm={onDelete}
              trigger={
                <button
                  type="button"
                  aria-label={copy.quizLists.remove}
                  title={copy.quizLists.remove}
                  className={removeClass}
                >
                  <CloseIcon width={16} height={16} />
                </button>
              }
            />
          ) : (
            <button
              type="button"
              aria-label={copy.quizLists.remove}
              title={copy.quizLists.remove}
              onClick={onDelete}
              className={removeClass}
            >
              <CloseIcon width={16} height={16} />
            </button>
          ))}
      </div>
      {children}
    </section>
  );
}

function Chips({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  options: { key: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((k) => k !== option.key) : [...value, option.key])}
              className={cn(
                'inline-flex min-h-9 items-center rounded-[18px] border px-3.5 py-1 text-left text-sm font-semibold',
                on ? 'border-ink bg-ink text-white' : 'border-input bg-surface text-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <span className="text-[13px] leading-normal text-muted">{hint}</span>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[50px] items-center justify-center gap-2 rounded-xl border border-dashed text-[15px] font-semibold hover:border-dashed-hover"
    >
      <PlusIcon />
      {label}
    </button>
  );
}

function Arrow({ label, dir, onClick }: { label: string; dir: 'up' | 'down'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-control text-muted hover:text-ink"
    >
      <svg
        width="16"
        height="16"
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
