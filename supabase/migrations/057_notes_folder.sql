-- =============================================================
-- 057_notes_folder.sql
-- Attach notes to PARA folders.
--
-- Inbox semantics change from `life_area IS NULL` to `folder_id IS NULL`.
-- During the transition both columns coexist on `notes`; the new UI reads
-- folder_id only. life_area is dropped in a follow-up migration once the
-- old Brain code paths are fully removed.
-- =============================================================

alter table notes
  add column if not exists folder_id uuid references folders(id) on delete set null;

create index if not exists notes_folder_idx
  on notes(folder_id, archived_at, updated_at desc);

drop index if exists notes_inbox_idx;
create index if not exists notes_inbox_idx
  on notes(user_id, updated_at desc)
  where folder_id is null and archived_at is null;
