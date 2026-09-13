-- =============================================================
-- 077_book_categories.sql
-- Books: promote categories from a hardcoded TS array to a user-owned
-- vocabulary that can be created, renamed, recolored and deleted.
--
-- Before this migration, `KNOWN_CATEGORIES` in lib/books-display.ts was the
-- only definition of "the categories Pedro uses". A custom category typed in
-- the book form was persisted onto `books.categories text[]` but had no
-- existence of its own, so it vanished from the picker the next time a
-- different book was opened — which read as "it wasn't saved".
--
-- `books.categories` stays a text[] of NAMES. Renames/deletes cascade through
-- that array in the server actions. Chosen over uuid[] because every read
-- surface (books list filter, the ?category= URL param, book detail chips,
-- markdown export, the Today page select) consumes names directly; the ID
-- model would need a join in each plus a data migration of all book rows.
-- =============================================================

create table if not exists book_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  -- Palette KEY from lib/second-brain/column-display.ts CHIP_COLORS — the DB
  -- stays decoupled from Tailwind classes, same convention as folder columns.
  color text not null default 'gray',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: "gestão" and "Gestão" are the same category.
-- Expression index doubles as the ON CONFLICT target below.
create unique index if not exists book_categories_user_name_uk
  on book_categories (user_id, lower(name));

create index if not exists book_categories_user_pos_idx
  on book_categories (user_id, position, name);

create trigger book_categories_updated_at
  before update on book_categories
  for each row execute function set_updated_at();

alter table book_categories enable row level security;
create policy book_categories_all on book_categories
  for all using (auth.uid() = user_id);

-- =============================================================
-- Seed 1 — the seven built-ins, with the exact colors they render today.
-- Mapping taken from categoryChipClass() in lib/books-display.ts so nothing
-- changes visually on first load.
-- =============================================================

insert into book_categories (user_id, name, color, position)
select u.id, v.name, v.color, v.position
from users u
cross join (values
  ('Hábitos',      'fuchsia', 0),
  ('Mentalidade',  'emerald', 1),
  ('Filosofia',    'violet',  2),
  ('Gestão',       'gray',    3),
  ('Negócios',     'rose',    4),
  ('Comunicação',  'amber',   5),
  ('Criatividade', 'sky',     6)
) as v(name, color, position)
on conflict (user_id, lower(name)) do nothing;

-- =============================================================
-- Seed 2 — rescue every custom category already living on a book row.
-- These are the ones that felt lost: they were saved on the book, but had
-- nowhere to be listed. Colors round-robin the palette starting after the
-- built-ins; positions continue the ordering.
-- =============================================================

with palette as (
  select array['gray','red','orange','amber','yellow',
               'emerald','sky','violet','fuchsia','rose']::text[] as colors
),

extras as (
  select
    b.user_id,
    c.name,
    row_number() over (partition by b.user_id order by c.name) as rn
  from books b
  cross join lateral unnest(b.categories) as c(name)
  where nullif(btrim(c.name), '') is not null
    and not exists (
      select 1 from book_categories bc
      where bc.user_id = b.user_id
        and lower(bc.name) = lower(btrim(c.name))
    )
  group by b.user_id, c.name
)
insert into book_categories (user_id, name, color, position)
select
  e.user_id,
  btrim(e.name),
  p.colors[1 + ((e.rn - 1 + 7) % array_length(p.colors, 1))],
  6 + e.rn
from extras e
cross join palette p
on conflict (user_id, lower(name)) do nothing;

-- =============================================================
-- Cascade RPCs. `books.categories` holds names, so renaming or deleting a
-- category has to rewrite every book row that carries it. PostgREST can't
-- express array_replace/array_remove, and doing it client-side would mean a
-- read-modify-write per book — so it lives here, in one statement.
--
-- security invoker: RLS still applies with the caller's rights, so every
-- statement below is implicitly scoped to auth.uid(). The explicit user_id
-- predicates are belt-and-braces.
-- =============================================================

create or replace function rename_book_category(p_id uuid, p_new_name text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old text;
  v_new text := btrim(p_new_name);
  v_merge boolean := false;
begin
  if v_new = '' then
    raise exception 'Category name cannot be empty.';
  end if;

  select name into v_old
    from book_categories
   where id = p_id and user_id = auth.uid();

  if v_old is null then
    raise exception 'Category not found.';
  end if;

  if v_old = v_new then
    return;
  end if;

  -- Renaming onto a name that already exists merges the two rather than
  -- failing the unique index. Books tagged with both end up with one tag
  -- (the dedupe below handles it).
  select exists (
    select 1 from book_categories
     where user_id = auth.uid()
       and lower(name) = lower(v_new)
       and id <> p_id
  ) into v_merge;

  if v_merge then
    delete from book_categories where id = p_id and user_id = auth.uid();
  else
    update book_categories set name = v_new
     where id = p_id and user_id = auth.uid();
  end if;

  -- Cascade onto books: swap the name, then dedupe in case the book already
  -- carried the merge target. Sorted for a deterministic stored order.
  update books b
     set categories = coalesce((
           select array_agg(distinct x order by x)
             from unnest(array_replace(b.categories, v_old, v_new)) as x
         ), '{}')
   where b.user_id = auth.uid()
     and v_old = any(b.categories);
end;
$$;

create or replace function delete_book_category(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  select name into v_name
    from book_categories
   where id = p_id and user_id = auth.uid();

  if v_name is null then
    raise exception 'Category not found.';
  end if;

  -- Strip the tag from every book that carries it. Destructive and not
  -- undoable — the UI confirms with the affected book count first.
  update books
     set categories = array_remove(categories, v_name)
   where user_id = auth.uid()
     and v_name = any(categories);

  delete from book_categories where id = p_id and user_id = auth.uid();
end;
$$;
