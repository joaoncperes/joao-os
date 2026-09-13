-- =============================================================
-- 054_second_brain.sql
-- Second Brain (PARA-Identity): notes universais + projects + resources.
--
-- Top-level lens = `life_area` enum (Pedro's 3 identity areas).
-- Granular `area` check (string) reuses the legacy vocabulary used by
-- identity/decisions/insights, extended here with 'friends'.
-- TipTap JSON + derived markdown + generated tsvector — same pattern
-- as book_notes (049). Notes with life_area IS NULL are the Inbox.
-- =============================================================

-- 1. Top-level lens: 3 identity areas.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'life_area') then
    create type life_area as enum ('professional','health','personal');
  end if;
end $$;

-- =============================================================
-- 2. projects — long-lived initiatives with an outcome.
--    Distinct from weekly_commitments (week-scoped).
-- =============================================================

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  life_area life_area not null,
  area text check (area in ('professional','health','family','marriage','friends','cross_cutting')),
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('active','paused','done','archived')),
  due_date date,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_life_area_idx
  on projects(user_id, life_area, status, position);

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;
create policy projects_all on projects for all
  using (auth.uid() = user_id);

-- =============================================================
-- 3. resources — evergreen themes/interests, incl. guiding questions.
-- =============================================================

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  life_area life_area not null,
  area text check (area in ('professional','health','family','marriage','friends','cross_cutting')),
  title text not null,
  description text,
  is_guiding_question boolean not null default false,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resources_user_life_area_idx
  on resources(user_id, life_area, archived_at, position);

create trigger resources_updated_at
  before update on resources
  for each row execute function set_updated_at();

alter table resources enable row level security;
create policy resources_all on resources for all
  using (auth.uid() = user_id);

-- =============================================================
-- 4. notes — atomic knowledge unit. life_area IS NULL = Inbox.
-- =============================================================

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- Nullable: NULL = Inbox (not yet classified).
  life_area life_area,
  area text check (area in ('professional','health','family','marriage','friends','cross_cutting')),
  -- Nullable: derived from first heading if not set.
  title text,
  -- TipTap document. Empty doc default so the editor mounts cleanly.
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- Derived markdown — client-serialised on every save. Drives FTS + export.
  content_md text not null default '',
  content_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content_md, ''))
  ) stored,
  source text not null default 'manual'
    check (source in ('manual','voice','quick_capture','import')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary list index: by area + recency, filtered to non-archived.
create index if not exists notes_user_life_area_idx
  on notes(user_id, life_area, archived_at, updated_at desc);

-- Partial index dedicated to the Inbox (life_area NULL, not archived).
create index if not exists notes_inbox_idx
  on notes(user_id, updated_at desc)
  where life_area is null and archived_at is null;

create index if not exists notes_tsv_idx on notes using gin (content_tsv);

create trigger notes_updated_at
  before update on notes
  for each row execute function set_updated_at();

alter table notes enable row level security;
create policy notes_all on notes for all
  using (auth.uid() = user_id);

-- =============================================================
-- 5. Join tables (N:N).
--    user_id denormalised so RLS can gate without a subquery.
-- =============================================================

create table if not exists note_projects (
  note_id uuid not null references notes(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (note_id, project_id)
);
create index if not exists note_projects_project_idx
  on note_projects(project_id, added_at desc);
alter table note_projects enable row level security;
create policy note_projects_all on note_projects for all
  using (auth.uid() = user_id);

create table if not exists note_resources (
  note_id uuid not null references notes(id) on delete cascade,
  resource_id uuid not null references resources(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (note_id, resource_id)
);
create index if not exists note_resources_resource_idx
  on note_resources(resource_id, added_at desc);
alter table note_resources enable row level security;
create policy note_resources_all on note_resources for all
  using (auth.uid() = user_id);

-- =============================================================
-- 6. Storage: note-images bucket for inline note images.
--    Paths: <user_id>/<note_id>/<uuid>.<ext> — same shape as book-images.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do update set public = true;

drop policy if exists "note_images_owner_select" on storage.objects;
drop policy if exists "note_images_owner_insert" on storage.objects;
drop policy if exists "note_images_owner_update" on storage.objects;
drop policy if exists "note_images_owner_delete" on storage.objects;

create policy "note_images_owner_select" on storage.objects for select
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note_images_owner_insert" on storage.objects for insert
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note_images_owner_update" on storage.objects for update
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note_images_owner_delete" on storage.objects for delete
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================
-- 7. Search RPC — full-text search across the current user's notes.
-- =============================================================

create or replace function search_notes(q text)
returns table(
  note_id uuid,
  title text,
  snippet text,
  life_area life_area,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    n.id as note_id,
    coalesce(nullif(n.title, ''), '(sem título)') as title,
    ts_headline(
      'simple',
      n.content_md,
      plainto_tsquery('simple', q),
      'MaxFragments=2, MinWords=4, MaxWords=18, StartSel=<mark>, StopSel=</mark>'
    ) as snippet,
    n.life_area,
    n.updated_at
  from notes n
  where n.user_id = auth.uid()
    and n.archived_at is null
    and n.content_tsv @@ plainto_tsquery('simple', q)
  order by ts_rank(n.content_tsv, plainto_tsquery('simple', q)) desc
  limit 30;
$$;

grant execute on function search_notes(text) to authenticated;
