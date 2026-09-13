-- =============================================================
-- 041 — Habits: implementation intentions + explicit anchors.
--
-- if_missed_plan: per-habit "If I miss this, I will…" backup
--   plan, surfaced on Today when the day-end has passed without
--   a log. Atomic Habits' implementation intentions, stored.
--
-- anchor_habit_id: makes habit-stacking explicit. The Today
--   rail can render "After {anchor.name} →" inline so the
--   dependency chain is visible.
-- =============================================================

alter table habits
  add column if not exists if_missed_plan text;

alter table habits
  add column if not exists anchor_habit_id uuid
    references habits(id) on delete set null;

create index if not exists habits_anchor_idx
  on habits(anchor_habit_id)
  where anchor_habit_id is not null;

-- Widen v_today_habits to expose the new columns on the read path.
-- create or replace view requires preserving existing column order +
-- types; new columns are appended at the end.
create or replace view v_today_habits as
  select
    h.id as habit_id,
    h.user_id,
    h.name,
    h.area,
    h.time_slot,
    h.is_counter,
    h.counter_target_value,
    h.counter_unit,
    h.sort_order,
    hl.completed_at,
    hl.value as logged_value,
    hl.miss_reason,
    hl.notes,
    hl.freeze_used,
    (now() at time zone u.time_zone)::date as today_in_tz,
    -- new columns
    h.if_missed_plan,
    h.anchor_habit_id,
    a.name as anchor_habit_name
  from habits h
  join users u on u.id = h.user_id
  left join habits a on a.id = h.anchor_habit_id
  left join habit_logs hl
    on hl.habit_id = h.id
    and hl.log_date = (now() at time zone u.time_zone)::date
  where h.archived = false
  order by h.time_slot nulls last, h.sort_order;
