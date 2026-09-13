-- =============================================================
-- 026_quote_dana_white.sql
-- Adds Dana White + first quote. Photo NULL — sandboxed screenshot
-- temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Dana White', null
where not exists (select 1 from authors where name = 'Dana White');

insert into quotes (author_id, text)
select a.id,
       'You just gotta grind. This next generation is just such a fucking group of pussies, man. If you''re a fucking savage and you get out there and you grind hard and you want it bad enough, you can run all these guys over, man.'
from authors a
where a.name = 'Dana White'
  and not exists (
    select 1 from quotes q
    where q.text = 'You just gotta grind. This next generation is just such a fucking group of pussies, man. If you''re a fucking savage and you get out there and you grind hard and you want it bad enough, you can run all these guys over, man.'
  );
