-- =============================================================
-- 055 — Custom daily reminders.
--
-- User-defined daily push reminders: pick a wall-clock time and a
-- text, get a notification every day at that time. Independent
-- from habits — these are pure "remember to X" pings with no
-- completion concept attached.
--
-- Delivery reuses the cron-worker pipeline: a new 'custom_reminder'
-- kind on notifications_sent, dedup falls into the existing
-- (user_id, kind, scheduled_for) partial unique index where
-- habit_id is null.
-- =============================================================

create table custom_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  text text not null check (length(trim(text)) between 1 and 140),
  scheduled_time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_reminders_user_idx
  on custom_reminders(user_id, scheduled_time);

alter table custom_reminders enable row level security;

create policy custom_reminders_owner on custom_reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger custom_reminders_updated_at
  before update on custom_reminders
  for each row execute function set_updated_at();

-- Extend the kind enum on the dedup ledger so cron-worker can
-- reserve 'custom_reminder' rows.
alter table notifications_sent
  drop constraint notifications_sent_kind_check;

alter table notifications_sent
  add constraint notifications_sent_kind_check
  check (kind in (
    'habit_reminder',
    'drift_alert',
    'morning_log',
    'evening_log',
    'weekly_review',
    'pr_celebration',
    'custom_reminder'
  ));
