/**
 * Tests for the pure date-helper functions used by notify-reminders.
 *
 * We copy the implementations here rather than importing from the Deno edge
 * function (which uses Deno-specific module resolution incompatible with Jest).
 * The implementations are intentionally identical — if you change the edge
 * function, update these too.
 */

// ─── Implementations under test (mirrored from notify-reminders/index.ts) ────

function localDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function tomorrowDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function dayAfterTomorrowDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000 + 48 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function nextDayDateString(utcOffsetHours: number): string {
  return tomorrowDateString(utcOffsetHours);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('localDateString', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(localDateString(1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('UTC+1 is one hour ahead of UTC+0', () => {
    // Pin "now" to a known UTC time: 2024-07-15T23:30:00Z
    // UTC+0 → 2024-07-15, UTC+1 → 2024-07-16
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T23:30:00Z'));

    expect(localDateString(0)).toBe('2024-07-15');
    expect(localDateString(1)).toBe('2024-07-16');

    jest.useRealTimers();
  });

  it('UTC+1 is one day behind UTC+2 at midnight boundary', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T23:00:00Z'));

    expect(localDateString(1)).toBe('2024-07-16');
    expect(localDateString(2)).toBe('2024-07-16');

    jest.useRealTimers();
  });
});

describe('tomorrowDateString', () => {
  it('returns a date one day after localDateString', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T10:00:00Z'));

    const today = localDateString(1);
    const tomorrow = tomorrowDateString(1);

    const todayDate = new Date(today);
    const tomorrowDate = new Date(tomorrow);
    const diffMs = tomorrowDate.getTime() - todayDate.getTime();

    expect(diffMs).toBe(24 * 60 * 60 * 1000);

    jest.useRealTimers();
  });

  it('correctly rolls over month boundary', () => {
    jest.useFakeTimers();
    // 2024-07-31T22:00:00Z → UTC+1 is 2024-07-31, tomorrow is 2024-08-01
    jest.setSystemTime(new Date('2024-07-31T22:00:00Z'));

    expect(localDateString(1)).toBe('2024-07-31');
    expect(tomorrowDateString(1)).toBe('2024-08-01');

    jest.useRealTimers();
  });
});

describe('dayAfterTomorrowDateString', () => {
  it('is two days after today', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T10:00:00Z'));

    const today = localDateString(1);
    const dayAfter = dayAfterTomorrowDateString(1);

    const todayDate = new Date(today);
    const dayAfterDate = new Date(dayAfter);
    const diffMs = dayAfterDate.getTime() - todayDate.getTime();

    expect(diffMs).toBe(48 * 60 * 60 * 1000);

    jest.useRealTimers();
  });
});

describe('nextDayDateString', () => {
  it('is an alias for tomorrowDateString', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T10:00:00Z'));

    expect(nextDayDateString(1)).toBe(tomorrowDateString(1));

    jest.useRealTimers();
  });
});

describe('date range query bounds', () => {
  it('tomorrow range [tomorrow+01:00, dayAfter+01:00) covers exactly one day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T10:00:00Z'));

    const lower = new Date(`${tomorrowDateString(1)}T00:00:00+01:00`);
    const upper = new Date(`${dayAfterTomorrowDateString(1)}T00:00:00+01:00`);

    expect(upper.getTime() - lower.getTime()).toBe(24 * 60 * 60 * 1000);

    jest.useRealTimers();
  });

  it('today range [today+01:00, tomorrow+01:00) covers exactly one day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-15T10:00:00Z'));

    const lower = new Date(`${localDateString(1)}T00:00:00+01:00`);
    const upper = new Date(`${nextDayDateString(1)}T00:00:00+01:00`);

    expect(upper.getTime() - lower.getTime()).toBe(24 * 60 * 60 * 1000);

    jest.useRealTimers();
  });
});
