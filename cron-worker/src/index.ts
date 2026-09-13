// Pedro OS cron worker — runs every 5 min, fans out due push notifications.
//
// Pipeline per tick:
//   1. Habit reminders   — for each active time-blocked habit, if its
//                          (time_slot - reminder_lead_minutes) lands in
//                          [now-5m, now] in Pedro's TZ AND today's not
//                          already done AND no dedup row exists, fire + insert
//                          the dedup row.
//   2. PR celebrations   — for each personal_records row written in the
//                          last ~6 min with no dedup row, fire.
//   3. User-scheduled    — notifications_sent rows where scheduled_for has
//                          passed and sent_at IS NULL (snoozes, /api/push/test).
//
// All inserts to notifications_sent rely on the unique index (user_id, kind,
// habit_id?, scheduled_for) for dedup. ON CONFLICT DO NOTHING means a 2nd
// cron tick in the same minute is a no-op.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  buildPushPayload,
  type PushSubscription as WebPushSubscription,
} from '@block65/webcrypto-web-push';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT: string;
  PEDRO_USER_EMAIL: string;
}

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string }[];
  silent?: boolean;
  icon?: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(tick(env));
  },

  // Allow manual trigger from a curl for development.
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 });
    await tick(env);
    return new Response('ok');
  },
};

async function tick(env: Env): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pedro, error: userErr } = await supabase
    .from('users')
    .select('id, time_zone')
    .eq('email', env.PEDRO_USER_EMAIL)
    .maybeSingle();
  if (userErr || !pedro) {
    console.error('cron: user lookup failed', userErr);
    return;
  }

  const userId = pedro.id as string;
  const tz = (pedro.time_zone as string) || 'America/Sao_Paulo';
  const now = new Date();
  // Window must be > cron interval (5 min) to absorb Cloudflare's tick latency.
  // Observed: a 16:35 target was missed because the 16:40 tick fired at 16:40:46.
  // 7 min gives ~2 min slack on either side without risking duplicate sends —
  // dedup unique index makes overlapping ticks idempotent anyway.
  const tickWindowMs = 7 * 60_000;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  const subscriptions: Subscription[] = (subs ?? []) as Subscription[];

  if (subscriptions.length === 0) {
    console.log('cron: no subscriptions registered, skipping fan-out');
  }

  await fireHabitReminders(supabase, env, userId, tz, now, tickWindowMs, subscriptions);
  await fireCustomReminders(supabase, env, userId, tz, now, tickWindowMs, subscriptions);
  await firePrCelebrations(supabase, env, userId, now, tickWindowMs, subscriptions);
  await fireScheduled(supabase, env, userId, now, subscriptions);
}

async function fireHabitReminders(
  supabase: SupabaseClient,
  env: Env,
  userId: string,
  tz: string,
  now: Date,
  windowMs: number,
  subscriptions: Subscription[],
): Promise<void> {
  const { data: habits } = await supabase
    .from('habits')
    .select('id, name, time_slot, reminder_lead_minutes')
    .eq('user_id', userId)
    .eq('archived', false)
    .not('time_slot', 'is', null);

  if (!habits || habits.length === 0) return;

  const todayInTz = formatInTimeZone(now, tz, 'yyyy-MM-dd');

  // Already-completed habits today — skip their reminders.
  const { data: doneLogs } = await supabase
    .from('habit_logs')
    .select('habit_id')
    .eq('user_id', userId)
    .eq('log_date', todayInTz)
    .not('completed_at', 'is', null);
  const doneSet = new Set((doneLogs ?? []).map((r) => r.habit_id as string));

  for (const h of habits) {
    if (doneSet.has(h.id as string)) continue;

    const targetUtc = computeFireUtc(
      todayInTz,
      h.time_slot as string,
      Number(h.reminder_lead_minutes ?? 0),
      tz,
    );
    if (!targetUtc) continue;

    const delta = targetUtc.getTime() - now.getTime();
    // Window: target should have just passed (within last 5 min) or be in
    // the next minute. The "+1m" right edge handles tick-clock skew.
    if (delta > 60_000 || delta < -windowMs) continue;

    const inserted = await reserveDedup(supabase, {
      user_id: userId,
      kind: 'habit_reminder',
      habit_id: h.id as string,
      scheduled_for: targetUtc.toISOString(),
    });
    if (!inserted) continue;

    const payload: PushPayload = {
      title: h.name as string,
      body: `Up next${h.reminder_lead_minutes ? ` in ${h.reminder_lead_minutes} min` : ''}.`,
      tag: `habit-${h.id}-${todayInTz}`,
      data: { habitId: h.id, date: todayInTz, url: '/today' },
      actions: [
        { action: 'mark-done', title: 'Mark done' },
        { action: 'snooze', title: 'Snooze 10m' },
      ],
    };
    await deliver(supabase, env, userId, subscriptions, inserted.id, payload);
  }
}

async function fireCustomReminders(
  supabase: SupabaseClient,
  env: Env,
  userId: string,
  tz: string,
  now: Date,
  windowMs: number,
  subscriptions: Subscription[],
): Promise<void> {
  const { data: reminders } = await supabase
    .from('custom_reminders')
    .select('id, text, scheduled_time')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (!reminders || reminders.length === 0) return;

  const todayInTz = formatInTimeZone(now, tz, 'yyyy-MM-dd');

  for (const r of reminders as CustomReminderRow[]) {
    const targetUtc = computeFireUtc(todayInTz, r.scheduled_time, 0, tz);
    if (!targetUtc) continue;

    const delta = targetUtc.getTime() - now.getTime();
    if (delta > 60_000 || delta < -windowMs) continue;

    const inserted = await reserveDedup(supabase, {
      user_id: userId,
      kind: 'custom_reminder',
      habit_id: null,
      scheduled_for: targetUtc.toISOString(),
    });
    if (!inserted) continue;

    const payload: PushPayload = {
      title: 'Reminder',
      body: r.text,
      tag: `custom-${r.id}-${todayInTz}`,
      data: { url: '/today' },
    };
    await deliver(supabase, env, userId, subscriptions, inserted.id, payload);
  }
}

async function firePrCelebrations(
  supabase: SupabaseClient,
  env: Env,
  userId: string,
  now: Date,
  windowMs: number,
  subscriptions: Subscription[],
): Promise<void> {
  const since = new Date(now.getTime() - windowMs - 60_000).toISOString();
  const { data: prs } = await supabase
    .from('personal_records')
    .select('id, pr_type, weight_kg, reps, achieved_at, exercise:exercises(name)')
    .eq('user_id', userId)
    .gte('achieved_at', since)
    .order('achieved_at', { ascending: false });

  if (!prs) return;

  for (const pr of prs as unknown as PersonalRecordRow[]) {
    const inserted = await reserveDedup(supabase, {
      user_id: userId,
      kind: 'pr_celebration',
      habit_id: null,
      scheduled_for: pr.achieved_at,
    });
    if (!inserted) continue;

    // Supabase types one-to-many relationships as arrays even when functionally
    // many-to-one. Normalise.
    const exerciseRel = Array.isArray(pr.exercise) ? pr.exercise[0] : pr.exercise;
    const exName = exerciseRel?.name ?? 'PR';
    const detail =
      pr.pr_type === 'max_weight' && pr.weight_kg
        ? `${pr.weight_kg}kg × ${pr.reps ?? '?'}`
        : pr.pr_type === 'max_volume_session'
          ? 'session volume'
          : 'reps';

    const payload: PushPayload = {
      title: `New PR — ${exName}`,
      body: detail,
      tag: `pr-${pr.id}`,
      silent: false, // sound only, no vibrate (per spec)
      data: { url: '/workout' },
    };
    await deliver(supabase, env, userId, subscriptions, inserted.id, payload);
  }
}

async function fireScheduled(
  supabase: SupabaseClient,
  env: Env,
  userId: string,
  now: Date,
  subscriptions: Subscription[],
): Promise<void> {
  const { data: rows } = await supabase
    .from('notifications_sent')
    .select('id, kind, habit_id, scheduled_for, payload')
    .eq('user_id', userId)
    .lte('scheduled_for', now.toISOString())
    .is('sent_at', null);

  if (!rows) return;

  for (const r of rows as PendingScheduledRow[]) {
    if (r.payload && typeof r.payload === 'object') {
      // User/test inserted with a payload — send as-is.
      await deliver(supabase, env, userId, subscriptions, r.id, r.payload as PushPayload);
      continue;
    }

    if (r.kind === 'habit_reminder' && r.habit_id) {
      // Snoozed habit reminder — re-look-up its name.
      const { data: h } = await supabase
        .from('habits')
        .select('name, time_slot')
        .eq('id', r.habit_id)
        .maybeSingle();
      if (!h) continue;
      const payload: PushPayload = {
        title: h.name as string,
        body: 'Snoozed reminder.',
        tag: `habit-${r.habit_id}-snoozed`,
        data: { habitId: r.habit_id, url: '/today' },
        actions: [
          { action: 'mark-done', title: 'Mark done' },
          { action: 'snooze', title: 'Snooze 10m' },
        ],
      };
      await deliver(supabase, env, userId, subscriptions, r.id, payload);
    }
  }
}

interface ReserveInput {
  user_id: string;
  kind: string;
  habit_id: string | null;
  scheduled_for: string;
  payload?: unknown;
}

async function reserveDedup(
  supabase: SupabaseClient,
  input: ReserveInput,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('notifications_sent')
    .insert({
      user_id: input.user_id,
      kind: input.kind,
      habit_id: input.habit_id,
      scheduled_for: input.scheduled_for,
      payload: input.payload ?? null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return null; // already reserved
    console.error('reserveDedup error', error);
    return null;
  }
  return data as { id: string };
}

async function deliver(
  supabase: SupabaseClient,
  env: Env,
  userId: string,
  subscriptions: Subscription[],
  rowId: string,
  payload: PushPayload,
): Promise<void> {
  const body = JSON.stringify(payload);
  const results: string[] = [];

  const endpointHost = (ep: string) => {
    try {
      return new URL(ep).hostname;
    } catch {
      return '?';
    }
  };

  const vapid = {
    subject: env.VAPID_CONTACT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  for (const sub of subscriptions) {
    const host = endpointHost(sub.endpoint);
    const wpSub: WebPushSubscription = {
      endpoint: sub.endpoint,
      expirationTime: null,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      const init = await buildPushPayload(
        { data: body, options: { ttl: 60 * 60 * 24, urgency: 'normal' } },
        wpSub,
        vapid,
      );
      // buildPushPayload returns a Uint8Array body; Workers' fetch types
      // don't enumerate it explicitly but accept it at runtime. Cast through.
      const res = await fetch(sub.endpoint, init as unknown as RequestInit);
      console.log(
        `deliver: ${payload.tag ?? 'no-tag'} → ${host} status=${res.status}`,
      );

      if (res.status >= 200 && res.status < 300) {
        results.push(`ok-${res.status}`);
      } else if (res.status === 404 || res.status === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint);
        results.push(`pruned-${res.status}`);
      } else {
        const errBody = await res.text().catch(() => '');
        console.log(
          `deliver: ${payload.tag ?? 'no-tag'} → ${host} ERR status=${res.status} body=${errBody.slice(0, 200)}`,
        );
        results.push(`err-${res.status}`);
      }
    } catch (e) {
      const err = e as { message?: string };
      console.log(
        `deliver: ${payload.tag ?? 'no-tag'} → ${host} THROWN msg=${err.message ?? ''}`,
      );
      results.push('err-x');
    }
  }

  await supabase
    .from('notifications_sent')
    .update({ sent_at: new Date().toISOString(), result: results.join(',') })
    .eq('id', rowId);
}

// Compute UTC instant when a habit reminder should fire.
// (date in user TZ) + (time_slot - leadMin) interpreted in user TZ → UTC.
function computeFireUtc(
  todayInTz: string,
  timeSlot: string,
  leadMin: number,
  tz: string,
): Date | null {
  const m = /^(\d{2}):(\d{2})/.exec(timeSlot);
  if (!m) return null;
  const totalMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) - leadMin;
  // Negative target (e.g., 00:05 with 10 min lead) → previous day; clamp.
  if (totalMin < 0) return null;

  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  // fromZonedTime parses an ISO string without offset as wall-time in `tz`
  // and returns the actual UTC instant.
  return fromZonedTime(`${todayInTz}T${hh}:${mm}:00`, tz);
}

// ---- Local row types ----------------------------------------------------

interface PersonalRecordRow {
  id: string;
  pr_type: 'max_weight' | 'max_reps_at_weight' | 'max_volume_session';
  weight_kg: number | null;
  reps: number | null;
  achieved_at: string;
  // Supabase-generated types model FK relations as arrays. We normalise at
  // read time.
  exercise: { name: string } | { name: string }[] | null;
}

interface PendingScheduledRow {
  id: string;
  kind: string;
  habit_id: string | null;
  scheduled_for: string;
  payload: unknown;
}

interface CustomReminderRow {
  id: string;
  text: string;
  scheduled_time: string; // 'HH:MM:SS'
}
