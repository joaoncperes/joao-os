-- =============================================================
-- 024_quote_unknown_winners.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'Winners work as hard as possible and still worry that they are being lazy.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = 'Winners work as hard as possible and still worry that they are being lazy.'
  );
