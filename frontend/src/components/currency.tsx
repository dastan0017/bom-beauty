'use client';

import type { CurrencyCode } from '@bom/shared';
import { CURRENCIES, formatKgs, formatPrice } from '@bom/shared/web';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

// Visitor's display currency (docs/ARCHITECTURE.md §6.2). Prices render in сом on the server; after hydration
// <Price> switches to the currency kept in localStorage, using the owner's rates from /settings/public.

const STORAGE_KEY = 'bb-currency';

export interface CurrencyOption {
  code: CurrencyCode;
  rate: number;
}

interface CurrencyContextValue {
  code: CurrencyCode;
  rate: number;
  options: CurrencyOption[];
  setCode: (code: CurrencyCode) => void;
  /** Formats a сом amount in the visitor's currency. */
  format: (kgs: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ options, children }: { options: CurrencyOption[]; children: ReactNode }) {
  const [code, setCodeState] = useState<CurrencyCode>('KGS');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
      if (saved && saved !== 'KGS' && options.some((option) => option.code === saved)) setCodeState(saved);
    } catch {
      // Storage unavailable: stay on сом.
    }
  }, [options]);

  const setCode = useCallback((next: CurrencyCode) => {
    setCodeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore: the choice lasts for this page view.
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const rate = options.find((option) => option.code === code)?.rate ?? 1;
    return {
      code,
      rate,
      options,
      setCode,
      format: (kgs) => (code === 'KGS' ? formatKgs(kgs) : formatPrice(kgs, code, rate)),
    };
  }, [code, options, setCode]);

  return <CurrencyContext value={value}>{children}</CurrencyContext>;
}

export function useCurrency(): CurrencyContextValue {
  const value = use(CurrencyContext);
  if (!value) throw new Error('useCurrency outside CurrencyProvider');
  return value;
}

/** A сом price shown in the visitor's currency. */
export function Price({ kgs }: { kgs: number }) {
  const { format } = useCurrency();
  return <>{format(kgs)}</>;
}

export const currencySymbol = (code: CurrencyCode): string => CURRENCIES[code].symbol;
