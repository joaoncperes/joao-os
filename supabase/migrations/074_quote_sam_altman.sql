-- =============================================================
-- 074_quote_sam_altman.sql
-- Adds Sam Altman + 1 founder quote.
-- Photo NULL — UI falls back to initials. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Sam Altman', null
where not exists (select 1 from authors where name = 'Sam Altman');

insert into quotes (author_id, text)
select a.id, 'Your job as a founder: talk to users and build something people love.'
from authors a
where a.name = 'Sam Altman'
  and not exists (
    select 1 from quotes q
    where q.text like 'Your job as a founder:%'
  );
