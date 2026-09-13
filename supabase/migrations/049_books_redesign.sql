-- =============================================================
-- 049_books_redesign.sql
-- Books: align with Pedro's Notion "Livros" model and add rich notes pages.
--
-- - books drops the old single-value `status`, `category`, `why_picked_up`,
--   `notes` columns and gains `priority` (Notion's 6-state field),
--   `categories text[]` (multi-tag), `why` (renamed), and `position`.
-- - book_notes stores TipTap-native JSON plus a derived markdown column
--   (so we get full-text search via a generated tsvector and easy export).
-- - storage bucket `book-images` carries inline note images, RLS-scoped
--   to the owner via the <user_id>/... folder convention.
-- =============================================================

-- 1. Drop the legacy index that references `status` (it can't survive the
--    column drop and would block the migration otherwise).
drop index if exists books_user_status_idx;

-- 2. Drop the legacy columns. The books table is unused so far — no UI
--    exposes it — so a destructive change is safe. The `0..N rows` check
--    happens before push; see plan verification.
alter table books drop column if exists status;
alter table books drop column if exists category;
alter table books drop column if exists notes;
alter table books drop column if exists why_picked_up;

-- 3. Add the Notion-mirroring columns. `priority` is a single field that
--    encodes both reading state (lendo/lido) and importance (urgente..baixa).
alter table books
  add column if not exists priority text not null default 'media'
    check (priority in ('lendo','urgente','alta','media','baixa','lido')),
  add column if not exists categories text[] not null default '{}',
  add column if not exists why text,
  add column if not exists position int not null default 0;

-- 4. Replacement index for list ordering.
create index if not exists books_user_priority_idx
  on books(user_id, priority, finished_at desc nulls last, position);

-- =============================================================
-- 5. book_notes — one rich-content page per book.
-- =============================================================

create table if not exists book_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade unique,
  -- TipTap document. Default is an empty doc so the editor mounts cleanly.
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  -- Derived markdown — client-serialised on every save. Drives search and export.
  content_md text not null default '',
  -- Generated tsvector for full-text search. `simple` config is the right
  -- choice for a mixed PT/EN corpus (no stemming surprises across languages).
  content_tsv tsvector generated always as (to_tsvector('simple', coalesce(content_md, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_notes_tsv_idx on book_notes using gin (content_tsv);
create index if not exists book_notes_book_idx on book_notes(book_id);

create trigger book_notes_updated_at
  before update on book_notes
  for each row execute function set_updated_at();

alter table book_notes enable row level security;
create policy book_notes_all on book_notes
  for all using (auth.uid() = user_id);

-- =============================================================
-- 6. Storage: book-images bucket for inline note images.
--    Paths: <user_id>/<book_id>/<uuid>.<ext>
-- =============================================================

-- Public bucket: anyone with the URL can GET (the URLs are random UUIDs so
-- they're effectively unguessable). Writes/deletes are still RLS-gated to
-- the owner via the insert/update/delete policies below.
insert into storage.buckets (id, name, public)
values ('book-images', 'book-images', true)
on conflict (id) do update set public = true;

drop policy if exists "book_images_owner_select" on storage.objects;
drop policy if exists "book_images_owner_insert" on storage.objects;
drop policy if exists "book_images_owner_update" on storage.objects;
drop policy if exists "book_images_owner_delete" on storage.objects;

create policy "book_images_owner_select" on storage.objects for select
  using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book_images_owner_insert" on storage.objects for insert
  with check (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book_images_owner_update" on storage.objects for update
  using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book_images_owner_delete" on storage.objects for delete
  using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================
-- 7. Search RPC — full-text search across the current user's notes.
--    Returns the matching book + a highlighted snippet.
-- =============================================================

create or replace function search_book_notes(q text)
returns table(book_id uuid, title text, snippet text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    b.id as book_id,
    b.title,
    ts_headline(
      'simple',
      n.content_md,
      plainto_tsquery('simple', q),
      'MaxFragments=2, MinWords=4, MaxWords=18, StartSel=<mark>, StopSel=</mark>'
    ) as snippet
  from book_notes n
  join books b on b.id = n.book_id
  where n.user_id = auth.uid()
    and length(coalesce(n.content_md, '')) > 0
    and n.content_tsv @@ plainto_tsquery('simple', q)
  order by ts_rank(n.content_tsv, plainto_tsquery('simple', q)) desc
  limit 20;
$$;

grant execute on function search_book_notes(text) to authenticated;
