-- =============================================================
-- 006_redesign_support.sql
-- Backend support for the V2 visual redesign:
--   1. daily_state — per-day editable "intention" line on Today.
--   2. v_user_week — TZ-aware 7-day completion bars for Today's streak strip.
--   3. v_weekly_habit_summary — per-habit per-ISO-week completion for Week's
--      "Last Week Context" card.
--   4. detect_pr trigger — auto-writes personal_records on new max_weight /
--      max_volume_session sets, so Workout's table can show PR badges.
--   5. journal_questions seeding helper — questions table existed but wizard
--      never seeded defaults; this back-fills the 5 required + 3 optional.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. daily_state
-- ---------------------------------------------------------------

create table if not exists daily_state (
  user_id    uuid not null references users(id) on delete cascade,
  state_date date not null,
  intention  text,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_date)
);

alter table daily_state enable row level security;
create policy daily_state_all on daily_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger daily_state_updated_at
  before update on daily_state
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------
-- 2. v_user_week — 7 rows per user (Mon..Sun of current ISO week in user TZ)
--    Returns completion data for the streak-strip bars on Today.
-- ---------------------------------------------------------------

create or replace view v_user_week
with (security_invoker = true)
as
with u as (
  select id as user_id, (now() at time zone time_zone)::date as today
  from users
),
weeks as (
  select u.user_id, u.today,
         (u.today - (extract(isodow from u.today)::int - 1))::date as week_start
  from u
),
days as (
  select w.user_id, w.today, w.week_start,
         gs as day_index,
         (w.week_start + gs)::date as d
  from weeks w, generate_series(0, 6) gs
)
select
  d.user_id,
  d.day_index,                    -- 0=Mon..6=Sun
  d.d as log_date,
  (d.d = d.today) as is_today,
  (d.d > d.today) as is_future,
  coalesce(stats.habit_total, 0)::int as habit_total,
  coalesce(stats.done_count, 0)::int as done_count,
  case
    when coalesce(stats.habit_total, 0) > 0
    then round(100.0 * stats.done_count / stats.habit_total)::int
    else 0
  end as pct
from days d
left join lateral (
  select
    (select count(*)::int from habits h
     where h.user_id = d.user_id and h.archived = false) as habit_total,
    (select count(*)::int from habit_logs hl
     where hl.user_id = d.user_id
       and hl.log_date = d.d
       and hl.completed_at is not null) as done_count
) stats on true;

-- ---------------------------------------------------------------
-- 3. v_weekly_habit_summary — per-habit per-ISO-week completion.
--    Week page's "Last Week Context" card filters by week_start.
-- ---------------------------------------------------------------

create or replace view v_weekly_habit_summary
with (security_invoker = true)
as
select
  hl.user_id,
  hl.habit_id,
  h.name as habit_name,
  h.area,
  (hl.log_date - (extract(isodow from hl.log_date)::int - 1))::date as week_start,
  count(*) filter (where hl.completed_at is not null)::int as completed_count,
  count(*)::int as total_logged
from habit_logs hl
join habits h on h.id = hl.habit_id
group by hl.user_id, hl.habit_id, h.name, h.area, week_start;

-- ---------------------------------------------------------------
-- 4. PR detection trigger.
--    On insert/update of a non-warmup set, check if it's a new
--    max_weight or max_volume_session for this (user, exercise).
--    Writes personal_records.set_id to NEW.id so the workout
--    page can render "PR" badges by joining sets to personal_records.
--
--    Idempotency: a unique partial index ensures the trigger is
--    safe across set edits — re-saving an existing set won't
--    insert duplicate PR rows for the same (set_id, pr_type).
-- ---------------------------------------------------------------

create unique index if not exists personal_records_set_pr_unique
  on personal_records (set_id, pr_type)
  where set_id is not null;

create or replace function detect_pr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_weight numeric;
  v_max_volume numeric;
  v_set_volume numeric;
begin
  if NEW.is_warmup then
    return NEW;
  end if;
  if NEW.weight_kg is null or NEW.reps is null or NEW.reps = 0 then
    return NEW;
  end if;

  v_set_volume := NEW.weight_kg * NEW.reps;

  -- max_weight PR
  select max(weight_kg) into v_max_weight
  from exercise_sets
  where user_id = NEW.user_id
    and exercise_id = NEW.exercise_id
    and is_warmup = false
    and id <> NEW.id;

  if v_max_weight is null or NEW.weight_kg > v_max_weight then
    insert into personal_records
      (user_id, exercise_id, pr_type, weight_kg, reps, set_id, achieved_at)
    values
      (NEW.user_id, NEW.exercise_id, 'max_weight', NEW.weight_kg, NEW.reps, NEW.id, now())
    on conflict (set_id, pr_type) do nothing;
  end if;

  -- max_volume_session PR (single-set volume)
  select max(coalesce(weight_kg, 0) * coalesce(reps, 0)) into v_max_volume
  from exercise_sets
  where user_id = NEW.user_id
    and exercise_id = NEW.exercise_id
    and is_warmup = false
    and id <> NEW.id;

  if v_max_volume is null or v_set_volume > v_max_volume then
    insert into personal_records
      (user_id, exercise_id, pr_type, weight_kg, reps, set_id, achieved_at)
    values
      (NEW.user_id, NEW.exercise_id, 'max_volume_session', NEW.weight_kg, NEW.reps, NEW.id, now())
    on conflict (set_id, pr_type) do nothing;
  end if;

  return NEW;
end $$;

drop trigger if exists exercise_sets_pr_check on exercise_sets;
create trigger exercise_sets_pr_check
  after insert or update of weight_kg, reps, is_warmup
  on exercise_sets
  for each row execute function detect_pr();

-- ---------------------------------------------------------------
-- 5. Seed default journal_questions for any user that doesn't have any yet.
--    The setup wizard will be updated to insert these on user creation,
--    but we back-fill existing users here too (idempotent).
-- ---------------------------------------------------------------

insert into journal_questions (user_id, label, question_key, answer_type, required, sort_order)
select u.id, q.label, q.question_key, q.answer_type, q.required, q.sort_order
from users u
cross join (values
  ('Win of the day',           'win',              'text',      true,  10),
  ('What I learned',           'learned',          'text',      true,  20),
  ('What I would do differently', 'different',     'text',      true,  30),
  ('One thing for tomorrow',   'one_for_tomorrow', 'text',      true,  40),
  ('Area scores',              'area_scores',      'score',     true,  50),
  ('Gratitude',                'gratitude',        'text',      false, 60),
  ('Partner call',                'gabi_call',        'depth_tag', false, 70),
  ('Free notes',               'free_notes',       'text',      false, 80)
) as q(label, question_key, answer_type, required, sort_order)
on conflict (user_id, question_key) do nothing;
