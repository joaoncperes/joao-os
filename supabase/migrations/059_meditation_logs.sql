-- =============================================================
-- 059_meditation_logs.sql
-- Meditation tracking: one quantitative entry per date (minutes).
--
-- Lives separately from the habits system. The existing "Meditation" habit
-- in habits/habit_logs stays as a binary checkbox on Today; this table is
-- the quantitative dimension surfaced on /meditation (DOW-tabbed history,
-- analogous to /workout).
-- =============================================================

create table if not exists meditation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  log_date date not null,
  -- 0..6 (Sun..Sat). Mirrors workout_sessions.day_of_week so the DOW filter
  -- query is index-friendly and matches the convention everywhere else.
  day_of_week smallint not null check (day_of_week between 0 and 6),
  minutes integer not null check (minutes >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists meditation_logs_user_dow_idx
  on meditation_logs(user_id, day_of_week, log_date desc);

create trigger meditation_logs_updated_at
  before update on meditation_logs
  for each row execute function set_updated_at();

alter table meditation_logs enable row level security;

create policy meditation_logs_all on meditation_logs
  for all using (auth.uid() = user_id);
