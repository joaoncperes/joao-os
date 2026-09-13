-- =============================================================
-- 075_quote_unknown_founder_pain.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- Multi-line + bullet-style list — the QuoteOfDay card renders
-- whitespace-pre-line, so real \n breaks are preserved.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       E'The difference between the 1st-time Founder and who already made an exit:\n\nPain.\n\nEvery experienced founder got there by eating sh*t, failing hard, and coming back sharper.\n- They''ve been through the fire.\n- They didn''t get lucky, they got better.\n\nWisdom has a price.\nYou pay in time, missteps, and the grit to keep showing up.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text like 'The difference between the 1st-time Founder%'
  );
