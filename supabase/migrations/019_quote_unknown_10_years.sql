-- =============================================================
-- 019_quote_unknown_10_years.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       '10 years of pain for 60 years of freedom or 10 years of freedom for 60 years of pain.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = '10 years of pain for 60 years of freedom or 10 years of freedom for 60 years of pain.'
  );
