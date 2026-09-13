-- 043_rename_triceps_pushdown_to_skull_crusher.sql
-- Pedro: rename "Triceps Pushdown" to "Skull Crusher". Only appears on Sunday's
-- split, so a global rename on the exercises row is sufficient. Past workout_set
-- rows will retroactively show under the new name — confirmed intended.
-- Idempotent.

update exercises
set name = 'Skull Crusher'
where name = 'Triceps Pushdown';
