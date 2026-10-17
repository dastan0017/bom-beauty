'use client';

import type { ProgramCard, QuizAnswers, QuizKey } from '@bom/shared';
import {
  buildQuizMessage,
  QUIZ_QUESTIONS,
  quizAnswerLabel,
  quizResultCaption,
  rankPrograms,
  waLink,
} from '@bom/shared/web';
import { useRef, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { openExternal, submissionMeta, submit } from '@/lib/submission';
import { productsCount } from '@/lib/words';
import { BbImage } from '../bb-image';
import { useCurrency } from '../currency';
import { ArrowLeftIcon, ChevronRightIcon, CheckIcon, SparkleIcon, WhatsAppIcon } from '../icons';
import { VideoThumb } from '../video-thumb';
import { CloseButton } from './sheet';
import { useModal, usePresence } from './use-dialog';

export interface QuizState {
  open: boolean;
  step: number;
  answers: Partial<QuizAnswers>;
}

const TOTAL = QUIZ_QUESTIONS.length;

/** "Выбрать программу за 1 минуту": full-screen dialog, four questions, then results (design: qIsQ / qResSet / qResWa). */
export function QuizDialog({
  state,
  programs,
  whatsapp,
  onAnswer,
  onBack,
  onClose,
  onRestart,
  onSeeList,
  onPick,
}: {
  state: QuizState;
  programs: ProgramCard[];
  whatsapp: string;
  onAnswer: (key: QuizKey, value: string) => void;
  onBack: () => void;
  onClose: () => void;
  onRestart: () => void;
  onSeeList: () => void;
  onPick: (slug: string) => void;
}) {
  const { mounted, visible } = usePresence(state.open);
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, state.open, onClose);
  if (!mounted) return null;

  const done = state.step >= TOTAL;
  const question = QUIZ_QUESTIONS[Math.min(state.step, TOTAL - 1)];
  const ranked = rankPrograms(
    programs.map((program) => ({ ...program, quizGoal: program.quiz.goal, quizSkins: program.quiz.skins })),
    state.answers,
  );

  const handOff = (choose: boolean) => {
    const answers = state.answers as QuizAnswers;
    const message = buildQuizMessage(
      answers,
      ranked.map((program) => program.title),
      choose,
    );
    openExternal(waLink(whatsapp, message));
    submit('/leads/quiz', { ...submissionMeta(message), answers, choose });
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={copy.quiz.dialogLabel}
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-bg text-ink transition-transform duration-[360ms] ease-[cubic-bezier(.2,.8,.2,1)] outline-none',
        visible ? 'translate-y-0' : 'translate-y-full',
        !state.open && 'pointer-events-none',
      )}
    >
      <div className="flex flex-col gap-2.5 border-b border-line-2 bg-surface px-3 pt-[calc(8px+env(safe-area-inset-top))] pb-3">
        <div className="mx-auto grid w-full max-w-[640px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="flex min-w-0">
            {state.step > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent-soft pr-4 pl-3 text-[15px] font-semibold text-accent-ink active:scale-[.96]"
              >
                <ArrowLeftIcon size={18} strokeWidth={2.4} />
                {copy.common.back}
              </button>
            )}
          </div>
          <span className="text-sm font-semibold whitespace-nowrap" aria-live="polite">
            {done ? copy.quiz.result : copy.quiz.step(state.step + 1, TOTAL)}
          </span>
          <div className="flex justify-end">
            <CloseButton onClick={onClose} />
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-[640px] grid-cols-4 gap-1" aria-hidden="true">
          {QUIZ_QUESTIONS.map((q, index) => (
            <span
              key={q.key}
              className={cn(
                'block h-1 rounded-full transition-colors duration-[250ms]',
                index <= state.step ? 'bg-accent' : 'bg-line',
              )}
            />
          ))}
        </div>
      </div>

      <div
        key={state.step}
        className="flex-1 overflow-y-auto px-5 pt-6 pb-[calc(32px+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto w-full max-w-[600px]">
          {!done && question ? (
            <>
              {state.step === 0 && (
                <div className="mb-7 flex flex-col items-start gap-2.5">
                  <span className="heading text-[calc(30px*var(--fhk))] leading-[1.1]">
                    {copy.quiz.title}
                  </span>
                  <span className="text-base leading-normal text-pretty text-muted">{copy.quiz.lead}</span>
                </div>
              )}
              <h2 className="heading text-[calc(23px*var(--fhk))] leading-[1.2]">{question.title}</h2>
              <div className="mt-[18px] flex flex-col gap-2.5" role="group" aria-label={question.title}>
                {question.options.map((option) => {
                  const selected = state.answers[question.key] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      data-autofocus={selected || undefined}
                      onClick={() => onAnswer(question.key, option.value)}
                      className={cn(
                        'flex min-h-16 w-full items-center gap-3.5 rounded-card border-[1.5px] px-4 py-3.5 text-left text-ink transition-colors',
                        selected
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface hover:border-line-hover',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-[22px] flex-none items-center justify-center rounded-full border-2',
                          selected ? 'border-accent' : 'border-line-hover',
                        )}
                      >
                        <span
                          className={cn('size-2.5 rounded-full', selected ? 'bg-accent' : 'bg-transparent')}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col gap-[3px]">
                        <span className="text-base leading-[1.3] font-semibold">{option.label}</span>
                        {option.hint && (
                          <span className="text-sm leading-[1.4] text-muted">{option.hint}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : state.answers.fmt === 'wa' ? (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="mt-2 flex size-[68px] items-center justify-center rounded-full bg-success-soft text-success-ink">
                  <CheckIcon size={30} strokeWidth={2.6} />
                </span>
                <h2 className="mt-5 heading text-[calc(28px*var(--fhk))] leading-[1.12]">
                  {copy.quiz.doneTitle}
                </h2>
                <p className="mt-2.5 text-base leading-normal text-balance text-muted">
                  {copy.quiz.doneText}
                </p>
              </div>
              <dl className="mt-6 flex flex-col rounded-card border border-line bg-surface">
                {(
                  [
                    [copy.quiz.summary.skin, quizAnswerLabel('skin', state.answers.skin)],
                    [copy.quiz.summary.goal, quizAnswerLabel('goal', state.answers.goal)],
                    [copy.quiz.summary.exp, quizAnswerLabel('exp', state.answers.exp)],
                    [copy.quiz.summary.program, ranked[0]?.title ?? '—'],
                  ] as const
                ).map(([key, value], index) => (
                  <div
                    key={key}
                    className={cn(
                      'flex flex-col gap-[3px] px-[18px] py-3.5',
                      index > 0 && 'border-t border-line-2',
                    )}
                  >
                    <dt className="text-[13px] text-muted">{key}</dt>
                    <dd className="text-[15px] leading-[1.35] font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => handOff(false)}
                className="mt-6 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-button bg-accent px-[22px] text-[17px] font-semibold text-white shadow-[0_18px_32px_-14px_var(--acsh)] hover:brightness-[.94]"
              >
                <WhatsAppIcon size={20} />
                {copy.quiz.getReview}
              </button>
              <SecondaryButton onClick={onSeeList}>{copy.quiz.seeList}</SecondaryButton>
              <RestartButton onClick={onRestart} />
            </>
          ) : (
            <>
              <h2 className="heading text-[calc(28px*var(--fhk))] leading-[1.12]">{copy.quiz.resultTitle}</h2>
              <p className="mt-2 text-[15px] leading-[1.45] text-muted">{quizResultCaption(state.answers)}</p>
              <div className="mt-[22px] flex flex-col gap-2.5">
                {ranked.map((program, index) => (
                  <div key={program.slug} className="contents">
                    {index === 1 && (
                      <span className="mt-3.5 block text-[15px] font-semibold text-muted">
                        {copy.quiz.alternatives}
                      </span>
                    )}
                    <ResultCard program={program} primary={index === 0} onPick={() => onPick(program.slug)} />
                  </div>
                ))}
              </div>
              <p className="mt-7 text-center text-[15px] text-muted">{copy.quiz.unsure}</p>
              <SecondaryButton onClick={() => handOff(true)} className="mt-2.5">
                <WhatsAppIcon size={18} className="text-whatsapp" />
                {copy.quiz.askNurai}
              </SecondaryButton>
              <RestartButton onClick={onRestart} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  program,
  primary,
  onPick,
}: {
  program: ProgramCard;
  primary: boolean;
  onPick: () => void;
}) {
  const { format } = useCurrency();
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-card bg-surface p-3 text-left transition-colors',
        primary ? 'border-[1.5px] border-accent' : 'border border-line hover:border-line-hover',
      )}
    >
      <VideoThumb program={program} className={primary ? 'h-[90px] w-[68px]' : 'h-20 w-[60px]'} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {primary ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-accent-soft px-2 text-xs font-semibold text-accent-ink">
              <SparkleIcon size={10} />
              {copy.quiz.recommended}
            </span>
            {program.badge && <span className="text-xs font-semibold text-muted">{program.badge}</span>}
          </span>
        ) : (
          program.badge && <span className="text-xs font-semibold text-muted">{program.badge}</span>
        )}
        <span className={cn('leading-[1.3] font-semibold', primary ? 'text-[17px]' : 'text-base')}>
          {program.title}
        </span>
        <span className="text-[15px] leading-[1.35] font-semibold">{format(program.priceKgs)}</span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="flex pl-[7px]">
            {program.thumbs.map((thumb) => (
              <span
                key={thumb.slug}
                className="relative -ml-[7px] size-6 flex-none overflow-hidden rounded-[7px] bg-surface-2 shadow-[0_0_0_2px_var(--sf)]"
              >
                <BbImage image={thumb.image} sizes="24px" width={48} alt="" />
              </span>
            ))}
          </span>
          <span className="text-[13px] whitespace-nowrap text-muted">{productsCount(program.itemCount)}</span>
        </span>
      </span>
      <ChevronRightIcon size={18} className="flex-none text-muted" />
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mt-2.5 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-button border border-line bg-surface px-5 text-base font-semibold text-ink hover:border-line-hover',
        className,
      )}
    >
      {children}
    </button>
  );
}

function RestartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 block h-12 w-full text-[15px] font-semibold text-muted"
    >
      {copy.quiz.restart}
    </button>
  );
}
