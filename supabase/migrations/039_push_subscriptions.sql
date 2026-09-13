-- =============================================================
-- 039 — Push subscriptions + send-dedup ledger.
--
-- Backs the PWA's external trigger layer: stored Web-Push
-- endpoints + an idempotent record of what we've already sent
-- so cron retries (every 5 min) never double-fire.
-- =============================================================

-- 1. Per-device push subscription. One row per (user, endpoint).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);

create index push_subs_user_idx on push_subscriptions(user_id, last_used_at desc);

alter table push_subscriptions enable row level security;
create policy push_subs_owner on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Send-dedup ledger.
--    The cron worker writes one row per (kind, target, scheduled_for) it
--    plans to send. Unique indexes turn duplicate sends into no-ops.
create table notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in (
    'habit_reminder',
    'drift_alert',
    'morning_log',
    'evening_log',
    'weekly_review',
    'pr_celebration'
  )),
  habit_id uuid references habits(id) on delete set null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  result text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index notifications_sent_user_idx on notifications_sent(user_id, scheduled_for desc);

-- Dedup keys: one row per (kind + scheduled_for + optional habit).
create unique index notifications_sent_uq_with_habit
  on notifications_sent(user_id, kind, habit_id, scheduled_for)
  where habit_id is not null;

create unique index notifications_sent_uq_no_habit
  on notifications_sent(user_id, kind, scheduled_for)
  where habit_id is null;

alter table notifications_sent enable row level security;
-- User can read their own.
create policy notifications_sent_owner_read on notifications_sent
  for select using (auth.uid() = user_id);
-- User may also insert their own (used for in-app snooze actions). The cron
-- worker uses the service role and bypasses RLS for the bulk fan-out path.
create policy notifications_sent_owner_insert on notifications_sent
  for insert with check (auth.uid() = user_id);
