/**
 * Tests for the message-builder logic in notify-event.
 *
 * Same approach as notifyReminders.test.ts — we mirror the pure functions
 * here to avoid Deno module resolution issues in Jest.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, unknown>;
  channelId?: string;
}

// ─── Implementations under test (mirrored from notify-event/index.ts) ─────────

function buildRentalMessage(
  type: 'INSERT' | 'UPDATE' | 'DELETE',
  record: Record<string, any> | null,
  old_record: Record<string, any> | null,
  tokens: string[]
): ExpoPushMessage | null {
  const row = record ?? old_record;
  if (!row) return null;

  const renter = row.renter_name || 'Locataire';
  const startDate = new Date(row.start_date).toLocaleDateString('fr-FR');
  const endDate = new Date(row.end_date).toLocaleDateString('fr-FR');
  const houseId = row.house_id;

  let title: string;
  let body: string;

  switch (type) {
    case 'INSERT':
      title = `Maison ${houseId} — Nouvelle location`;
      body = `${renter} · ${startDate} → ${endDate}`;
      break;
    case 'UPDATE':
      title = `Maison ${houseId} — Location modifiée`;
      body = `${renter} · ${startDate} → ${endDate}`;
      break;
    case 'DELETE':
      title = `Maison ${houseId} — Location annulée`;
      body = `${renter} · ${startDate} → ${endDate}`;
      break;
    default:
      return null;
  }

  return { to: tokens, title, body, sound: 'default', channelId: 'default', data: { type: 'rental', event: type, houseId } };
}

function buildTaskMessage(
  type: 'INSERT' | 'UPDATE',
  record: Record<string, any>,
  old_record: Record<string, any> | null,
  tokens: string[]
): ExpoPushMessage | null {
  if (type === 'UPDATE') {
    const wasUrgent = old_record?.is_urgent === true;
    const isNowUrgent = record.is_urgent === true;
    if (!(!wasUrgent && isNowUrgent)) return null;
  }

  const houseId = record.house_id;
  const description = record.description || '';
  const isUrgent = record.is_urgent;
  const category = record.category;

  const categoryLabels: Record<string, string> = {
    cleaning: 'Nettoyage',
    purchase: 'Achat',
    repair: 'Réparation',
    replacement: 'Remplacement',
  };
  const categoryLabel = categoryLabels[category] ?? category;

  const urgentPrefix = isUrgent ? '🚨 ' : '';
  const title = `${urgentPrefix}Maison ${houseId} — ${categoryLabel}`;
  const body = description.length > 80 ? description.slice(0, 77) + '...' : description;

  return { to: tokens, title, body, sound: 'default', channelId: 'default', data: { type: 'task', event: type, houseId, isUrgent } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const TOKENS = ['ExponentPushToken[abc123]'];

const rentalRow = {
  house_id: 2,
  renter_name: 'Ahmed',
  start_date: '2024-07-10T00:00:00+01:00',
  end_date: '2024-07-15T00:00:00+01:00',
};

describe('buildRentalMessage', () => {
  it('builds an INSERT message with correct title', () => {
    const msg = buildRentalMessage('INSERT', rentalRow, null, TOKENS);
    expect(msg).not.toBeNull();
    expect(msg!.title).toBe('Maison 2 — Nouvelle location');
  });

  it('builds an UPDATE message with correct title', () => {
    const msg = buildRentalMessage('UPDATE', rentalRow, null, TOKENS);
    expect(msg!.title).toBe('Maison 2 — Location modifiée');
  });

  it('builds a DELETE message using old_record when record is null', () => {
    const msg = buildRentalMessage('DELETE', null, rentalRow, TOKENS);
    expect(msg).not.toBeNull();
    expect(msg!.title).toBe('Maison 2 — Location annulée');
  });

  it('falls back to "Locataire" when renter_name is missing', () => {
    const row = { ...rentalRow, renter_name: null };
    const msg = buildRentalMessage('INSERT', row, null, TOKENS);
    expect(msg!.body).toContain('Locataire');
  });

  it('returns null when both record and old_record are null', () => {
    const msg = buildRentalMessage('DELETE', null, null, TOKENS);
    expect(msg).toBeNull();
  });

  it('sends to the provided tokens', () => {
    const msg = buildRentalMessage('INSERT', rentalRow, null, TOKENS);
    expect(msg!.to).toEqual(TOKENS);
  });

  it('includes houseId in data payload', () => {
    const msg = buildRentalMessage('INSERT', rentalRow, null, TOKENS);
    expect(msg!.data?.houseId).toBe(2);
  });
});

describe('buildTaskMessage', () => {
  const taskRow = {
    house_id: 3,
    description: 'Fix the broken window',
    is_urgent: false,
    category: 'repair',
  };

  it('builds an INSERT message for a normal task', () => {
    const msg = buildTaskMessage('INSERT', taskRow, null, TOKENS);
    expect(msg).not.toBeNull();
    expect(msg!.title).toBe('Maison 3 — Réparation');
  });

  it('prefixes title with 🚨 for urgent tasks', () => {
    const urgentRow = { ...taskRow, is_urgent: true };
    const msg = buildTaskMessage('INSERT', urgentRow, null, TOKENS);
    expect(msg!.title).toMatch(/^🚨/);
  });

  it('truncates description longer than 80 chars', () => {
    const longDesc = 'A'.repeat(90);
    const msg = buildTaskMessage('INSERT', { ...taskRow, description: longDesc }, null, TOKENS);
    expect(msg!.body.length).toBeLessThanOrEqual(80);
    expect(msg!.body).toMatch(/\.\.\.$/);
  });

  it('does not truncate description of exactly 80 chars', () => {
    const desc = 'A'.repeat(80);
    const msg = buildTaskMessage('INSERT', { ...taskRow, description: desc }, null, TOKENS);
    expect(msg!.body).toBe(desc);
  });

  it('uses raw category string when category is unknown', () => {
    const msg = buildTaskMessage('INSERT', { ...taskRow, category: 'inspection' }, null, TOKENS);
    expect(msg!.title).toContain('inspection');
  });

  describe('UPDATE — urgent-flip logic', () => {
    it('returns null when task was already urgent (no flip)', () => {
      const msg = buildTaskMessage(
        'UPDATE',
        { ...taskRow, is_urgent: true },
        { ...taskRow, is_urgent: true }, // was already urgent
        TOKENS
      );
      expect(msg).toBeNull();
    });

    it('returns null when task is still not urgent', () => {
      const msg = buildTaskMessage(
        'UPDATE',
        { ...taskRow, is_urgent: false },
        { ...taskRow, is_urgent: false },
        TOKENS
      );
      expect(msg).toBeNull();
    });

    it('returns a message when task flips from non-urgent to urgent', () => {
      const msg = buildTaskMessage(
        'UPDATE',
        { ...taskRow, is_urgent: true },
        { ...taskRow, is_urgent: false }, // was not urgent
        TOKENS
      );
      expect(msg).not.toBeNull();
      expect(msg!.title).toMatch(/^🚨/);
    });

    it('treats null old_record.is_urgent as non-urgent (flip fires)', () => {
      const msg = buildTaskMessage(
        'UPDATE',
        { ...taskRow, is_urgent: true },
        { ...taskRow, is_urgent: null },
        TOKENS
      );
      expect(msg).not.toBeNull();
    });

    it('returns null when flipping from urgent to non-urgent', () => {
      const msg = buildTaskMessage(
        'UPDATE',
        { ...taskRow, is_urgent: false },
        { ...taskRow, is_urgent: true }, // was urgent, now not
        TOKENS
      );
      expect(msg).toBeNull();
    });
  });
});
