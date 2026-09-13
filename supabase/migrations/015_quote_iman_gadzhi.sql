-- =============================================================
-- 015_quote_iman_gadzhi.sql
-- Adds Iman Gadzhi + first quote. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Iman Gadzhi', '/authors/iman-gadzhi.jpg'
where not exists (select 1 from authors where name = 'Iman Gadzhi');

insert into quotes (author_id, text)
select a.id,
       'Put your head down for 5 years in your 20s. 5 years. That is all it takes. If you put your head down for five years and don''t get distracted, you will have a lifetime of glory. So get back to work.'
from authors a
where a.name = 'Iman Gadzhi'
  and not exists (
    select 1 from quotes q
    where q.text = 'Put your head down for 5 years in your 20s. 5 years. That is all it takes. If you put your head down for five years and don''t get distracted, you will have a lifetime of glory. So get back to work.'
  );
