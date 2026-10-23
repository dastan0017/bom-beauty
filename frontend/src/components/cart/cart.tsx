'use client';

import type { ImageRef } from '@bom/shared';
import { LINE_QTY_MAX } from '@bom/shared/web';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

// The visitor's cart (design/updates-2026-10/README.md §7.1): products only, 1–20 of each, kept in localStorage so it
// survives reloads, emptied after a cart order is sent. Programs are ordered directly and never enter the cart.

const STORAGE_KEY = 'bb-cart';

/** What a cart line needs to show itself; the layout passes the published catalog, so prices stay current. */
export interface CartProduct {
  slug: string;
  name: string;
  brand: string;
  volume: string;
  priceKgs: number;
  image: ImageRef | null;
}

export interface CartLine extends CartProduct {
  qty: number;
  totalKgs: number;
}

interface StoredLine {
  slug: string;
  qty: number;
}

interface CartValue {
  lines: CartLine[];
  /** Units in the cart ("Корзина · 3 товара"). */
  count: number;
  totalKgs: number;
  qtyOf: (slug: string) => number;
  /** Adds `qty` (default 1) of a product, up to the line limit. */
  add: (slug: string, qty?: number) => void;
  /** Sets a line's quantity; 0 removes it. */
  setQty: (slug: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

const clampQty = (qty: number): number => Math.max(0, Math.min(LINE_QTY_MAX, Math.round(qty)));

function readStored(): StoredLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return [];
      const { slug, qty } = entry as Partial<StoredLine>;
      return typeof slug === 'string' && typeof qty === 'number' && clampQty(qty) > 0
        ? [{ slug, qty: clampQty(qty) }]
        : [];
    });
  } catch {
    return [];
  }
}

function writeStored(lines: StoredLine[]): void {
  try {
    if (lines.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the cart lasts for this page view.
  }
}

export function CartProvider({ products, children }: { products: CartProduct[]; children: ReactNode }) {
  const [stored, setStored] = useState<StoredLine[]>([]);

  // localStorage is only readable after hydration; another tab's changes arrive through the storage event.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved cart after hydration
    setStored(readStored());
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setStored(readStored());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const update = useCallback((change: (lines: StoredLine[]) => StoredLine[]) => {
    setStored((current) => {
      const next = change(current).filter((line) => line.qty > 0);
      writeStored(next);
      return next;
    });
  }, []);

  const add = useCallback<CartValue['add']>(
    (slug, qty = 1) =>
      update((lines) =>
        lines.some((line) => line.slug === slug)
          ? lines.map((line) => (line.slug === slug ? { slug, qty: clampQty(line.qty + qty) } : line))
          : [...lines, { slug, qty: clampQty(qty) }],
      ),
    [update],
  );

  const setQty = useCallback<CartValue['setQty']>(
    (slug, qty) =>
      update((lines) => lines.map((line) => (line.slug === slug ? { slug, qty: clampQty(qty) } : line))),
    [update],
  );

  // Storage first: a clear on page load (a paid online order) must win over the restore effect above.
  const clear = useCallback(() => {
    writeStored([]);
    setStored([]);
  }, []);

  const value = useMemo<CartValue>(() => {
    const bySlug = new Map(products.map((product) => [product.slug, product]));
    // Products that are no longer on the site drop out of view; the stored line stays until the cart changes.
    const lines = stored.flatMap((line) => {
      const product = bySlug.get(line.slug);
      return product ? [{ ...product, qty: line.qty, totalKgs: product.priceKgs * line.qty }] : [];
    });
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.qty, 0),
      totalKgs: lines.reduce((sum, line) => sum + line.totalKgs, 0),
      qtyOf: (slug) => lines.find((line) => line.slug === slug)?.qty ?? 0,
      add,
      setQty,
      clear,
    };
  }, [products, stored, add, setQty, clear]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = use(CartContext);
  if (!value) throw new Error('useCart outside CartProvider');
  return value;
}
