'use client';

import type { ProgramCard, QuizKey } from '@bom/shared';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { captureAttribution, flushOutbox } from '@/lib/submission';
import { CurrencyProvider, type CurrencyOption } from '../currency';
import type { OrderItem, OrderRequest } from './order-sheet';
import { QuizDialog, type QuizState } from './quiz-dialog';
import { VideoPlayer, type VideoSpec } from './video-player';

export type { OrderItem, VideoSpec };

// The order sheet carries the form validation (zod schemas, phone parsing). It loads in the background once the page
// is idle, or at the first "Заказать", so it never weighs on the first render.
const OrderSheet = dynamic(() => import('./order-sheet').then((module) => module.OrderSheet), { ssr: false });

interface Overlays {
  whatsapp: string;
  programsCount: number;
  openOrder: (item: OrderItem, options?: { qty?: number; fromQuiz?: boolean }) => void;
  openQuiz: () => void;
  /** Back to the results of a finished quiz (header pill, "К результатам теста"). */
  returnToQuiz: () => void;
  /** The quiz has results to return to. */
  quizDone: boolean;
  /** Program the visitor opened from the quiz results. */
  quizPickedSlug: string | null;
  quizPillHidden: boolean;
  hideQuizPill: () => void;
  openVideo: (spec: VideoSpec) => void;
  /** Some overlay is open (sticky bars hide meanwhile). */
  busy: boolean;
  /** Path of the previous page in this visit (product back link: "К программе"). */
  previousPath: string | null;
}

const OverlaysContext = createContext<Overlays | null>(null);

export function useOverlays(): Overlays {
  const value = use(OverlaysContext);
  if (!value) throw new Error('useOverlays outside SiteOverlays');
  return value;
}

const QUIZ_STORAGE = 'bb-quiz';
const QUIZ_TOTAL = 4;

interface StoredQuiz {
  answers: QuizState['answers'];
  pickedSlug: string | null;
}

/** Client state shared by every page: currency, order sheet, quiz and video player (rendered once in the layout). */
export function SiteOverlays({
  whatsapp,
  currencies,
  programs,
  turnstileSiteKey,
  children,
}: {
  whatsapp: string;
  currencies: CurrencyOption[];
  programs: ProgramCard[];
  turnstileSiteKey: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderSheetWanted, setOrderSheetWanted] = useState(false);
  const [quiz, setQuiz] = useState<QuizState>({ open: false, step: 0, answers: {} });
  const [quizPickedSlug, setQuizPickedSlug] = useState<string | null>(null);
  const [quizPillHidden, setQuizPillHidden] = useState(false);
  const [video, setVideo] = useState<VideoSpec | null>(null);
  const advance = useRef<number | undefined>(undefined);
  const [paths, setPaths] = useState<{ current: string; previous: string | null }>({
    current: pathname,
    previous: null,
  });
  if (paths.current !== pathname) setPaths({ current: pathname, previous: paths.current });

  const quizDone = QUIZ_TOTAL === Object.keys(quiz.answers).length;

  useEffect(() => {
    captureAttribution();
    flushOutbox();
    try {
      const raw = sessionStorage.getItem(QUIZ_STORAGE);
      if (raw) {
        const stored = JSON.parse(raw) as StoredQuiz;
        /* eslint-disable react-hooks/set-state-in-effect -- restore the finished quiz after a reload */
        setQuiz((current) => ({ ...current, answers: stored.answers, step: QUIZ_TOTAL }));
        setQuizPickedSlug(stored.pickedSlug);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // Nothing to restore.
    }
  }, []);

  useEffect(() => {
    if (!quizDone) return;
    try {
      sessionStorage.setItem(
        QUIZ_STORAGE,
        JSON.stringify({ answers: quiz.answers, pickedSlug: quizPickedSlug }),
      );
    } catch {
      // Storage unavailable: the results last for this page view.
    }
  }, [quizDone, quiz.answers, quizPickedSlug]);

  // Navigation closes the order sheet and the player.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- route change closes overlays */
    setOrderOpen(false);
    setVideo(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  useEffect(() => () => window.clearTimeout(advance.current), []);

  // Background load of the order sheet: after the page has loaded and settled, so it never competes with the first
  // render (the browser is often "idle" while still waiting on the network).
  useEffect(() => {
    let timer = 0;
    let idle = 0;
    const load = () => setOrderSheetWanted(true);
    const schedule = () => {
      timer = window.setTimeout(() => {
        // Safari before 18.2 has no requestIdleCallback.
        if (typeof window.requestIdleCallback === 'function')
          idle = window.requestIdleCallback(load, { timeout: 3000 });
        else load();
      }, 1500);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.removeEventListener('load', schedule);
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, []);

  const openOrder = useCallback<Overlays['openOrder']>((item, options) => {
    setVideo(null);
    setOrder({ item, qty: options?.qty ?? 1, fromQuiz: options?.fromQuiz ?? false });
    setOrderOpen(true);
    setOrderSheetWanted(true);
  }, []);

  const openQuiz = useCallback(() => {
    window.clearTimeout(advance.current);
    setVideo(null);
    setOrderOpen(false);
    setQuizPickedSlug(null);
    setQuizPillHidden(false);
    try {
      sessionStorage.removeItem(QUIZ_STORAGE);
    } catch {
      // Ignore.
    }
    setQuiz({ open: true, step: 0, answers: {} });
  }, []);

  const returnToQuiz = useCallback(() => {
    window.clearTimeout(advance.current);
    setVideo(null);
    setQuiz((current) => ({ ...current, open: true, step: QUIZ_TOTAL }));
  }, []);

  const value = useMemo<Overlays>(
    () => ({
      whatsapp,
      programsCount: programs.length,
      openOrder,
      openQuiz,
      returnToQuiz,
      quizDone,
      quizPickedSlug,
      quizPillHidden,
      hideQuizPill: () => setQuizPillHidden(true),
      openVideo: (spec) => {
        setOrderOpen(false);
        setVideo(spec);
      },
      busy: orderOpen || quiz.open || video !== null,
      previousPath: paths.previous,
    }),
    [
      whatsapp,
      programs.length,
      openOrder,
      openQuiz,
      returnToQuiz,
      quizDone,
      quizPickedSlug,
      quizPillHidden,
      orderOpen,
      quiz.open,
      video,
      paths.previous,
    ],
  );

  return (
    <CurrencyProvider options={currencies}>
      <OverlaysContext value={value}>
        {children}
        {orderSheetWanted && (
          <OrderSheet
            request={order}
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            whatsapp={whatsapp}
            turnstileSiteKey={turnstileSiteKey}
          />
        )}
        <QuizDialog
          state={quiz}
          programs={programs}
          whatsapp={whatsapp}
          onAnswer={(key: QuizKey, answer) => {
            window.clearTimeout(advance.current);
            setQuiz((current) => ({ ...current, answers: { ...current.answers, [key]: answer } }));
            // Auto-advance after a short pause so the choice is visible (design: 300 ms).
            advance.current = window.setTimeout(() => {
              setQuiz((current) => ({ ...current, step: Math.min(QUIZ_TOTAL, current.step + 1) }));
              setQuizPillHidden(false);
            }, 300);
          }}
          onBack={() => {
            window.clearTimeout(advance.current);
            setQuiz((current) => ({ ...current, step: Math.max(0, current.step - 1) }));
          }}
          onClose={() => {
            window.clearTimeout(advance.current);
            setQuiz((current) => ({ ...current, open: false }));
          }}
          onRestart={openQuiz}
          onSeeList={() =>
            setQuiz((current) => ({ ...current, answers: { ...current.answers, fmt: 'set' } }))
          }
          onPick={(slug) => {
            setQuizPickedSlug(slug);
            setQuiz((current) => ({ ...current, open: false }));
            router.push(`/programs/${slug}`);
          }}
        />
        <VideoPlayer spec={video} onClose={() => setVideo(null)} />
      </OverlaysContext>
    </CurrencyProvider>
  );
}
