-- =============================================================
-- 031_quote_shaan_puri_startups_fail.sql
-- Adds another Shaan Puri quote to the rotating Quote of the Day pool.
-- Reuses the existing Shaan Puri author entry from migration 007.
-- Multi-line structure preserved via whitespace-pre-line. Idempotent.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       E'Startups fail, but founders don''t. I moved to San Francisco in 2012, and I met a bunch of people. We used to have underground founder meetings where we''re trading tips and tricks. Everybody was doing startups, all living in the same 7-mile radius city. We would just all meet up all the time, and if you track that cohort, it''s basically only two outcomes:\n1. Got so burnt out from the grinding failure that they just stopped after like 3-4 years. They''re like, "Screw this, I''m taking a job, I''m moving back to Connecticut."\n2. Everybody else who stayed in the game won. Literally 100% of my friends who stayed in the game. Some of them went into year 2, some of them went into year 5, and some went into year 9. Now we''re like year 11 or 12. People are winning now, but it feels like a real income. Wow, 12 years? Yeah, but we all started this when we were 21, so like, okay, we''re mid-30s. Yeah, then the odds flip.'
from authors a
where a.name = 'Shaan Puri'
  and not exists (
    select 1 from quotes q
    where q.text like 'Startups fail, but founders don''t.%'
  );
