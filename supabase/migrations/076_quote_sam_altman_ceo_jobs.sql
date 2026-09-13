-- =============================================================
-- 076_quote_sam_altman_ceo_jobs.sql
-- Adds another quote under the existing 'Sam Altman' entry (see 074). Idempotent.
-- Numbered-list quote — QuoteOfDay renders whitespace-pre-line, so
-- real \n breaks are preserved.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       E'The CEO has five jobs:\n\n1. Set the vision\n2. Raise money\n3. Evangelize\n4. Hire and manage\n5. Make sure the entire company executes'
from authors a
where a.name = 'Sam Altman'
  and not exists (
    select 1 from quotes q
    where q.text like 'The CEO has five jobs:%'
  );
