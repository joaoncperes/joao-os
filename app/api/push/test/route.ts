import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Dev-only test endpoint. Inserts a notifications_sent row at scheduled_for=
// now() so the cron worker picks it up on its next tick. No actual push is
// sent from this Next.js route — keeps VAPID signing inside the cron worker.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const fireAt = new Date(Date.now() + 1000); // ~now
  const { error } = await supabase.from('notifications_sent').insert({
    user_id: user.id,
    kind: 'habit_reminder',
    scheduled_for: fireAt.toISOString(),
    payload: { title: 'Pedro OS test', body: 'Push pipeline OK.', tag: 'test' },
  });

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, dedup: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
