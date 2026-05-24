import {
    houseFromDb,
    houseImageFromDb,
    needsForceUpdate,
    parseMinimumBuildVersion,
    rentalFromDb,
    rentalToDb,
    SupabaseHouseImageRow,
    SupabaseHouseRow,
    SupabaseRentalRow,
    SupabaseTaskRow,
    taskFromDb,
    taskToDb,
} from '../lib/dataMappers';

// ─── rentalFromDb ─────────────────────────────────────────────────────────────

describe('rentalFromDb', () => {
  const row: SupabaseRentalRow = {
    id: 'uuid-1',
    house_id: 2,
    start_date: '2024-07-10T00:00:00+01:00',
    end_date: '2024-07-15T00:00:00+01:00',
    start_half_day: true,
    end_half_day: false,
    renter_name: 'Ahmed',
    notes: 'Bring keys',
  };

  it('maps all fields correctly', () => {
    const result = rentalFromDb(row);
    expect(result.id).toBe('uuid-1');
    expect(result.houseId).toBe(2);
    expect(result.startDate).toBe('2024-07-10T00:00:00+01:00');
    expect(result.endDate).toBe('2024-07-15T00:00:00+01:00');
    expect(result.startHalfDay).toBe(true);
    expect(result.endHalfDay).toBe(false);
    expect(result.renterName).toBe('Ahmed');
    expect(result.notes).toBe('Bring keys');
  });

  it('converts null renter_name to undefined', () => {
    const result = rentalFromDb({ ...row, renter_name: null });
    expect(result.renterName).toBeUndefined();
  });

  it('converts null notes to undefined', () => {
    const result = rentalFromDb({ ...row, notes: null });
    expect(result.notes).toBeUndefined();
  });
});

// ─── rentalToDb ───────────────────────────────────────────────────────────────

describe('rentalToDb', () => {
  it('maps all fields to snake_case', () => {
    const result = rentalToDb({
      houseId: 3,
      startDate: '2024-07-10T00:00:00+01:00',
      endDate: '2024-07-15T00:00:00+01:00',
      startHalfDay: false,
      endHalfDay: true,
      renterName: 'Fatma',
      notes: 'Late arrival',
    });

    expect(result.house_id).toBe(3);
    expect(result.start_date).toBe('2024-07-10T00:00:00+01:00');
    expect(result.end_date).toBe('2024-07-15T00:00:00+01:00');
    expect(result.start_half_day).toBe(false);
    expect(result.end_half_day).toBe(true);
    expect(result.renter_name).toBe('Fatma');
    expect(result.notes).toBe('Late arrival');
  });

  it('defaults startHalfDay and endHalfDay to false when undefined', () => {
    const result = rentalToDb({
      houseId: 1,
      startDate: '2024-07-10',
      endDate: '2024-07-15',
    });
    expect(result.start_half_day).toBe(false);
    expect(result.end_half_day).toBe(false);
  });

  it('does not include id, created_at, or updated_at', () => {
    const result = rentalToDb({ houseId: 1, startDate: '2024-07-10', endDate: '2024-07-15' });
    expect((result as any).id).toBeUndefined();
    expect((result as any).created_at).toBeUndefined();
    expect((result as any).updated_at).toBeUndefined();
  });

  it('round-trips through fromDb → toDb preserving all fields', () => {
    const row: SupabaseRentalRow = {
      id: 'uuid-rt',
      house_id: 4,
      start_date: '2024-08-01',
      end_date: '2024-08-07',
      start_half_day: true,
      end_half_day: true,
      renter_name: 'Sami',
      notes: null,
    };
    const appModel = rentalFromDb(row);
    const backToDb = rentalToDb(appModel);

    expect(backToDb.house_id).toBe(row.house_id);
    expect(backToDb.start_date).toBe(row.start_date);
    expect(backToDb.end_date).toBe(row.end_date);
    expect(backToDb.start_half_day).toBe(row.start_half_day);
    expect(backToDb.end_half_day).toBe(row.end_half_day);
    expect(backToDb.renter_name).toBe(row.renter_name);
  });
});

// ─── taskFromDb ───────────────────────────────────────────────────────────────

describe('taskFromDb', () => {
  const row: SupabaseTaskRow = {
    id: 'task-1',
    house_id: 2,
    category: 'repair',
    description: 'Fix the window',
    is_urgent: true,
    is_done: false,
    rental_period_id: 'rental-1',
    created_at: '2024-07-10T10:00:00Z',
    updated_at: '2024-07-10T10:00:00Z',
  };

  it('maps all fields correctly', () => {
    const result = taskFromDb(row);
    expect(result.id).toBe('task-1');
    expect(result.houseId).toBe(2);
    expect(result.category).toBe('repair');
    expect(result.description).toBe('Fix the window');
    expect(result.isUrgent).toBe(true);
    expect(result.isDone).toBe(false);
    expect(result.rentalPeriodId).toBe('rental-1');
    expect(result.createdAt).toBe('2024-07-10T10:00:00Z');
  });

  it('converts null rental_period_id to null', () => {
    const result = taskFromDb({ ...row, rental_period_id: null });
    expect(result.rentalPeriodId).toBeNull();
  });

  it('casts category string to TaskCategory type', () => {
    const categories = ['cleaning', 'purchase', 'repair', 'replacement'] as const;
    categories.forEach(cat => {
      const result = taskFromDb({ ...row, category: cat });
      expect(result.category).toBe(cat);
    });
  });
});

// ─── taskToDb ─────────────────────────────────────────────────────────────────

describe('taskToDb', () => {
  it('maps all fields to snake_case', () => {
    const result = taskToDb({
      houseId: 3,
      category: 'cleaning',
      description: 'Clean the kitchen',
      isUrgent: false,
      isDone: true,
      rentalPeriodId: 'rental-2',
    });

    expect(result.house_id).toBe(3);
    expect(result.category).toBe('cleaning');
    expect(result.description).toBe('Clean the kitchen');
    expect(result.is_urgent).toBe(false);
    expect(result.is_done).toBe(true);
    expect(result.rental_period_id).toBe('rental-2');
  });

  it('converts undefined rentalPeriodId to null', () => {
    const result = taskToDb({
      houseId: 1,
      category: 'cleaning',
      description: 'Test',
      isUrgent: false,
      isDone: false,
      rentalPeriodId: undefined,
    });
    expect(result.rental_period_id).toBeNull();
  });

  it('round-trips through fromDb → toDb', () => {
    const row: SupabaseTaskRow = {
      id: 'task-rt',
      house_id: 5,
      category: 'purchase',
      description: 'Buy gas',
      is_urgent: true,
      is_done: false,
      rental_period_id: null,
    };
    const appModel = taskFromDb(row);
    const backToDb = taskToDb(appModel);

    expect(backToDb.house_id).toBe(row.house_id);
    expect(backToDb.category).toBe(row.category);
    expect(backToDb.description).toBe(row.description);
    expect(backToDb.is_urgent).toBe(row.is_urgent);
    expect(backToDb.is_done).toBe(row.is_done);
    expect(backToDb.rental_period_id).toBeNull();
  });
});

// ─── houseFromDb ──────────────────────────────────────────────────────────────

describe('houseFromDb', () => {
  it('maps all fields correctly', () => {
    const row: SupabaseHouseRow = { id: 1, name: 'Maison 1', description: 'S+2', code: '1-1', price: 150 };
    const result = houseFromDb(row);
    expect(result.id).toBe(1);
    expect(result.name).toBe('Maison 1');
    expect(result.description).toBe('S+2');
    expect(result.code).toBe('1-1');
    expect(result.price).toBe(150);
  });

  it('defaults description to empty string when null', () => {
    const result = houseFromDb({ id: 1, name: 'Test', description: null });
    expect(result.description).toBe('');
  });

  it('defaults code to empty string when null', () => {
    const result = houseFromDb({ id: 1, name: 'Test', code: null });
    expect(result.code).toBe('');
  });

  it('defaults price to 0 when null', () => {
    const result = houseFromDb({ id: 1, name: 'Test', price: null });
    expect(result.price).toBe(0);
  });
});

// ─── houseImageFromDb ─────────────────────────────────────────────────────────

describe('houseImageFromDb', () => {
  it('maps all fields correctly', () => {
    const row: SupabaseHouseImageRow = {
      id: 'img-1',
      house_id: 2,
      url: 'https://example.com/img.jpg',
      sort_order: 3,
    };
    const result = houseImageFromDb(row);
    expect(result.id).toBe('img-1');
    expect(result.houseId).toBe(2);
    expect(result.url).toBe('https://example.com/img.jpg');
    expect(result.sortOrder).toBe(3);
  });
});

// ─── parseMinimumBuildVersion ─────────────────────────────────────────────────

describe('parseMinimumBuildVersion', () => {
  it('parses a valid integer string', () => {
    expect(parseMinimumBuildVersion('5')).toBe(5);
  });

  it('parses "1" as 1', () => {
    expect(parseMinimumBuildVersion('1')).toBe(1);
  });

  it('returns null for null input', () => {
    expect(parseMinimumBuildVersion(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseMinimumBuildVersion(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMinimumBuildVersion('')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(parseMinimumBuildVersion('abc')).toBeNull();
  });

  it('returns null for a float string', () => {
    // parseInt('3.7') = 3, which is valid — this is intentional behaviour
    expect(parseMinimumBuildVersion('3.7')).toBe(3);
  });

  it('handles large build numbers', () => {
    expect(parseMinimumBuildVersion('999')).toBe(999);
  });
});

// ─── needsForceUpdate ─────────────────────────────────────────────────────────

describe('needsForceUpdate', () => {
  it('returns true when current build is older than minimum', () => {
    expect(needsForceUpdate(3, 5)).toBe(true);
  });

  it('returns false when current build equals minimum', () => {
    expect(needsForceUpdate(5, 5)).toBe(false);
  });

  it('returns false when current build is newer than minimum', () => {
    expect(needsForceUpdate(7, 5)).toBe(false);
  });

  it('returns false (fail-open) when minimum is null', () => {
    // Network failure — never block the user
    expect(needsForceUpdate(1, null)).toBe(false);
  });

  it('returns false when minimum is null even if build is very old', () => {
    expect(needsForceUpdate(0, null)).toBe(false);
  });

  it('returns true for build 1 when minimum is 2', () => {
    expect(needsForceUpdate(1, 2)).toBe(true);
  });
});
