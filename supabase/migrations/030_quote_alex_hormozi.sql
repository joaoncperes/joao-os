-- =============================================================
-- 030_quote_alex_hormozi.sql
-- Adds Alex Hormozi + first quote. Photo NULL — no file path provided.
-- Multi-line structure preserved via whitespace-pre-line. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Alex Hormozi', null
where not exists (select 1 from authors where name = 'Alex Hormozi');

insert into quotes (author_id, text)
select a.id,
       E'Those first nine businesses didn''t really amount to anything. Nine, nine. As in:\n1. The first one spent time, fucking failed.\n2. The second one, this one will be different, fucking failed.\n3. The third one, this one, this is the one.\n\nI''m just painting this picture because it''s painful as shit, because the whole time everyone is telling you "I told you so" and you''re right today but not forever.'
from authors a
where a.name = 'Alex Hormozi'
  and not exists (
    select 1 from quotes q
    where q.text like 'Those first nine businesses didn''t really amount to anything.%'
  );
