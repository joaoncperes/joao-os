-- =============================================================
-- 020_quote_jorge_paulo_lemann.sql
-- Adds Jorge Paulo Lemann + first quote (Portuguese). Photo NULL —
-- macOS sandboxed temp screenshot unreachable. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Jorge Paulo Lemann', null
where not exists (select 1 from authors where name = 'Jorge Paulo Lemann');

insert into quotes (author_id, text)
select a.id,
       'Tem gente que estudou e tem sucesso. Tem gente que não estudou, tem sucesso. E ultimamente, nos Estados Unidos, falam muito sobre grit. Que realmente o importante é a pessoa que corre atrás, que quer chegar lá.'
from authors a
where a.name = 'Jorge Paulo Lemann'
  and not exists (
    select 1 from quotes q
    where q.text = 'Tem gente que estudou e tem sucesso. Tem gente que não estudou, tem sucesso. E ultimamente, nos Estados Unidos, falam muito sobre grit. Que realmente o importante é a pessoa que corre atrás, que quer chegar lá.'
  );
