-- =============================================================
-- 056_para_folders.sql
-- PARA folders for the Second Brain.
--
-- The PARA method (Tiago Forte, Building a Second Brain): every piece of
-- knowledge lives in one of 4 categories ordered by actionability:
--   projects  → finite work with a deadline
--   areas     → ongoing responsibilities (Profissional / Saúde / Pessoal)
--   resources → topics of recurring interest (Books, study areas)
--   archive   → inactive items from the other three
--
-- A folder belongs to one of these categories. A note belongs to one folder
-- (or to the Inbox = folder_id IS NULL — see 057_notes_folder.sql).
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'para_category') then
    create type para_category as enum ('projects','areas','resources','archive');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'para_project_status') then
    create type para_project_status as enum ('active','on_hold','completed');
  end if;
end $$;

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  para_category para_category not null,
  parent_folder_id uuid references folders(id) on delete cascade,
  title text not null,
  description text,
  -- Project-only metadata. Null for non-project folders.
  status para_project_status,
  due_date date,
  -- Areas folders preserve the life_area link so lib/area-color.ts works.
  life_area life_area,
  -- 'books' = the seeded folder that deep-links to /books. Unique per user.
  kind text not null default 'standard'
    check (kind in ('standard','books')),
  position int not null default 0,
  -- Soft-delete; distinct from para_category='archive' (which is a real move).
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_user_category_idx
  on folders(user_id, para_category, position);

create index if not exists folders_parent_idx
  on folders(parent_folder_id, position);

create unique index if not exists folders_user_books_unique
  on folders(user_id) where kind = 'books';

alter table folders enable row level security;

drop policy if exists folders_all on folders;
create policy folders_all on folders for all
  using (auth.uid() = user_id);

create trigger folders_updated_at
  before update on folders
  for each row execute function set_updated_at();
