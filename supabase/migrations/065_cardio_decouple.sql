-- =============================================================
-- 065_cardio_decouple.sql
-- Cardio is logged standalone on any day now (cardio_sessions rows with
-- session_id = null), not as a fixed weekday split. Clear the 'Cardio session'
-- pseudo-exercise from the Tue/Thu 'Cardio' split days and leave those days
-- open (no exercises, NOT marked rest) so strength can be assigned to them
-- later via the Edit-split flow.
--
-- Existing cardio_sessions (session_date + kcal) are left untouched and now
-- surface in the new Cardio tab + the weekly Insights chart. We deliberately do
-- NOT delete the empty Tue/Thu host workout_sessions: cardio_sessions.session_id
-- is ON DELETE CASCADE, so removing a host session would wipe its historical
-- kcal. Those host sessions have 0 exercise_sets, so they're already excluded
-- from v_workout_session_volume and render nothing once the day is empty.
--
-- Single-user app: the cardio split days are matched by name ('Cardio').
-- Idempotent — safe to re-run.
-- =============================================================

-- 1. Remove the 'Cardio session' pseudo-exercise links from cardio split days.
delete from workout_split_exercises wse
using workout_split ws
where wse.workout_split_id = ws.id
  and ws.split_name = 'Cardio';

-- 2. Rename those now-empty split days so the workout header isn't misleading.
--    is_rest stays false + 0 exercises → the screen shows the existing
--    "Split has no exercises — configure in Settings" empty state.
update workout_split
set split_name = 'Unassigned'
where split_name = 'Cardio';
