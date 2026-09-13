-- =============================================================
-- 017_quote_unknown_discipline.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       'Everybody says discipline is so important, but they never wanna tell you why. I''ll tell you why discipline is so important. It''s the strongest form of self-love. It''s ignoring something you want right now for something better later on. Discipline reveals a commitment you have to your dreams, especially on days where you don''t want to. The future you is depending on the current you to keep the promises you made to yourself yesterday.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text = 'Everybody says discipline is so important, but they never wanna tell you why. I''ll tell you why discipline is so important. It''s the strongest form of self-love. It''s ignoring something you want right now for something better later on. Discipline reveals a commitment you have to your dreams, especially on days where you don''t want to. The future you is depending on the current you to keep the promises you made to yourself yesterday.'
  );
