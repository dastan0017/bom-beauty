'use client';

import type { ProgramCard, QuizAnswers, QuizKey } from '@bom/shared';
import { buildQuizMessage, QUIZ_QUESTIONS, rankPrograms, waLink } from '@bom/shared/web';
import { useRef, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { cn } from '@/lib/cn';
import { openExternal, submissionMeta, submit } from '@/lib/submission';
import { productsCount } from '@/lib/words';
import { BbImage } from '../bb-image';
import { Price, useCurrency } from '../currency';
import { ArrowLeftIcon, ChevronRightIcon, SparkleIcon, WhatsAppIcon } from '../icons';
import { CloseButton } from './sheet';
import { useModal, usePresence } from './use-dialog';

export interface QuizState {
  open: boolean;
  step: number;
  answers: Partial<QuizAnswers>;
}

const TOTAL = QUIZ_QUESTIONS.length;

/** «Подобрать программу ухода за 1 минуту»: full-screen dialog, four questions, then up to three programs (README §2). */
export function QuizDialog({
  state,
  programs,
  whatsapp,
  onAnswer,
  onBack,
  onClose,
  onRestart,
  onPick,
}: {
  state: QuizState;
  programs: ProgramCard[];
  whatsapp: string;
  onAnswer: (key: QuizKey, value: string) => void;
  onBack: () => void;
  onClose: () => void;
  onRestart: () => void;
  onPick: (slug: string) => void;
}) {
  const { format } = useCurrency();
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

  // "Спросить Нурайым в WhatsApp": the answers and the suggested programs go to her, and the lead is recorded.
  const handOff = () => {
    const answers = state.answers as QuizAnswers;
    const message = buildQuizMessage(
      answers,
      ranked.map((program) => ({ title: program.title, price: format(program.priceKgs) })),
    );
    openExternal(waLink(whatsapp, message));
    submit('/leads/quiz', { ...submissionMeta(message), answers, choose: true });
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
                      <span className="min-w-0 text-base leading-[1.4] text-pretty">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <SparkleIcon size={28} />
                </span>
                <h2 className="mt-[18px] heading text-[calc(30px*var(--fhk))] leading-[1.1]">
                  {copy.quiz.resultTitle}
                </h2>
                <p className="mt-2.5 text-base leading-normal text-balance text-muted">
                  {copy.quiz.resultLead}
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-2.5">
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
              <SecondaryButton onClick={handOff} className="mt-2.5">
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

/** A suggested program: title, symptom and price, then the product thumbs and «Подробнее» (README §2). */
function ResultCard({
  program,
  primary,
  onPick,
}: {
  program: ProgramCard;
  primary: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex w-full flex-col gap-3 rounded-card bg-surface p-4 text-left transition-colors',
        primary
          ? 'border-[1.5px] border-accent shadow-[0_0_0_4px_var(--halo)]'
          : 'border border-line hover:border-line-hover',
      )}
    >
      {primary && (
        <span className="inline-flex h-[26px] items-center gap-[5px] self-start rounded-full bg-accent-soft px-2.5 text-[13px] font-semibold text-accent-ink">
          <SparkleIcon size={11} />
          {copy.quiz.recommended}
        </span>
      )}
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-lg leading-[1.25] font-semibold">{program.title}</span>
          <span className="text-sm leading-[1.4] text-pretty text-muted">{program.symptom}</span>
        </span>
        <span className="flex-none text-lg leading-[1.25] font-semibold tracking-[-0.01em] whitespace-nowrap">
          <Price kgs={program.priceKgs} />
        </span>
      </span>
      <span className="flex items-center justify-between gap-2.5 border-t border-line-2 pt-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex pl-[7px]">
            {program.thumbs.slice(0, 5).map((thumb) => (
              <span
                key={thumb.slug}
                className="relative -ml-[7px] size-[26px] flex-none overflow-hidden rounded-lg bg-surface-2 shadow-[0_0_0_2px_var(--sf)]"
              >
                <BbImage image={thumb.image} sizes="26px" width={52} alt="" />
              </span>
            ))}
          </span>
          <span className="text-sm whitespace-nowrap text-muted">{productsCount(program.itemCount)}</span>
        </span>
        <span className="flex flex-none items-center gap-0.5 text-sm font-semibold text-accent-ink">
          {copy.quiz.details}
          <ChevronRightIcon size={16} />
        </span>
      </span>
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
