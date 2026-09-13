-- =============================================================
-- 018_quote_guilherme_freire.sql
-- Adds Guilherme Freire + first quote (Portuguese). Photo is NULL — the
-- screenshot Pedro shared was again in a macOS sandboxed temp folder I
-- can't access. Update photo_url once the image is dropped under
-- /public/authors/. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Guilherme Freire', null
where not exists (select 1 from authors where name = 'Guilherme Freire');

insert into quotes (author_id, text)
select a.id,
       'O homem maduro é aquele que é senhor de suas paixões.'
from authors a
where a.name = 'Guilherme Freire'
  and not exists (
    select 1 from quotes q
    where q.text = 'O homem maduro é aquele que é senhor de suas paixões.'
  );
