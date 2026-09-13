-- 067_weekly_prep_checklist.sql
-- "Weekly Reset" pre-planning checklist on /week. Stores which of the 5 fixed
-- step-keys are checked, per week, on the existing weekly_plans row.
-- Known keys (whitelisted app-side before write): inbox, calendar, desktop,
-- second_brain, tasks. Inherits weekly_plans RLS (auth.uid() = user_id) — no
-- policy change: policies gate rows, not columns.
alter table weekly_plans
  add column if not exists prep_checklist text[] not null default '{}';
