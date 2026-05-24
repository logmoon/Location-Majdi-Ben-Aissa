/**
 * rentalLogic.ts
 *
 * Pure functions extracted from RentalContext for testability.
 * No React, no AsyncStorage, no network — just plain logic.
 *
 * RentalContext imports and re-uses these directly so there is
 * no duplication between the context and the test suite.
 */

export interface RentalPeriod {
  id?: string;
  tempId?: string;
  houseId: number;
  startDate: string;
  endDate: string;
  startHalfDay?: boolean;
  endHalfDay?: boolean;
  renterName?: string;
  notes?: string;
}

/**
 * Normalize any date string or ISO timestamp to a local-midnight Date.
 * Avoids UTC-offset issues when dates come from new Date(y,m,d).toISOString()
 * or from Supabase strings like "2024-07-15T00:00:00+01:00".
 */
export function toLocalMidnight(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns true if the house is available on the given date (and optional half-day).
 */
export function isHouseAvailable(
  rentalPeriods: RentalPeriod[],
  houseId: number,
  date: string,
  timeOfDay?: 'AM' | 'PM'
): boolean {
  const dateObj = toLocalMidnight(date);

  const rentalsOnDate = rentalPeriods.filter(rental => {
    const rentalStart = toLocalMidnight(rental.startDate);
    const rentalEnd = toLocalMidnight(rental.endDate);
    return rental.houseId === houseId && dateObj >= rentalStart && dateObj <= rentalEnd;
  });

  if (rentalsOnDate.length === 0) return true;
  if (!timeOfDay) return false;

  for (const rental of rentalsOnDate) {
    const rentalStart = toLocalMidnight(rental.startDate);
    const rentalEnd = toLocalMidnight(rental.endDate);

    if (dateObj.getTime() === rentalStart.getTime()) {
      // Rental starts PM (startHalfDay=true) → AM slot is free
      if (rental.startHalfDay && timeOfDay === 'AM') continue;
      return false;
    }

    if (dateObj.getTime() === rentalEnd.getTime()) {
      // Rental ends AM (endHalfDay=true) → PM slot is free
      if (rental.endHalfDay && timeOfDay === 'PM') continue;
      return false;
    }

    // Middle of a rental — fully occupied
    return false;
  }

  return true;
}

/**
 * Returns true if the proposed date range conflicts with any existing rental
 * for the same house (excluding the rental identified by currentRentalId).
 */
export function checkForOverlap(
  rentalPeriods: RentalPeriod[],
  houseId: number,
  startDate: string,
  endDate: string,
  startHalfDay: boolean,
  endHalfDay: boolean,
  currentRentalId?: string
): boolean {
  const start = toLocalMidnight(startDate);
  const end = toLocalMidnight(endDate);

  const housePeriods = rentalPeriods.filter(r => r.houseId === houseId);

  const currentDate = new Date(start);
  while (currentDate <= end) {
    const isFirstDay = currentDate.getTime() === start.getTime();
    const isLastDay = currentDate.getTime() === end.getTime();

    const conflicting = housePeriods.filter(rental => {
      if (currentRentalId) {
        if (rental.id === currentRentalId || rental.tempId === currentRentalId) return false;
      }

      const rentalStart = toLocalMidnight(rental.startDate);
      const rentalEnd = toLocalMidnight(rental.endDate);

      if (currentDate >= rentalStart && currentDate <= rentalEnd) {
        // Same single-day booking — compatible only if one is AM-only and the other PM-only
        if (
          currentDate.getTime() === rentalStart.getTime() &&
          currentDate.getTime() === rentalEnd.getTime()
        ) {
          const existingIsAmOnly = rental.startHalfDay === false && rental.endHalfDay === true;
          const existingIsPmOnly = rental.startHalfDay === true && rental.endHalfDay === false;
          const newIsAmOnly = startHalfDay === false && endHalfDay === true;
          const newIsPmOnly = startHalfDay === true && endHalfDay === false;
          if ((existingIsAmOnly && newIsPmOnly) || (existingIsPmOnly && newIsAmOnly)) return false;
          return true;
        }

        // Our start day == existing end day: compatible if we start PM and existing ends AM
        if (isFirstDay && currentDate.getTime() === rentalEnd.getTime()) {
          if (startHalfDay && rental.endHalfDay) return false;
        }

        // Our end day == existing start day: compatible if we end AM and existing starts PM
        if (isLastDay && currentDate.getTime() === rentalStart.getTime()) {
          if (endHalfDay && rental.startHalfDay) return false;
        }

        return true; // Conflict
      }

      return false;
    });

    if (conflicting.length > 0) return true;

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return false;
}
