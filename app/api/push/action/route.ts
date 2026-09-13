import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { todayInTz } from '@/lib/date';

export const dynamic = 'force-dynamic';

interface ActionPayload {
  kind: 'mark_done' | 'snooze_habit';
  habitId?: string;
  date?: string;
  minutes?: number;
}

// Action callback hit by the service worker when Pedro taps a notification
// button. Source-of-truth is the route, not the SW — RLS enforces the user
// owns the rows being written.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: ActionPayload;
  try {
    body = (await req.json()) as ActionPayload;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (body.kind === 'mark_done') {
    if (!body.habitId) {
      return NextResponse.json({ error: 'missing habitId' }, { status: 400 });
    }
    // Use the user's TZ-aware "today" if no date was sent (notifications
    // dispatched mid-day always carry a date, but the SW tolerates both).
    const date = body.date ?? todayInTz();
    const { error } = await supabase.from('habit_logs').upsert(
      {
        user_id: user.id,
        habit_id: body.habitId,
        log_date: date,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'habit_id,log_date' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.kind === 'snooze_habit') {
    if (!body.habitId) {
      return NextResponse.json({ error: 'missing habitId' }, { status: 400 });
    }
    const minutes = Math.min(Math.max(body.minutes ?? 10, 1), 120);
    const fireAt = new Date(Date.now() + minutes * 60_000);
    // The cron worker dedups via the unique index on
    // (user_id, kind, habit_id, scheduled_for). On collision, the cron
    // tick simply skips and we don't double-fire.
    const { error } = await supabase.from('notifications_sent').insert({
      user_id: user.id,
      kind: 'habit_reminder',
      habit_id: body.habitId,
      scheduled_for: fireAt.toISOString(),
    });
    if (error) {
      // 23505 = unique violation → already snoozed at this minute, OK.
      if (error.code === '23505') return NextResponse.json({ ok: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
}
