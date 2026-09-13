-- =============================================================
-- 012_quote_chris_williamson.sql
-- Adds Chris Williamson + first quote. Photo is NULL for now —
-- the QuoteOfDay component shows a 'C' initials avatar fallback.
-- Update the row with a real photo_url once the image is available
-- under /public/authors/.
-- =============================================================

insert into authors (name, photo_url)
select 'Chris Williamson', null
where not exists (select 1 from authors where name = 'Chris Williamson');

insert into quotes (author_id, text)
select a.id,
       'The magic you are looking for is in the work you are avoiding.'
from authors a
where a.name = 'Chris Williamson'
  and not exists (
    select 1 from quotes q
    where q.text = 'The magic you are looking for is in the work you are avoiding.'
  );
