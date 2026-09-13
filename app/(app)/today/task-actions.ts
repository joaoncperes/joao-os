'use server';

import { createClient } from '@/lib/supabase/server';
import { addDays, todayInTz, DEFAULT_TZ } from '@/lib/date';
import type { TaskBucket } from '@/lib/supabase/types';

const BACKLOG_OFFSET_DAYS = 7;

// TaskBuckets invalidates its task query after every mutation. Today itself is
// force-dynamic; no persistent page cache needs invalidation. Avoid refreshing
// the entire server-rendered shell and all dashboard data on each task edit.

export async function createTask(input: {
  title: string;
  bucket: TaskBucket;
  scheduledTime?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: 'Title is required.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: userRow } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .single();
  const tz = userRow?.time_zone ?? DEFAULT_TZ;
  const today = todayInTz(tz);
  const offset = input.bucket === 'today' ? 0 : input.bucket === 'tomorrow' ? 1 : BACKLOG_OFFSET_DAYS;
  const scheduled_date = addDays(today, offset);

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title,
    scheduled_date,
    scheduled_time: input.scheduledTime ?? null,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function toggleTaskComplete(input: {
  taskId: string;
  complete: boolean;
}): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: input.complete ? new Date().toISOString() : null })
    .eq('id', input.taskId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function rescheduleTask(input: {
  taskId: string;
  bucket: TaskBucket;
}): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: userRow } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .single();
  const tz = userRow?.time_zone ?? DEFAULT_TZ;
  const today = todayInTz(tz);
  const offset = input.bucket === 'today' ? 0 : input.bucket === 'tomorrow' ? 1 : BACKLOG_OFFSET_DAYS;
  const scheduled_date = addDays(today, offset);

  const { error } = await supabase
    .from('tasks')
    .update({ scheduled_date })
    .eq('id', input.taskId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

// Accepts what <input type="time"> emits ('HH:MM'); Postgres coerces to 'HH:MM:SS'.
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Set (or clear, with null) a task's time of day. Only touches scheduled_time —
 *  the date stays put, so a timed task keeps its time when dragged between buckets. */
export async function setTaskTime(input: {
  taskId: string;
  time: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const raw = input.time?.trim() ?? '';
  const time = raw === '' ? null : raw;
  if (time !== null && !TIME_RE.test(time)) {
    return { error: 'Invalid time.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .update({ scheduled_time: time })
    .eq('id', input.taskId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteTask(input: {
  taskId: string;
}): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', input.taskId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { ok: true };
}
