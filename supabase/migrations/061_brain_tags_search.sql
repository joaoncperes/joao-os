-- =============================================================
-- 061_brain_tags_search.sql
-- Inline hashtags + unified brain search.
-- tags text[] on notes & book_notes (extracted server-side from #hashtags
-- in content_md). search_brain(): one RPC over notes (all folders + Inbox +
-- archived) and book_notes, with optional AND tag filter + free-text query;
-- empty query degrades to a tag-browse ordered by recency. brain_tags():
-- distinct tags + counts for filter chips/autocomplete. 'simple' config
-- everywhere; websearch_to_tsquery is injection-safe and supports
-- "phrases"/-exclude/or.
-- =============================================================

-- 1. tags columns. Additive constant default => no table rewrite in PG15.
alter table notes      add column if not exists tags text[] not null default '{}';
alter table book_notes add column if not exists tags text[] not null default '{}';

create index if not exists notes_tags_idx      on notes      using gin (tags);
create index if not exists book_notes_tags_idx on book_notes using gin (tags);

-- 2. search_brain — unified FTS + tag filter across notes & book_notes.
create or replace function search_brain(
  q                text,
  filter_tags      text[]  default '{}',
  include_archived boolean default true
)
returns table(
  kind          text,
  id            uuid,
  title         text,
  snippet       text,
  tags          text[],
  folder_id     uuid,
  folder_title  text,
  para_category text,
  archived      boolean,
  updated_at    timestamptz,
  rank          real
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with args as (
    select
      nullif(btrim(q), '')                as qtext,
      coalesce(filter_tags, '{}')::text[] as ftags,
      coalesce(include_archived, true)    as inc_arch
  ),
  qry as (
    select
      a.qtext, a.ftags, a.inc_arch,
      case when a.qtext is null then null
           else websearch_to_tsquery('simple', a.qtext) end as tsq
    from args a
  ),
  note_rows as (
    select
      'note'::text as kind,
      n.id         as id,
      coalesce(nullif(n.title, ''), '(sem título)') as title,
      case
        when qry.qtext is null then
          left(btrim(regexp_replace(
            regexp_replace(coalesce(n.content_md, ''), '!?\[[^\]]*\]\([^)]*\)', ' ', 'g'),
            '\s+', ' ', 'g')), 180)
        else
          ts_headline('simple', n.content_md, qry.tsq,
            'MaxFragments=2, MinWords=4, MaxWords=18, StartSel=<mark>, StopSel=</mark>')
      end          as snippet,
      n.tags       as tags,
      n.folder_id  as folder_id,
      f.title      as folder_title,
      case when n.folder_id is null then 'inbox' else f.para_category::text end as para_category,
      (n.archived_at is not null) as archived,
      n.updated_at as updated_at,
      case when qry.tsq is null then 0::real else ts_rank(n.content_tsv, qry.tsq) end as rank
    from notes n
    cross join qry
    left join folders f on f.id = n.folder_id
    where n.user_id = auth.uid()
      and (qry.inc_arch or n.archived_at is null)
      and (qry.qtext is null or n.content_tsv @@ qry.tsq)
      and (cardinality(qry.ftags) = 0 or n.tags @> qry.ftags)
  ),
  book_rows as (
    select
      'book'::text as kind,
      b.id         as id,
      coalesce(nullif(b.title, ''), '(livro sem título)') as title,
      case
        when qry.qtext is null then
          left(btrim(regexp_replace(
            regexp_replace(coalesce(bn.content_md, ''), '!?\[[^\]]*\]\([^)]*\)', ' ', 'g'),
            '\s+', ' ', 'g')), 180)
        else
          ts_headline('simple', bn.content_md, qry.tsq,
            'MaxFragments=2, MinWords=4, MaxWords=18, StartSel=<mark>, StopSel=</mark>')
      end          as snippet,
      bn.tags      as tags,
      null::uuid   as folder_id,
      null::text   as folder_title,
      null::text   as para_category,
      false        as archived,
      bn.updated_at as updated_at,
      case when qry.tsq is null then 0::real else ts_rank(bn.content_tsv, qry.tsq) end as rank
    from book_notes bn
    cross join qry
    join books b on b.id = bn.book_id
    where bn.user_id = auth.uid()
      and (qry.qtext is null or bn.content_tsv @@ qry.tsq)
      and (cardinality(qry.ftags) = 0 or bn.tags @> qry.ftags)
  )
  select kind, id, title, snippet, tags, folder_id, folder_title,
         para_category, archived, updated_at, rank
  from (select * from note_rows union all select * from book_rows) u
  order by rank desc, updated_at desc
  limit 50;
$$;

grant execute on function search_brain(text, text[], boolean) to authenticated;

-- 3. brain_tags — distinct tags + usage counts across both tables.
create or replace function brain_tags()
returns table(tag text, count bigint)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select t.tag, count(*)::bigint as count
  from (
    select unnest(tags) as tag from notes      where user_id = auth.uid()
    union all
    select unnest(tags) as tag from book_notes where user_id = auth.uid()
  ) t
  where t.tag is not null and t.tag <> ''
  group by t.tag
  order by count desc, t.tag asc;
$$;

grant execute on function brain_tags() to authenticated;
