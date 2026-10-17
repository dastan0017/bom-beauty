import { plural, productsWord, stepsWord } from '@bom/shared';

// Counted phrases from the design ("5 средств", "3 шага").

export const productsCount = (n: number): string => `${n} ${productsWord(n)}`;
export const stepsCount = (n: number): string => `${n} ${stepsWord(n)}`;

/** "4 готовые программы ухода" (video end card). */
export const readyProgramsCount = (n: number): string =>
  `${n} ${plural(n, 'готовая программа', 'готовые программы', 'готовых программ')} ухода`;

/** "3:05" from seconds. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "3 мин" from seconds, at least one minute. */
export const formatMinutes = (seconds: number): number => Math.max(1, Math.round(seconds / 60));

/** "1,2 МБ" for the protocol PDF. */
export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

/** "из 5 средств", "из 1 средства" (genitive after "из"). */
export const productsGenitive = (n: number): string =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'средства' : 'средств'}`;
