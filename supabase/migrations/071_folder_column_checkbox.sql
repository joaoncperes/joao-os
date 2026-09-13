-- Add 'checkbox' to the folder_column_type enum (Phase 2 of the table overhaul).
--
-- ALTER TYPE ... ADD VALUE cannot be USED in the same transaction that adds it,
-- and some Postgres versions reject it inside a transaction block entirely. So:
--   (a) guard with a catalog check so re-running (e.g. `db reset`) is a no-op, and
--   (b) keep this the ONLY statement in the file — nothing here references the
--       new label, so there's no "unsafe use of new enum value" error.
--
-- No data migration is needed: folder_columns.type accepts the new label, and the
-- note_set_property / note_strip_property RPCs are untyped on it. Checkbox cells
-- are stored as the string 'true' in notes.properties; unchecked = absent key.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'folder_column_type' and e.enumlabel = 'checkbox'
  ) then
    alter type folder_column_type add value 'checkbox';
  end if;
end $$;
