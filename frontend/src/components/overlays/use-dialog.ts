'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Keeps an overlay mounted while its exit transition runs. `visible` flips one frame after mount so CSS
 * transitions play on enter too.
 */
export function usePresence(open: boolean, exitMs = 360): { mounted: boolean; visible: boolean } {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount first, then animate in on the next frame
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, visible };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;

/**
 * Modal behaviour for a custom dialog: Escape closes, Tab stays inside, focus moves in on open and returns to the
 * trigger on close, and the page behind does not scroll.
 */
export function useModal(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    if (scrollLocks++ === 0) root.style.overflow = 'hidden';

    const focusFirst = window.setTimeout(() => {
      const node = ref.current;
      if (!node || node.contains(document.activeElement)) return;
      const target = node.querySelector<HTMLElement>('[data-autofocus]') ?? node;
      target.focus({ preventScroll: true });
    }, 50);

    const onKey = (event: KeyboardEvent) => {
      const node = ref.current;
      if (!node) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKey);
      if (--scrollLocks === 0) root.style.overflow = '';
      trigger?.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
