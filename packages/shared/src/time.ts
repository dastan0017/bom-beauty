// Asia/Bishkek is UTC+6 all year (no DST since 2005), so plain offset arithmetic is exact.

export const BISHKEK_OFFSET_MS = 6 * 3_600_000;
const DAY_MS = 86_400_000;

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/** Wall-clock parts of an instant in Bishkek. */
function parts(date: Date) {
  const local = new Date(date.getTime() + BISHKEK_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
    hours: local.getUTCHours(),
    minutes: local.getUTCMinutes(),
  };
}

/** Midnight in Bishkek of the day containing `date`, as a UTC instant. */
export function bishkekDayStart(date: Date): Date {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month, day) - BISHKEK_OFFSET_MS);
}

/** Midnight in Bishkek of a "YYYY-MM-DD" date. */
export function bishkekDateStart(isoDate: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - BISHKEK_OFFSET_MS);
}

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

const pad = (n: number): string => String(n).padStart(2, '0');

/** "14:05" */
export function bishkekTime(date: Date): string {
  const { hours, minutes } = parts(date);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "17.10.2026 14:05" (CSV export). */
export function bishkekDateTime(date: Date): string {
  const { year, month, day } = parts(date);
  return `${pad(day)}.${pad(month + 1)}.${year} ${bishkekTime(date)}`;
}

/** "Сегодня, 12:41", "Вчера, 18:20" or "14 окт, 10:05" (design: o.date + ', ' + o.time). */
export function relativeDateTime(date: Date, now = new Date()): string {
  const today = bishkekDayStart(now).getTime();
  const day = bishkekDayStart(date).getTime();
  const time = bishkekTime(date);
  if (day === today) return `Сегодня, ${time}`;
  if (day === today - DAY_MS) return `Вчера, ${time}`;
  const { day: d, month, year } = parts(date);
  const sameYear = year === parts(now).year;
  return `${d} ${MONTHS_SHORT[month] ?? ''}${sameYear ? '' : ` ${year}`}, ${time}`;
}

/** "Вторник, 13 октября" (admin overview heading). */
export function longDate(date: Date): string {
  const { weekday, day, month } = parts(date);
  return `${WEEKDAYS[weekday] ?? ''}, ${day} ${MONTHS_GENITIVE[month] ?? ''}`;
}

/** Hour of day in Bishkek, for "Доброе утро/день/вечер". */
export const bishkekHour = (date: Date): number => parts(date).hours;
