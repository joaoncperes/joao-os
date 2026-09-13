-- =============================================================
-- 078 — Translate the book category vocabulary to English.
--
-- 077 seeded the vocabulary with the Portuguese names carried over from
-- Notion. App copy is English by default (see pedro-os/CLAUDE.md), so the
-- categories now follow suit.
--
-- `books.categories` stores category NAMES, not ids (see 077's rationale), so
-- every rename has to cascade through that text[] as well — same cascade the
-- rename_book_category() RPC performs, done here in bulk. 'Sales' is already
-- English and is deliberately absent from the map.
--
-- Idempotent: re-running matches nothing, since the old names are gone.
-- =============================================================

do $$
declare
  renamed int;
  touched int;
begin
  create temporary table category_translation (old text primary key, new text)
  on commit drop;

  insert into category_translation (old, new) values
    ('Hábitos',         'Habits'),
    ('Mentalidade',     'Mindset'),
    ('Filosofia',       'Philosophy'),
    ('Gestão',          'Management'),
    ('Negócios',        'Business'),
    ('Comunicação',     'Communication'),
    ('Criatividade',    'Creativity'),
    ('Espiritualidade', 'Spirituality'),
    ('Liderança',       'Leadership'),
    ('Produto',         'Product'),
    ('Política',        'Politics');

  -- Guard: refuse to collide with a name the user already has. The unique
  -- index is on (user_id, lower(name)), so a clash would abort mid-migration.
  if exists (
    select 1
    from book_categories bc
    join category_translation t on lower(t.new) = lower(bc.name)
    where not exists (
      select 1 from book_categories o
      where o.user_id = bc.user_id and lower(o.name) = lower(t.old)
    )
  ) then
    raise exception '[book-categories-en] target name already in use — resolve manually';
  end if;

  -- 1. The vocabulary itself.
  update book_categories bc
     set name = t.new
    from category_translation t
   where lower(bc.name) = lower(t.old);
  get diagnostics renamed = row_count;

  -- 2. Cascade into books.categories. Rebuilt whole rather than patched per
  --    element: array_replace can't do a set of substitutions in one pass.
  --    distinct + order keeps the stored array deterministic, matching what
  --    rename_book_category() leaves behind.
  update books b
     set categories = coalesce((
           select array_agg(distinct coalesce(t.new, x) order by coalesce(t.new, x))
             from unnest(b.categories) as x
             left join category_translation t on lower(t.old) = lower(x)
         ), '{}')
   where exists (
     select 1
       from unnest(b.categories) as x
       join category_translation t on lower(t.old) = lower(x)
   );
  get diagnostics touched = row_count;

  raise notice '[book-categories-en] categories renamed=%, books updated=%',
    renamed, touched;
end $$;
