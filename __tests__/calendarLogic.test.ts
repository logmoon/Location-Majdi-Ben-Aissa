import {
    buildCalendarDays,
    getCalendarRowCount,
    getDaysInMonth,
    getFirstDayOfMonth,
} from '../lib/calendarLogic';

// ─── getDaysInMonth ───────────────────────────────────────────────────────────

describe('getDaysInMonth', () => {
  it('returns 31 for January', () => {
    expect(getDaysInMonth(0, 2024)).toBe(31);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(getDaysInMonth(1, 2023)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(getDaysInMonth(1, 2024)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(getDaysInMonth(3, 2024)).toBe(30);
  });

  it('returns 31 for December', () => {
    expect(getDaysInMonth(11, 2024)).toBe(31);
  });

  it('handles year boundary correctly (December 2023 → 31 days)', () => {
    expect(getDaysInMonth(11, 2023)).toBe(31);
  });
});

// ─── getFirstDayOfMonth ───────────────────────────────────────────────────────

describe('getFirstDayOfMonth', () => {
  // 2024-01-01 is a Monday → index 0 in Mon-first calendar
  it('returns 0 (Monday) for January 2024', () => {
    expect(getFirstDayOfMonth(0, 2024)).toBe(0);
  });

  // 2024-02-01 is a Thursday → index 3
  it('returns 3 (Thursday) for February 2024', () => {
    expect(getFirstDayOfMonth(1, 2024)).toBe(3);
  });

  // 2024-09-01 is a Sunday → index 6 in Mon-first calendar
  it('returns 6 (Sunday) for September 2024', () => {
    expect(getFirstDayOfMonth(8, 2024)).toBe(6);
  });

  // 2024-07-01 is a Monday → index 0
  it('returns 0 (Monday) for July 2024', () => {
    expect(getFirstDayOfMonth(6, 2024)).toBe(0);
  });

  // 2023-01-01 is a Sunday → index 6
  it('returns 6 (Sunday) for January 2023', () => {
    expect(getFirstDayOfMonth(0, 2023)).toBe(6);
  });

  it('always returns a value between 0 and 6', () => {
    for (let month = 0; month < 12; month++) {
      const result = getFirstDayOfMonth(month, 2024);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    }
  });
});

// ─── buildCalendarDays ────────────────────────────────────────────────────────

describe('buildCalendarDays', () => {
  it('starts with the correct number of null leading cells', () => {
    // January 2024 starts on Monday (0 leading nulls)
    const jan = buildCalendarDays(0, 2024);
    expect(jan[0]).toBe(1); // no leading nulls

    // February 2024 starts on Thursday (3 leading nulls)
    const feb = buildCalendarDays(1, 2024);
    expect(feb[0]).toBeNull();
    expect(feb[1]).toBeNull();
    expect(feb[2]).toBeNull();
    expect(feb[3]).toBe(1);
  });

  it('contains the correct total number of day cells', () => {
    // January 2024: 31 days, 0 leading nulls → 31 total
    const jan = buildCalendarDays(0, 2024);
    const janDays = jan.filter(d => d !== null);
    expect(janDays).toHaveLength(31);

    // February 2024: 29 days (leap), 3 leading nulls → 32 total
    const feb = buildCalendarDays(1, 2024);
    const febDays = feb.filter(d => d !== null);
    expect(febDays).toHaveLength(29);
  });

  it('day numbers are sequential starting from 1', () => {
    const days = buildCalendarDays(0, 2024).filter((d): d is number => d !== null);
    days.forEach((d, i) => expect(d).toBe(i + 1));
  });

  it('last day equals getDaysInMonth', () => {
    const days = buildCalendarDays(1, 2024).filter((d): d is number => d !== null);
    expect(days[days.length - 1]).toBe(getDaysInMonth(1, 2024));
  });

  it('September 2024 (starts Sunday) has 6 leading nulls', () => {
    const sep = buildCalendarDays(8, 2024);
    const leadingNulls = sep.filter(d => d === null).length;
    // Sunday = index 6 in Mon-first calendar
    expect(leadingNulls).toBe(6);
    expect(sep[6]).toBe(1);
  });
});

// ─── getCalendarRowCount ──────────────────────────────────────────────────────

describe('getCalendarRowCount', () => {
  it('January 2024 (31 days, starts Mon) fits in 5 rows', () => {
    expect(getCalendarRowCount(0, 2024)).toBe(5);
  });

  it('September 2024 (30 days, starts Sun) needs 6 rows', () => {
    // 6 leading nulls + 30 days = 36 cells → ceil(36/7) = 6
    expect(getCalendarRowCount(8, 2024)).toBe(6);
  });

  it('February 2021 (28 days, starts Mon) fits in 4 rows', () => {
    // 0 leading nulls + 28 days = 28 cells → ceil(28/7) = 4
    expect(getCalendarRowCount(1, 2021)).toBe(4);
  });

  it('always returns between 4 and 6', () => {
    for (let month = 0; month < 12; month++) {
      const rows = getCalendarRowCount(month, 2024);
      expect(rows).toBeGreaterThanOrEqual(4);
      expect(rows).toBeLessThanOrEqual(6);
    }
  });
});
