-- =============================================================
-- 007_quotes.sql
-- Quote of the Day support for the Today screen — replaces the
-- editable intention block with a daily-rotating quote pulled from
-- a curated library.
-- =============================================================

create table if not exists authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table authors enable row level security;
create policy authors_read on authors
  for select using (auth.role() = 'authenticated');

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references authors(id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  source text,
  created_at timestamptz not null default now()
);

alter table quotes enable row level security;
create policy quotes_read on quotes
  for select using (auth.role() = 'authenticated');

create index if not exists quotes_author_idx on quotes(author_id);

-- Seed: Shaan Puri + first quote.
with new_author as (
  insert into authors (name, photo_url)
  values ('Shaan Puri', '/authors/shaan.png')
  returning id
)
insert into quotes (author_id, text)
select id, 'BUSYness is for losers.' from new_author;
