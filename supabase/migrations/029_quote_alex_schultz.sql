-- =============================================================
-- 029_quote_alex_schultz.sql
-- Adds Alex Schultz + first quote (multi-paragraph). Photo NULL —
-- no file path provided, only an inline image. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Alex Schultz', null
where not exists (select 1 from authors where name = 'Alex Schultz');

insert into quotes (author_id, text)
select a.id,
       E'The plan violently executed today is better than a perfect plan tomorrow.\n\nOne of the things Chamath instilled in us, and Javi still instills in us, and Mark instills across the whole of Facebook: if this move passes, don''t be afraid to break stuff. Ethos. If you can run more experiments than the next guy, if you can be hungry for growth, if you fight and die for every extra user, you stay up late at night to get those extra users to run those experiments, to get the data and do it over and over and over again. You will grow faster.\n\nMark has said he thinks we won because we want it more, and I really believe that. We just worked really hard. It''s not like we''re crazy smart or we''ve all done these crazy things before. We just worked really, really hard and we executed fast. I strongly encourage you to do that. Growth is optional. Thank you.'
from authors a
where a.name = 'Alex Schultz'
  and not exists (
    select 1 from quotes q
    where q.text like 'The plan violently executed today is better than a perfect plan tomorrow.%'
  );
