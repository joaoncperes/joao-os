-- =============================================================
-- 016_quote_unknown_dont_be_normal.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'Don''t be normal. Read what no one reads. Try what no one tries. Do what no one does. Enjoy the pain and pleasure of a path no one''s walked before.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = 'Don''t be normal. Read what no one reads. Try what no one tries. Do what no one does. Enjoy the pain and pleasure of a path no one''s walked before.'
  );
