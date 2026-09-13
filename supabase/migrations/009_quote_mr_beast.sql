-- =============================================================
-- 008_quote_mr_beast.sql
-- Adds Mr. Beast + first quote to the rotating Quote of the Day pool.
-- Idempotent (safe to re-run): only inserts if author/quote not already present.
-- =============================================================

insert into authors (name, photo_url)
select 'Mr. Beast', '/authors/mr-beast.jpg'
where not exists (select 1 from authors where name = 'Mr. Beast');

insert into quotes (author_id, text)
select a.id,
       'Clone yourself by calling someone to observe you doing it every time you have to put a fire out.'
from authors a
where a.name = 'Mr. Beast'
  and not exists (
    select 1 from quotes q
    where q.text = 'Clone yourself by calling someone to observe you doing it every time you have to put a fire out.'
  );
