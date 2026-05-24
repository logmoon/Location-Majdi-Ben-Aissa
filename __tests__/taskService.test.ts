/**
 * taskService tests
 */

import { createSupabaseMock } from './helpers/supabaseMock';

const { builder, setResponse, resetBuilder } = createSupabaseMock();

jest.mock('../lib/supabase', () => ({
  supabase: builder,
  getAdminClient: () => builder,
  default:  { supabase: builder },
}));

import type { HouseTask } from '../app/services/taskService';
import { taskService } from '../app/services/taskService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const dbRow = {
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

const appTask: HouseTask = {
  houseId: 2,
  category: 'repair',
  description: 'Fix the window',
  isUrgent: true,
  isDone: false,
  rentalPeriodId: 'rental-1',
};

beforeEach(() => resetBuilder());

// ─── fetchTasksForHouse ───────────────────────────────────────────────────────

describe('taskService.fetchTasksForHouse', () => {
  it('returns mapped tasks on success', async () => {
    setResponse([dbRow]);

    const result = await taskService.fetchTasksForHouse(2);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-1');
    expect(result[0].houseId).toBe(2);
    expect(result[0].category).toBe('repair');
    expect(result[0].description).toBe('Fix the window');
    expect(result[0].isUrgent).toBe(true);
    expect(result[0].isDone).toBe(false);
    expect(result[0].rentalPeriodId).toBe('rental-1');
    expect(result[0].createdAt).toBe('2024-07-10T10:00:00Z');
  });

  it('returns [] on error', async () => {
    setResponse(null, { message: 'DB error' });
    expect(await taskService.fetchTasksForHouse(2)).toEqual([]);
  });

  it('returns [] when data is empty', async () => {
    setResponse([]);
    expect(await taskService.fetchTasksForHouse(2)).toEqual([]);
  });

  it('filters by house_id', async () => {
    setResponse([]);
    await taskService.fetchTasksForHouse(3);
    expect(builder.eq).toHaveBeenCalledWith('house_id', 3);
  });

  it('orders by created_at descending', async () => {
    setResponse([]);
    await taskService.fetchTasksForHouse(2);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('maps null rental_period_id to null', async () => {
    setResponse([{ ...dbRow, rental_period_id: null }]);
    const result = await taskService.fetchTasksForHouse(2);
    expect(result[0].rentalPeriodId).toBeNull();
  });
});

// ─── fetchAllTasks ────────────────────────────────────────────────────────────

describe('taskService.fetchAllTasks', () => {
  it('returns all tasks without a house_id filter', async () => {
    setResponse([dbRow, { ...dbRow, id: 'task-2', house_id: 5 }]);
    const result = await taskService.fetchAllTasks();
    expect(result).toHaveLength(2);
    expect(builder.eq).not.toHaveBeenCalled();
  });

  it('returns [] on error', async () => {
    setResponse(null, { message: 'error' });
    expect(await taskService.fetchAllTasks()).toEqual([]);
  });

  it('calls from("house_tasks")', async () => {
    setResponse([]);
    await taskService.fetchAllTasks();
    expect(builder.from).toHaveBeenCalledWith('house_tasks');
  });
});

// ─── addTask ──────────────────────────────────────────────────────────────────

describe('taskService.addTask', () => {
  it('returns the new id on success', async () => {
    setResponse({ id: 'new-task-id' });
    expect(await taskService.addTask(appTask)).toBe('new-task-id');
  });

  it('returns null on error', async () => {
    setResponse(null, { message: 'Insert failed' });
    expect(await taskService.addTask(appTask)).toBeNull();
  });

  it('returns null when data is null with no error', async () => {
    setResponse(null);
    expect(await taskService.addTask(appTask)).toBeNull();
  });

  it('calls .insert with correct snake_case payload', async () => {
    setResponse({ id: 'x' });
    await taskService.addTask(appTask);
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        house_id: 2, category: 'repair', description: 'Fix the window',
        is_urgent: true, is_done: false, rental_period_id: 'rental-1',
      })
    );
  });

  it('converts undefined rentalPeriodId to null in payload', async () => {
    setResponse({ id: 'x' });
    await taskService.addTask({ ...appTask, rentalPeriodId: undefined });
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ rental_period_id: null })
    );
  });
});

// ─── updateTask ───────────────────────────────────────────────────────────────

describe('taskService.updateTask', () => {
  it('returns true on success', async () => {
    setResponse(null);
    expect(await taskService.updateTask('task-1', { isDone: true })).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Update failed' });
    expect(await taskService.updateTask('task-1', { isDone: true })).toBe(false);
  });

  it('calls .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await taskService.updateTask('task-1', { isDone: true });
    expect(builder.eq).toHaveBeenCalledWith('id', 'task-1');
  });

  it('only sends is_done when only isDone is provided', async () => {
    setResponse(null);
    await taskService.updateTask('task-1', { isDone: true });
    expect(builder.update).toHaveBeenCalledWith({ is_done: true });
  });

  it('only sends is_urgent when only isUrgent is provided', async () => {
    setResponse(null);
    await taskService.updateTask('task-1', { isUrgent: false });
    expect(builder.update).toHaveBeenCalledWith({ is_urgent: false });
  });

  it('sends multiple fields when multiple are provided', async () => {
    setResponse(null);
    await taskService.updateTask('task-1', {
      category: 'cleaning', description: 'New desc', isUrgent: true, isDone: false,
    });
    expect(builder.update).toHaveBeenCalledWith({
      category: 'cleaning', description: 'New desc', is_urgent: true, is_done: false,
    });
  });

  it('does NOT send fields that are undefined in the partial update', async () => {
    setResponse(null);
    await taskService.updateTask('task-1', { isDone: true });
    const payload = builder.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('category');
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('is_urgent');
  });
});

// ─── deleteTask ───────────────────────────────────────────────────────────────

describe('taskService.deleteTask', () => {
  it('returns true on success', async () => {
    setResponse(null);
    expect(await taskService.deleteTask('task-1')).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Delete failed' });
    expect(await taskService.deleteTask('task-1')).toBe(false);
  });

  it('calls .delete() then .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await taskService.deleteTask('task-1');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'task-1');
  });

  it('calls from("house_tasks")', async () => {
    setResponse(null);
    await taskService.deleteTask('task-1');
    expect(builder.from).toHaveBeenCalledWith('house_tasks');
  });
});

// ─── cleaningTaskExistsForRental ──────────────────────────────────────────────

describe('taskService.cleaningTaskExistsForRental', () => {
  it('returns true when a matching task exists', async () => {
    setResponse([{ id: 'task-1' }]);
    expect(await taskService.cleaningTaskExistsForRental('rental-1')).toBe(true);
  });

  it('returns false when no matching task exists', async () => {
    setResponse([]);
    expect(await taskService.cleaningTaskExistsForRental('rental-1')).toBe(false);
  });

  it('returns false on error (fail-safe)', async () => {
    setResponse(null, { message: 'DB error' });
    expect(await taskService.cleaningTaskExistsForRental('rental-1')).toBe(false);
  });

  it('filters by rental_period_id', async () => {
    setResponse([]);
    await taskService.cleaningTaskExistsForRental('rental-abc');
    expect(builder.eq).toHaveBeenCalledWith('rental_period_id', 'rental-abc');
  });

  it('filters by category "cleaning"', async () => {
    setResponse([]);
    await taskService.cleaningTaskExistsForRental('rental-1');
    expect(builder.eq).toHaveBeenCalledWith('category', 'cleaning');
  });

  it('applies a limit of 1', async () => {
    setResponse([]);
    await taskService.cleaningTaskExistsForRental('rental-1');
    expect(builder.limit).toHaveBeenCalledWith(1);
  });
});
