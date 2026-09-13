-- 046_rename_unilateral_row_to_chest_supported_row.sql
-- Pedro: the Monday "Unilateral Row" was always meant to be "Chest Supported Row".
-- Pure rename so historical exercise_sets keep their data and just surface under
-- the corrected name. Only appears on Monday's split, so a global rename of the
-- exercise row covers it. Idempotent.

update exercises
set name = 'Chest Supported Row'
where name = 'Unilateral Row';
