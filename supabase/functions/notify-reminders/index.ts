/**
 * notify-reminders — Supabase Edge Function (cron)
 *
 * Runs on a schedule to send time-based rental reminders to all admin devices.
 *
 * Called by three cron jobs (SQL Snippet type) using net.http_post with a JSON body:
 *
 *   checkin-reminder   → 50 8 * * *  (08:50 UTC = 09:50 Tunisia UTC+1)
 *     body: {"reminder_type": "checkin"}
 *     → Finds rentals starting tomorrow, notifies admins day-before at ~10:00
 *
 *   checkout-noon      → 50 10 * * * (10:50 UTC = 11:50 Tunisia)
 *     body: {"reminder_type": "checkout_noon"}
 *     → Finds today's noon checkouts (endHalfDay = true)
 *
 *   checkout-evening   → 50 16 * * * (16:50 UTC = 17:50 Tunisia)
 *     body: {"reminder_type": "checkout_evening"}
 *     → Finds today's evening checkouts (endHalfDay = false)
 *
 * Tunisia is UTC+1 year-round (no DST). Adjust cron times if your timezone differs.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/api/v2/push/send';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderType = 'checkin' | 'checkout_noon' | 'checkout_evening';

interface RentalRow {
  id: string;
  house_id: number;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  renter_name: string | null;
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

async function fetchAdminTokens(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await supabase.from('push_tokens').select('token');
  if (error) {
    console.error('[notify-reminders] Failed to fetch tokens:', error);
    return [];
  }
  return (data ?? []).map((r: { token: string }) => r.token);
}

/**
 * Returns a "YYYY-MM-DD" date string for today in the given UTC offset.
 * Using explicit offset arithmetic avoids relying on the runtime's local
 * timezone, which may differ from Tunisia (UTC+1, no DST).
 */
export function localDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/**
 * Returns the "YYYY-MM-DD" date string for tomorrow in the given UTC offset.
 */
export function tomorrowDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/**
 * Returns the "YYYY-MM-DD" date string for the day after tomorrow in the given UTC offset.
 * Used as the exclusive upper bound for tomorrow's date range queries.
 */
export function dayAfterTomorrowDateString(utcOffsetHours: number): string {
  const now = new Date();
  const local = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000 + 48 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/**
 * Returns the "YYYY-MM-DD" date string for tomorrow, used as the exclusive
 * upper bound for today's date range queries.
 */
export function nextDayDateString(utcOffsetHours: number): string {
  return tomorrowDateString(utcOffsetHours);
}

async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
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
      console.error('[notify-reminders] Expo push API error:', await response.text());
    }
  }
}

// ─── Reminder handlers ────────────────────────────────────────────────────────

/** Day-before check-in reminder. Finds rentals starting tomorrow. */
async function handleCheckin(
  supabase: ReturnType<typeof createClient>,
  tokens: string[]
): Promise<number> {
  const tomorrow = tomorrowDateString(1);         // UTC+1 Tunisia
  const dayAfter = dayAfterTomorrowDateString(1); // exclusive upper bound

  const { data, error } = await supabase
    .from('rental_periods')
    .select('id, house_id, start_date, end_date, start_half_day, renter_name')
    .gte('start_date', `${tomorrow}T00:00:00+01:00`)
    .lt('start_date', `${dayAfter}T00:00:00+01:00`);

  if (error || !data?.length) return 0;

  const messages: ExpoPushMessage[] = (data as RentalRow[]).map(rental => {
    const renter = rental.renter_name || 'Locataire';
    const arrivalLabel = rental.start_half_day ? 'à midi' : 'dans la matinée';
    return {
      to: tokens,
      title: `Maison ${rental.house_id} — Location demain`,
      body: `${renter} arrive ${arrivalLabel}. Pensez à préparer la maison.`,
      sound: 'default',
      channelId: 'default',
      data: { type: 'reminder', reminderType: 'checkin', houseId: rental.house_id },
    };
  });

  await sendPushNotifications(messages);
  return messages.length;
}

/** Checkout reminder for noon checkouts (endHalfDay = true). */
async function handleCheckoutNoon(
  supabase: ReturnType<typeof createClient>,
  tokens: string[]
): Promise<number> {
  const today = localDateString(1);
  const tomorrow = nextDayDateString(1); // exclusive upper bound

  const { data, error } = await supabase
    .from('rental_periods')
    .select('id, house_id, end_date, end_half_day, renter_name')
    .gte('end_date', `${today}T00:00:00+01:00`)
    .lt('end_date', `${tomorrow}T00:00:00+01:00`)
    .eq('end_half_day', true);

  if (error || !data?.length) return 0;

  const messages: ExpoPushMessage[] = (data as RentalRow[]).map(rental => {
    const renter = rental.renter_name || 'Locataire';
    return {
      to: tokens,
      title: `Maison ${rental.house_id} — Départ à midi`,
      body: `La location de ${renter} se termine à midi. Vérifiez l'état de la maison.`,
      sound: 'default',
      channelId: 'default',
      data: { type: 'reminder', reminderType: 'checkout_noon', houseId: rental.house_id },
    };
  });

  await sendPushNotifications(messages);
  return messages.length;
}

/** Checkout reminder for evening checkouts (endHalfDay = false). */
async function handleCheckoutEvening(
  supabase: ReturnType<typeof createClient>,
  tokens: string[]
): Promise<number> {
  const today = localDateString(1);
  const tomorrow = nextDayDateString(1); // exclusive upper bound

  const { data, error } = await supabase
    .from('rental_periods')
    .select('id, house_id, end_date, end_half_day, renter_name')
    .gte('end_date', `${today}T00:00:00+01:00`)
    .lt('end_date', `${tomorrow}T00:00:00+01:00`)
    .eq('end_half_day', false);

  if (error || !data?.length) return 0;

  const messages: ExpoPushMessage[] = (data as RentalRow[]).map(rental => {
    const renter = rental.renter_name || 'Locataire';
    return {
      to: tokens,
      title: `Maison ${rental.house_id} — Départ ce soir`,
      body: `La location de ${renter} se termine ce soir. Vérifiez l'état de la maison.`,
      sound: 'default',
      channelId: 'default',
      data: { type: 'reminder', reminderType: 'checkout_evening', houseId: rental.house_id },
    };
  });

  await sendPushNotifications(messages);
  return messages.length;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const reminderType: ReminderType = body.reminder_type ?? 'checkin';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const tokens = await fetchAdminTokens(supabase);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_tokens' }), { status: 200 });
    }

    let sent = 0;
    switch (reminderType) {
      case 'checkin':
        sent = await handleCheckin(supabase, tokens);
        break;
      case 'checkout_noon':
        sent = await handleCheckoutNoon(supabase, tokens);
        break;
      case 'checkout_evening':
        sent = await handleCheckoutEvening(supabase, tokens);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown reminder_type: ${reminderType}` }),
          { status: 400 }
        );
    }

    return new Response(JSON.stringify({ sent, reminderType }), { status: 200 });
  } catch (err) {
    console.error('[notify-reminders] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
