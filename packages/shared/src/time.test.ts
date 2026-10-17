import { describe, expect, it } from 'vitest';
import { bishkekDateStart, bishkekDateTime, bishkekDayStart, longDate, relativeDateTime } from './time';
import { cityOf } from './schemas/admin';

describe('Asia/Bishkek time', () => {
  // 2026-10-17 20:30 UTC is 18 Oct 02:30 in Bishkek.
  const lateEvening = new Date('2026-10-17T20:30:00Z');

  it('starts the day at local midnight', () => {
    expect(bishkekDayStart(lateEvening).toISOString()).toBe('2026-10-17T18:00:00.000Z');
    expect(bishkekDateStart('2026-10-18').toISOString()).toBe('2026-10-17T18:00:00.000Z');
  });

  it('formats for CSV and the admin lists', () => {
    expect(bishkekDateTime(lateEvening)).toBe('18.10.2026 02:30');
    const now = new Date('2026-10-18T06:00:00Z');
    expect(relativeDateTime(lateEvening, now)).toBe('Сегодня, 02:30');
    expect(relativeDateTime(new Date('2026-10-17T05:20:00Z'), now)).toBe('Вчера, 11:20');
    expect(relativeDateTime(new Date('2026-10-14T04:05:00Z'), now)).toBe('14 окт, 10:05');
    expect(relativeDateTime(new Date('2025-12-31T04:05:00Z'), now)).toBe('31 дек 2025, 10:05');
    expect(longDate(new Date('2026-10-13T06:00:00Z'))).toBe('Вторник, 13 октября');
  });

  it('takes the city from the address', () => {
    expect(cityOf('Бишкек, ул. Киевская, 10')).toBe('Бишкек');
    expect(cityOf('  Ош ')).toBe('Ош');
  });
});
