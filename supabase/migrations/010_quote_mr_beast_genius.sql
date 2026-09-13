-- =============================================================
-- 010_quote_mr_beast_genius.sql
-- Adds another Mr. Beast quote to the rotating Quote of the Day pool.
-- Idempotent (safe to re-run): only inserts if quote not already present.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'You''re crazy until you''re successful. Then you''re a genius.'
from authors a
where a.name = 'Mr. Beast'
  and not exists (
    select 1 from quotes q
    where q.text = 'You''re crazy until you''re successful. Then you''re a genius.'
  );
