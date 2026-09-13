-- =============================================================
-- 060_workout_session_volume_view.sql
-- v_workout_session_volume — per-session training volume for the
-- Insights "volume progression" charts.
--
-- total_volume = Σ(weight_kg * reps) over NON-warmup, fully-logged sets
-- (weight_kg and reps both not null). Cardio days yield total_volume = 0
-- / total_sets = 0 (no weight/reps). LEFT JOIN keeps every session present
-- exactly once, so the page decides what to show (it filters total_sets>0).
--
-- RLS: security_invoker = on, so the base tables' policies
-- (auth.uid() = user_id on workout_sessions / exercise_sets) apply to the
-- view rows. Same pattern as v_user_week / v_weekly_habit_summary in
-- 006_redesign_support.sql. No explicit grant — Supabase grants SELECT on
-- public.* to the anon/authenticated roles by default.
-- =============================================================

create or replace view v_workout_session_volume
with (security_invoker = true)
as
select
  ws.id                 as session_id,
  ws.user_id,
  ws.session_date,
  ws.day_of_week,
  ws.split_name_snapshot,
  coalesce(
    sum(es.weight_kg * es.reps) filter (
      where es.is_warmup = false
        and es.weight_kg is not null
        and es.reps is not null
    ), 0
  )::numeric(12,2)      as total_volume,
  count(*) filter (
    where es.is_warmup = false
      and es.weight_kg is not null
      and es.reps is not null
  )::int                as total_sets
from workout_sessions ws
left join exercise_sets es on es.session_id = ws.id
group by ws.id, ws.user_id, ws.session_date, ws.day_of_week, ws.split_name_snapshot;
