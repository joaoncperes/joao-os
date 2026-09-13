-- =============================================================
-- 013_quote_unknown_competition.sql
-- Adds another quote under the existing 'Unknown Author' entry.
-- Idempotent (safe to re-run).
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'Your competition isn''t with others. It''s with your laziness, your poor diet, the studies you ignore, your lack of discipline. Your only competition is with yourself.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = 'Your competition isn''t with others. It''s with your laziness, your poor diet, the studies you ignore, your lack of discipline. Your only competition is with yourself.'
  );
