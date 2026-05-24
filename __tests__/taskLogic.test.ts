import { RentalPeriod } from '../lib/rentalLogic';
import { buildCleaningTaskDescription, shouldCreateCleaningTask, sortPendingTasks } from '../lib/taskLogic';
import { HouseTask } from '../app/services/taskService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function task(overrides: Partial<HouseTask> = {}): HouseTask {
  return {
    houseId: 1,
    category: 'cleaning',
    description: 'Test task',
    isUrgent: false,
    isDone: false,
    ...overrides,
  };
}

function rental(overrides: Partial<RentalPeriod> = {}): RentalPeriod {
  return {
    houseId: 1,
    startDate: '2024-07-01',
    endDate: '2024-07-10',
    renterName: 'Ahmed',
    endHalfDay: false,
    ...overrides,
  };
}

// ─── sortPendingTasks ─────────────────────────────────────────────────────────

describe('sortPendingTasks', () => {
  it('places urgent tasks before non-urgent tasks', () => {
    const tasks = [
      task({ id: '1', isUrgent: false, createdAt: '2024-07-10T10:00:00Z' }),
      task({ id: '2', isUrgent: true,  createdAt: '2024-07-09T10:00:00Z' }),
    ];
    const sorted = sortPendingTasks(tasks);
    expect(sorted[0].id).toBe('2'); // urgent first
    expect(sorted[1].id).toBe('1');
  });

  it('sorts non-urgent tasks newest first', () => {
    const tasks = [
      task({ id: 'old', isUrgent: false, createdAt: '2024-07-01T10:00:00Z' }),
      task({ id: 'new', isUrgent: false, createdAt: '2024-07-10T10:00:00Z' }),
    ];
    const sorted = sortPendingTasks(tasks);
    expect(sorted[0].id).toBe('new');
    expect(sorted[1].id).toBe('old');
  });

  it('sorts urgent tasks newest first among themselves', () => {
    const tasks = [
      task({ id: 'u-old', isUrgent: true, createdAt: '2024-07-01T10:00:00Z' }),
      task({ id: 'u-new', isUrgent: true, createdAt: '2024-07-10T10:00:00Z' }),
    ];
    const sorted = sortPendingTasks(tasks);
    expect(sorted[0].id).toBe('u-new');
    expect(sorted[1].id).toBe('u-old');
  });

  it('does not mutate the original array', () => {
    const tasks = [
      task({ id: '1', isUrgent: false }),
      task({ id: '2', isUrgent: true }),
    ];
    const original = [...tasks];
    sortPendingTasks(tasks);
    expect(tasks[0].id).toBe(original[0].id);
    expect(tasks[1].id).toBe(original[1].id);
  });

  it('returns an empty array when given an empty array', () => {
    expect(sortPendingTasks([])).toEqual([]);
  });

  it('handles tasks without createdAt (treats as epoch)', () => {
    const tasks = [
      task({ id: 'no-date', isUrgent: false, createdAt: undefined }),
      task({ id: 'has-date', isUrgent: false, createdAt: '2024-07-10T10:00:00Z' }),
    ];
    const sorted = sortPendingTasks(tasks);
    // has-date is newer than epoch, so it comes first
    expect(sorted[0].id).toBe('has-date');
  });

  it('mixed urgent and non-urgent: all urgent before all non-urgent', () => {
    const tasks = [
      task({ id: 'n1', isUrgent: false, createdAt: '2024-07-10T00:00:00Z' }),
      task({ id: 'u1', isUrgent: true,  createdAt: '2024-07-01T00:00:00Z' }),
      task({ id: 'n2', isUrgent: false, createdAt: '2024-07-05T00:00:00Z' }),
      task({ id: 'u2', isUrgent: true,  createdAt: '2024-07-08T00:00:00Z' }),
    ];
    const sorted = sortPendingTasks(tasks);
    const urgentIds = sorted.filter(t => t.isUrgent).map(t => t.id);
    const normalIds = sorted.filter(t => !t.isUrgent).map(t => t.id);
    // All urgent tasks come before all normal tasks
    const lastUrgentIndex = sorted.findLastIndex(t => t.isUrgent);
    const firstNormalIndex = sorted.findIndex(t => !t.isUrgent);
    expect(lastUrgentIndex).toBeLessThan(firstNormalIndex);
    // Urgent: newest first → u2 before u1
    expect(urgentIds).toEqual(['u2', 'u1']);
    // Normal: newest first → n1 before n2
    expect(normalIds).toEqual(['n1', 'n2']);
  });
});

// ─── buildCleaningTaskDescription ────────────────────────────────────────────

describe('buildCleaningTaskDescription', () => {
  it('includes the renter name', () => {
    const desc = buildCleaningTaskDescription(rental({ renterName: 'Fatma' }));
    expect(desc).toContain('Fatma');
  });

  it('falls back to "locataire" when renterName is missing', () => {
    const desc = buildCleaningTaskDescription(rental({ renterName: undefined }));
    expect(desc).toContain('locataire');
  });

  it('includes "midi" for noon checkout (endHalfDay=true)', () => {
    const desc = buildCleaningTaskDescription(rental({ endHalfDay: true }));
    expect(desc).toContain('midi');
  });

  it('includes "soir" for evening checkout (endHalfDay=false)', () => {
    const desc = buildCleaningTaskDescription(rental({ endHalfDay: false }));
    expect(desc).toContain('soir');
  });

  it('includes the end date formatted in fr-FR', () => {
    // 2024-07-10 → "10/07/2024" in fr-FR
    const desc = buildCleaningTaskDescription(rental({ endDate: '2024-07-10' }));
    expect(desc).toContain('10/07/2024');
  });

  it('starts with "Nettoyage"', () => {
    const desc = buildCleaningTaskDescription(rental());
    expect(desc).toMatch(/^Nettoyage/);
  });
});

// ─── shouldCreateCleaningTask ─────────────────────────────────────────────────

describe('shouldCreateCleaningTask', () => {
  const today = new Date('2024-07-15T00:00:00');

  it('returns true for a rental that ended yesterday', () => {
    const r = rental({ id: 'r1', endDate: '2024-07-14' });
    expect(shouldCreateCleaningTask(r, today)).toBe(true);
  });

  it('returns true for a rental that ends today', () => {
    const r = rental({ id: 'r1', endDate: '2024-07-15' });
    expect(shouldCreateCleaningTask(r, today)).toBe(true);
  });

  it('returns false for a rental that ends tomorrow', () => {
    const r = rental({ id: 'r1', endDate: '2024-07-16' });
    expect(shouldCreateCleaningTask(r, today)).toBe(false);
  });

  it('returns false when rental has no id (local-only, not yet synced)', () => {
    const r = rental({ id: undefined, endDate: '2024-07-10' });
    expect(shouldCreateCleaningTask(r, today)).toBe(false);
  });

  it('returns false for a rental far in the future', () => {
    const r = rental({ id: 'r1', endDate: '2025-12-31' });
    expect(shouldCreateCleaningTask(r, today)).toBe(false);
  });

  it('handles ISO timestamps with time component correctly', () => {
    // End date has a time component — should still compare at day level
    const r = rental({ id: 'r1', endDate: '2024-07-14T23:59:59+01:00' });
    expect(shouldCreateCleaningTask(r, today)).toBe(true);
  });
});
