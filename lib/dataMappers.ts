/**
 * dataMappers.ts
 *
 * Pure data-mapping functions extracted from the service layer.
 * These convert between Supabase DB row shapes and the app's model types.
 *
 * Keeping them here (rather than private inside each service) makes them
 * independently testable — a wrong field name causes silent data corruption
 * that only shows up at runtime.
 */

import { House, HouseImage } from '../app/constants/Houses';
import { HouseTask } from '../app/services/taskService';
import { RentalPeriod } from './rentalLogic';

// ─── Rental mappers ───────────────────────────────────────────────────────────

export interface SupabaseRentalRow {
  id: string;
  house_id: number;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  renter_name?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function rentalFromDb(row: SupabaseRentalRow): RentalPeriod & { id: string } {
  return {
    id: row.id,
    houseId: row.house_id,
    startDate: row.start_date,
    endDate: row.end_date,
    startHalfDay: row.start_half_day,
    endHalfDay: row.end_half_day,
    renterName: row.renter_name ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function rentalToDb(
  rental: RentalPeriod
): Omit<SupabaseRentalRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    house_id: rental.houseId,
    start_date: rental.startDate,
    end_date: rental.endDate,
    start_half_day: rental.startHalfDay ?? false,
    end_half_day: rental.endHalfDay ?? false,
    renter_name: rental.renterName,
    notes: rental.notes,
  };
}

// ─── Task mappers ─────────────────────────────────────────────────────────────

export interface SupabaseTaskRow {
  id: string;
  house_id: number;
  category: string;
  description: string;
  is_urgent: boolean;
  is_done: boolean;
  rental_period_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function taskFromDb(row: SupabaseTaskRow): HouseTask {
  return {
    id: row.id,
    houseId: row.house_id,
    category: row.category as HouseTask['category'],
    description: row.description,
    isUrgent: row.is_urgent,
    isDone: row.is_done,
    rentalPeriodId: row.rental_period_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function taskToDb(
  task: HouseTask
): Omit<SupabaseTaskRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    house_id: task.houseId,
    category: task.category,
    description: task.description,
    is_urgent: task.isUrgent,
    is_done: task.isDone,
    rental_period_id: task.rentalPeriodId ?? null,
  };
}

// ─── House mappers ────────────────────────────────────────────────────────────

export interface SupabaseHouseRow {
  id: number;
  name: string;
  description?: string | null;
  code?: string | null;
  price?: number | null;
}

export interface SupabaseHouseImageRow {
  id: string;
  house_id: number;
  url: string;
  sort_order: number;
}

export function houseFromDb(row: SupabaseHouseRow): House {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    code: row.code ?? '',
    price: row.price ?? 0,
  };
}

export function houseImageFromDb(row: SupabaseHouseImageRow): HouseImage {
  return {
    id: row.id,
    houseId: row.house_id,
    url: row.url,
    sortOrder: row.sort_order,
  };
}

// ─── Update service helpers ───────────────────────────────────────────────────

/**
 * Parses a build version string from Supabase app_config.
 * Returns null if the value is missing, empty, or not a valid integer.
 */
export function parseMinimumBuildVersion(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Returns true if the installed build is older than the minimum required.
 * Returns false (fail-open) when minimum is null (network failure, etc.).
 */
export function needsForceUpdate(currentBuild: number, minimum: number | null): boolean {
  if (minimum === null) return false;
  return currentBuild < minimum;
}
