/**
 * rentalService tests
 */

import { createSupabaseMock } from './helpers/supabaseMock';

const { builder, setResponse, resetBuilder } = createSupabaseMock();

jest.mock('../lib/supabase', () => ({
  supabase: builder,
  getAdminClient: () => builder,
  default:  { supabase: builder },
}));

import { rentalService } from '../app/services/rentalService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const dbRow = {
  id: 'uuid-1',
  house_id: 2,
  start_date: '2024-07-10T00:00:00+01:00',
  end_date:   '2024-07-15T00:00:00+01:00',
  start_half_day: true,
  end_half_day:   false,
  renter_name: 'Ahmed',
  notes: 'Ground floor',
};

const appRental = {
  houseId:      2,
  startDate:    '2024-07-10T00:00:00+01:00',
  endDate:      '2024-07-15T00:00:00+01:00',
  startHalfDay: true,
  endHalfDay:   false,
  renterName:   'Ahmed',
  notes:        'Ground floor',
};

beforeEach(() => resetBuilder());

// ─── fetchRentalPeriods ───────────────────────────────────────────────────────

describe('rentalService.fetchRentalPeriods', () => {
  it('returns mapped rental periods on success', async () => {
    setResponse([dbRow]);

    const result = await rentalService.fetchRentalPeriods(0);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-1');
    expect(result[0].houseId).toBe(2);
    expect(result[0].startDate).toBe('2024-07-10T00:00:00+01:00');
    expect(result[0].endDate).toBe('2024-07-15T00:00:00+01:00');
    expect(result[0].startHalfDay).toBe(true);
    expect(result[0].endHalfDay).toBe(false);
    expect(result[0].renterName).toBe('Ahmed');
    expect(result[0].notes).toBe('Ground floor');
  });

  it('returns [] on error (no retries)', async () => {
    setResponse(null, { message: 'DB error' });
    expect(await rentalService.fetchRentalPeriods(0)).toEqual([]);
  });

  it('returns [] when data is empty', async () => {
    setResponse([]);
    expect(await rentalService.fetchRentalPeriods(0)).toEqual([]);
  });

  it('maps multiple rows correctly', async () => {
    const row2 = { ...dbRow, id: 'uuid-2', house_id: 3, renter_name: 'Fatma' };
    setResponse([dbRow, row2]);

    const result = await rentalService.fetchRentalPeriods(0);

    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('uuid-2');
    expect(result[1].houseId).toBe(3);
    expect(result[1].renterName).toBe('Fatma');
  });

  it('calls from("rental_periods")', async () => {
    setResponse([]);
    await rentalService.fetchRentalPeriods(0);
    expect(builder.from).toHaveBeenCalledWith('rental_periods');
  });

  it('calls .select("*")', async () => {
    setResponse([]);
    await rentalService.fetchRentalPeriods(0);
    expect(builder.select).toHaveBeenCalledWith('*');
  });
});

// ─── addRentalPeriod ──────────────────────────────────────────────────────────

describe('rentalService.addRentalPeriod', () => {
  it('returns the new id on success', async () => {
    setResponse({ id: 'new-uuid' });
    expect(await rentalService.addRentalPeriod(appRental, 0)).toBe('new-uuid');
  });

  it('returns null on error', async () => {
    setResponse(null, { message: 'Insert failed' });
    expect(await rentalService.addRentalPeriod(appRental, 0)).toBeNull();
  });

  it('returns null when data is null with no error', async () => {
    setResponse(null);
    expect(await rentalService.addRentalPeriod(appRental, 0)).toBeNull();
  });

  it('calls from("rental_periods")', async () => {
    setResponse({ id: 'x' });
    await rentalService.addRentalPeriod(appRental, 0);
    expect(builder.from).toHaveBeenCalledWith('rental_periods');
  });

  it('calls .insert with snake_case payload', async () => {
    setResponse({ id: 'x' });
    await rentalService.addRentalPeriod(appRental, 0);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        house_id: 2, start_date: '2024-07-10T00:00:00+01:00',
        end_date: '2024-07-15T00:00:00+01:00', start_half_day: true,
        end_half_day: false, renter_name: 'Ahmed', notes: 'Ground floor',
      })
    );
  });

  it('defaults start_half_day and end_half_day to false when not provided', async () => {
    setResponse({ id: 'x' });
    await rentalService.addRentalPeriod(
      { houseId: 1, startDate: '2024-07-01', endDate: '2024-07-05' }, 0
    );
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ start_half_day: false, end_half_day: false })
    );
  });
});

// ─── updateRentalPeriod ───────────────────────────────────────────────────────

describe('rentalService.updateRentalPeriod', () => {
  it('returns true on success', async () => {
    setResponse(null);
    expect(await rentalService.updateRentalPeriod('uuid-1', appRental, 0)).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Update failed' });
    expect(await rentalService.updateRentalPeriod('uuid-1', appRental, 0)).toBe(false);
  });

  it('calls .update with snake_case payload', async () => {
    setResponse(null);
    await rentalService.updateRentalPeriod('uuid-1', appRental, 0);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ house_id: 2, start_date: '2024-07-10T00:00:00+01:00', renter_name: 'Ahmed' })
    );
  });

  it('calls .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await rentalService.updateRentalPeriod('uuid-1', appRental, 0);
    expect(builder.eq).toHaveBeenCalledWith('id', 'uuid-1');
  });
});

// ─── removeRentalPeriod ───────────────────────────────────────────────────────

describe('rentalService.removeRentalPeriod', () => {
  it('returns true on success', async () => {
    setResponse(null);
    expect(await rentalService.removeRentalPeriod('uuid-1', 0)).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Delete failed' });
    expect(await rentalService.removeRentalPeriod('uuid-1', 0)).toBe(false);
  });

  it('calls .delete() then .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await rentalService.removeRentalPeriod('uuid-1', 0);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'uuid-1');
  });

  it('calls from("rental_periods")', async () => {
    setResponse(null);
    await rentalService.removeRentalPeriod('uuid-1', 0);
    expect(builder.from).toHaveBeenCalledWith('rental_periods');
  });
});

// ─── retry behaviour ──────────────────────────────────────────────────────────

describe('retry behaviour', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fetchRentalPeriods retries once and succeeds on second attempt', async () => {
    let callCount = 0;
    builder.then.mockImplementation((resolve: (v: any) => any) => {
      callCount++;
      const response = callCount === 1
        ? { data: null, error: { message: 'Transient' } }
        : { data: [dbRow], error: null };
      return Promise.resolve(response).then(resolve);
    });

    const promise = rentalService.fetchRentalPeriods(1);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-1');
  }, 10000);

  it('fetchRentalPeriods returns [] after exhausting all retries', async () => {
    builder.then.mockImplementation((resolve: (v: any) => any) =>
      Promise.resolve({ data: null, error: { message: 'Persistent' } }).then(resolve)
    );

    const promise = rentalService.fetchRentalPeriods(2);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([]);
  }, 10000);
});
