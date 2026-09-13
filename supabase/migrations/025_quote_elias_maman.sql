-- =============================================================
-- 025_quote_elias_maman.sql
-- Adds Elias Maman + first quote (Portuguese). Photo NULL — sandboxed
-- screenshot temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Elias Maman', null
where not exists (select 1 from authors where name = 'Elias Maman');

insert into quotes (author_id, text)
select a.id,
       'Seja esquisito em 2026.'
from authors a
where a.name = 'Elias Maman'
  and not exists (
    select 1 from quotes q
    where q.text = 'Seja esquisito em 2026.'
  );
