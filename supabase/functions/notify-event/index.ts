/**
 * notify-event — Supabase Edge Function
 *
 * Triggered by database webhooks on:
 *   - rental_periods  (INSERT, UPDATE, DELETE)
 *   - house_tasks     (INSERT, UPDATE)
 *
 * Sends a push notification to all registered admin devices via the
 * Expo Push Notification API.
 *
 * Webhook payload shape (Supabase DB webhook):
 * {
 *   type: 'INSERT' | 'UPDATE' | 'DELETE',
 *   table: 'rental_periods' | 'house_tasks',
 *   record: { ...new row }   // null on DELETE
 *   old_record: { ...old row } // null on INSERT
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/api/v2/push/send';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, any> | null;
  old_record: Record<string, any> | null;
}

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, unknown>;
  channelId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all admin push tokens from the database. */
async function fetchAdminTokens(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await supabase
    .from('push_tokens')
    .select('token');

  if (error) {
    console.error('[notify-event] Failed to fetch push tokens:', error);
    return [];
  }

  return (data ?? []).map((row: { token: string }) => row.token);
}

/** Send push messages to a list of Expo tokens. Batches up to 100 per request. */
async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  // Expo recommends batches of ≤100
  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error('[notify-event] Expo push API error:', await response.text());
    }
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

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

  return {
    to: tokens,
    title,
    body,
    sound: 'default',
    channelId: 'default',
    data: { type: 'rental', event: type, houseId },
  };
}

function buildTaskMessage(
  type: 'INSERT' | 'UPDATE',
  record: Record<string, any>,
  old_record: Record<string, any> | null,
  tokens: string[]
): ExpoPushMessage | null {
  // On UPDATE, only notify when is_urgent flips from false/null → true
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

  return {
    to: tokens,
    title,
    body,
    sound: 'default',
    channelId: 'default',
    data: { type: 'task', event: type, houseId, isUrgent },
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();
    const { type, table, record, old_record } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const tokens = await fetchAdminTokens(supabase);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_tokens' }), { status: 200 });
    }

    let message: ExpoPushMessage | null = null;

    if (table === 'rental_periods') {
      message = buildRentalMessage(type, record, old_record, tokens);
    } else if (table === 'house_tasks' && record) {
      message = buildTaskMessage(type as 'INSERT' | 'UPDATE', record, old_record, tokens);
    }

    if (!message) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_message' }), { status: 200 });
    }

    await sendPushNotifications([message]);

    return new Response(JSON.stringify({ sent: tokens.length }), { status: 200 });
  } catch (err) {
    console.error('[notify-event] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
