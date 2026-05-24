/**
 * calendarLogic.ts
 *
 * Pure calendar grid helpers extracted from RentalCalendar.tsx.
 * No React, no React Native — plain date math.
 */

/**
 * Returns the number of days in a given month.
 * @param month 0-indexed (0 = January, 11 = December)
 * @param year  Full year (e.g. 2024)
 */
export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the 0-indexed weekday of the first day of the month,
 * using a Monday-first European calendar (Mon=0 … Sun=6).
 * @param month 0-indexed
 * @param year  Full year
 */
export function getFirstDayOfMonth(month: number, year: number): number {
  const day = new Date(year, month, 1).getDay(); // 0=Sun … 6=Sat
  return day === 0 ? 6 : day - 1;               // shift to Mon=0 … Sun=6
}

/**
 * Builds the flat array of day numbers (or null for leading empty cells)
 * that the calendar grid renders.
 *
 * Example for a month starting on Wednesday (getFirstDayOfMonth = 2):
 *   [null, null, 1, 2, 3, …, 30]
 */
export function buildCalendarDays(month: number, year: number): (number | null)[] {
  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);

  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  return days;
}

/**
 * Returns the total number of rows (weeks) needed to display the month.
 * Each row is 7 cells; leading nulls count as cells.
 */
export function getCalendarRowCount(month: number, year: number): number {
  const total = getDaysInMonth(month, year) + getFirstDayOfMonth(month, year);
  return Math.ceil(total / 7);
}
