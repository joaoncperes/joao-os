-- =============================================================
-- 032_quote_coldzera.sql
-- Adds Coldzera + first quote (Portuguese). Photo NULL — sandboxed
-- screenshot temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Coldzera', null
where not exists (select 1 from authors where name = 'Coldzera');

insert into quotes (author_id, text)
select a.id,
       'Eu era chato. Eu tinha que ser o último a parar de jogar todo dia e isso era minha rotina normal.'
from authors a
where a.name = 'Coldzera'
  and not exists (
    select 1 from quotes q
    where q.text = 'Eu era chato. Eu tinha que ser o último a parar de jogar todo dia e isso era minha rotina normal.'
  );
