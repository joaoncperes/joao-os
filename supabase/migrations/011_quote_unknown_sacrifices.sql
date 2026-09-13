-- =============================================================
-- 011_quote_unknown_sacrifices.sql
-- Adds an "Unknown Author" entry + first anonymous quote.
-- Idempotent (safe to re-run): only inserts if author/quote not present.
-- The QuoteOfDay component falls back to an initials avatar when
-- photo_url is null, so no photo is needed.
-- =============================================================

insert into authors (name, photo_url)
select 'Unknown Author', null
where not exists (select 1 from authors where name = 'Unknown Author');

insert into quotes (author_id, text)
select a.id,
       'Or you make more sacrifices or reduce your dreams. Choose it.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = 'Or you make more sacrifices or reduce your dreams. Choose it.'
  );
