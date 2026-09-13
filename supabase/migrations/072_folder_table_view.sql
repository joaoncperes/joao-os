-- Persist the folder table's "remember current view" config (Phase 3 of the
-- table overhaul): sort, filters, column widths, and hidden columns. One config
-- per folder-as-database, stored as jsonb on the folder. '{}' means "no saved
-- view" and is normalized to defaults on read (lib/second-brain/table-view.ts
-- normalizeViewConfig). Kept separate from the enum migration (071) so the two
-- never share a transaction.
alter table folders
  add column if not exists table_view jsonb not null default '{}'::jsonb;
