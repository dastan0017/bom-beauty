const NBSP = '\u00a0';

/**
 * Groups thousands with a no-break space ("5 900"). Hand-written instead of Intl so that
 * Node and every browser produce the same string (no hydration mismatches).
 */
export function groupThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** "5 900 сом" */
export function formatKgs(kgs: number): string {
  return `${groupThousands(kgs)}${NBSP}сом`;
}
