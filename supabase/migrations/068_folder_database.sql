-- =============================================================
-- 068_folder_database.sql
-- Folder-as-database — Notion-style typed columns on a PARA folder.
--
-- A folder = a database. Each note in the folder = a row/page. The note's
-- title = the implicit "Name" column (rendered first by the UI, not stored
-- here). On top of that, a folder defines typed columns (text | multi_select
-- | date | url). Each note carries a `properties` jsonb map keyed by the
-- folder_column id → value.
--
-- Scope: those 4 column types only. No filter/sort/group/formula/relation.
-- Single-user; RLS via auth.uid() = user_id (folders own their columns,
-- notes own their property values). Purely additive: a folder with zero
-- columns renders exactly as before.
-- =============================================================

-- 1. column type enum (guarded, repo convention — see 056_para_folders.sql).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'folder_column_type') then
    create type folder_column_type as enum ('text','multi_select','date','url');
  end if;
end $$;

-- 2. folder_columns — one row per user-defined column on a folder. The "Name"
--    column (note.title) is implicit and is NOT stored here.
create table if not exists folder_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  name text not null,
  type folder_column_type not null,
  -- multi_select option definitions: [{id, name, color}]. Empty for other types.
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folder_columns_folder_idx
  on folder_columns(folder_id, position);

create index if not exists folder_columns_user_idx
  on folder_columns(user_id);

alter table folder_columns enable row level security;

drop policy if exists folder_columns_all on folder_columns;
create policy folder_columns_all on folder_columns for all
  using (auth.uid() = user_id);

create trigger folder_columns_updated_at
  before update on folder_columns
  for each row execute function set_updated_at();

-- 3. notes.properties — per-note cell values, keyed by folder_columns.id.
--    Shape: { "<column_id>": <value> }. Absent key = empty cell.
--    Encoding: text|url → string, date → 'YYYY-MM-DD', multi_select →
--    array of MultiSelectOption ids. The existing notes_updated_at trigger
--    bumps updated_at automatically on a property write.
alter table notes
  add column if not exists properties jsonb not null default '{}'::jsonb;

-- 4. folders.default_view — per-folder Grid/Table preference.
alter table folders
  add column if not exists default_view text not null default 'grid'
    check (default_view in ('grid','table'));

-- 5. Helper RPCs. security invoker + the user_id = auth.uid() predicate keeps
--    RLS semantics (the function runs as the caller). note_set_property does an
--    atomic single-cell merge (no read-modify-write race); note_strip_property
--    removes a column's key from every note in a folder (used on column delete).
create or replace function note_set_property(p_note_id uuid, p_column_id text, p_value jsonb)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update notes
     set properties = jsonb_set(properties, array[p_column_id], p_value, true)
   where id = p_note_id and user_id = auth.uid();
$$;

create or replace function note_strip_property(p_folder_id uuid, p_column_id text)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update notes
     set properties = properties - p_column_id
   where folder_id = p_folder_id
     and user_id = auth.uid()
     and properties ? p_column_id;
$$;

grant execute on function note_set_property(uuid, text, jsonb) to authenticated;
grant execute on function note_strip_property(uuid, text) to authenticated;
