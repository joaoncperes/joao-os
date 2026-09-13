-- =============================================================
-- 023_quote_elon_musk.sql
-- Adds Elon Musk + first quote. Photo NULL — sandboxed screenshot
-- temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Elon Musk', null
where not exists (select 1 from authors where name = 'Elon Musk');

insert into quotes (author_id, text)
select a.id,
       'Just work like hell. I mean, you just have to put in 80-100 hour weeks every week. Other people are putting in 40 hour work weeks and you''re putting in 100 hour work weeks. You will achieve in 4 months what it takes a year to achieve.'
from authors a
where a.name = 'Elon Musk'
  and not exists (
    select 1 from quotes q
    where q.text = 'Just work like hell. I mean, you just have to put in 80-100 hour weeks every week. Other people are putting in 40 hour work weeks and you''re putting in 100 hour work weeks. You will achieve in 4 months what it takes a year to achieve.'
  );
