-- =============================================================
-- 014_quote_chris_williamson_results.sql
-- Adds another Chris Williamson quote. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'Stop complaining about the results you didn''t get from the work you didn''t put in. The only way to become more successful than most people is to be willing to do something most people aren''t willing to do.'
from authors a
where a.name = 'Chris Williamson'
  and not exists (
    select 1 from quotes q
    where q.text = 'Stop complaining about the results you didn''t get from the work you didn''t put in. The only way to become more successful than most people is to be willing to do something most people aren''t willing to do.'
  );
