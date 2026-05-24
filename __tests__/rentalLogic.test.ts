import {
    checkForOverlap,
    isHouseAvailable,
    RentalPeriod,
    toLocalMidnight,
} from '../lib/rentalLogic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal RentalPeriod for house 1. */
function rental(
  startDate: string,
  endDate: string,
  opts: Partial<RentalPeriod> = {}
): RentalPeriod {
  return {
    houseId: 1,
    startDate,
    endDate,
    startHalfDay: false,
    endHalfDay: false,
    ...opts,
  };
}

// ─── toLocalMidnight ──────────────────────────────────────────────────────────

describe('toLocalMidnight', () => {
  it('strips time component from a full ISO string', () => {
    const d = toLocalMidnight('2024-07-15T14:30:00.000Z');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('handles a plain date string', () => {
    const d = toLocalMidnight('2024-07-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(6); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it('two calls with the same date are equal', () => {
    const a = toLocalMidnight('2024-07-15');
    const b = toLocalMidnight('2024-07-15T23:59:59+01:00');
    expect(a.getTime()).toBe(b.getTime());
  });
});

// ─── isHouseAvailable ─────────────────────────────────────────────────────────

describe('isHouseAvailable', () => {
  const periods: RentalPeriod[] = [
    rental('2024-07-10', '2024-07-15'),
  ];

  it('returns true for a date before the rental', () => {
    expect(isHouseAvailable(periods, 1, '2024-07-09')).toBe(true);
  });

  it('returns true for a date after the rental', () => {
    expect(isHouseAvailable(periods, 1, '2024-07-16')).toBe(true);
  });

  it('returns false for a date in the middle of the rental', () => {
    expect(isHouseAvailable(periods, 1, '2024-07-12')).toBe(false);
  });

  it('returns false for the start date (no timeOfDay)', () => {
    expect(isHouseAvailable(periods, 1, '2024-07-10')).toBe(false);
  });

  it('returns false for the end date (no timeOfDay)', () => {
    expect(isHouseAvailable(periods, 1, '2024-07-15')).toBe(false);
  });

  it('returns true for a different house on the same date', () => {
    expect(isHouseAvailable(periods, 2, '2024-07-12')).toBe(true);
  });

  describe('half-day: rental starts PM (startHalfDay=true)', () => {
    const pmStart: RentalPeriod[] = [rental('2024-07-10', '2024-07-15', { startHalfDay: true })];

    it('AM slot on start date is available', () => {
      expect(isHouseAvailable(pmStart, 1, '2024-07-10', 'AM')).toBe(true);
    });

    it('PM slot on start date is NOT available', () => {
      expect(isHouseAvailable(pmStart, 1, '2024-07-10', 'PM')).toBe(false);
    });
  });

  describe('half-day: rental ends AM (endHalfDay=true)', () => {
    const amEnd: RentalPeriod[] = [rental('2024-07-10', '2024-07-15', { endHalfDay: true })];

    it('PM slot on end date is available', () => {
      expect(isHouseAvailable(amEnd, 1, '2024-07-15', 'PM')).toBe(true);
    });

    it('AM slot on end date is NOT available', () => {
      expect(isHouseAvailable(amEnd, 1, '2024-07-15', 'AM')).toBe(false);
    });
  });

  it('returns true when there are no rentals', () => {
    expect(isHouseAvailable([], 1, '2024-07-12')).toBe(true);
  });
});

// ─── checkForOverlap ──────────────────────────────────────────────────────────

describe('checkForOverlap', () => {
  const existing: RentalPeriod[] = [
    rental('2024-07-10', '2024-07-15', { id: 'r1' }),
  ];

  it('returns false when new rental is entirely before existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-01', '2024-07-09', false, false)).toBe(false);
  });

  it('returns false when new rental is entirely after existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-16', '2024-07-20', false, false)).toBe(false);
  });

  it('returns true when new rental overlaps the start of existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-08', '2024-07-11', false, false)).toBe(true);
  });

  it('returns true when new rental overlaps the end of existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-14', '2024-07-18', false, false)).toBe(true);
  });

  it('returns true when new rental is fully inside existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-11', '2024-07-13', false, false)).toBe(true);
  });

  it('returns true when new rental fully contains existing', () => {
    expect(checkForOverlap(existing, 1, '2024-07-08', '2024-07-18', false, false)).toBe(true);
  });

  it('returns false when currentRentalId matches the existing rental (editing same)', () => {
    expect(checkForOverlap(existing, 1, '2024-07-10', '2024-07-15', false, false, 'r1')).toBe(false);
  });

  it('returns false for a different house', () => {
    expect(checkForOverlap(existing, 2, '2024-07-10', '2024-07-15', false, false)).toBe(false);
  });

  describe('adjacent rentals — half-day handoff', () => {
    // Existing rental ends AM on the 15th (endHalfDay=true)
    const amEnd: RentalPeriod[] = [rental('2024-07-10', '2024-07-15', { id: 'r1', endHalfDay: true })];

    it('new rental starting PM on the same day as existing end is NOT a conflict', () => {
      // New: starts PM on 15th (startHalfDay=true)
      expect(checkForOverlap(amEnd, 1, '2024-07-15', '2024-07-20', true, false)).toBe(false);
    });

    it('new rental starting AM on the same day as existing AM-end IS a conflict', () => {
      // New: starts AM on 15th (startHalfDay=false)
      expect(checkForOverlap(amEnd, 1, '2024-07-15', '2024-07-20', false, false)).toBe(true);
    });
  });

  describe('same single-day bookings', () => {
    // Existing: AM-only on the 15th (startHalfDay=false, endHalfDay=true)
    const amOnly: RentalPeriod[] = [rental('2024-07-15', '2024-07-15', { id: 'r1', startHalfDay: false, endHalfDay: true })];

    it('PM-only booking on same day is NOT a conflict', () => {
      expect(checkForOverlap(amOnly, 1, '2024-07-15', '2024-07-15', true, false)).toBe(false);
    });

    it('AM-only booking on same day IS a conflict', () => {
      expect(checkForOverlap(amOnly, 1, '2024-07-15', '2024-07-15', false, true)).toBe(true);
    });

    it('full-day booking on same day IS a conflict', () => {
      expect(checkForOverlap(amOnly, 1, '2024-07-15', '2024-07-15', false, false)).toBe(true);
    });
  });

  it('returns false when there are no existing rentals', () => {
    expect(checkForOverlap([], 1, '2024-07-10', '2024-07-15', false, false)).toBe(false);
  });
});
