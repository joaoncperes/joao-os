-- =============================================================
-- 022_quote_jorlan.sql
-- Adds Jorlan + first quote (Portuguese). Photo NULL — sandboxed
-- screenshot temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Jorlan', null
where not exists (select 1 from authors where name = 'Jorlan');

insert into quotes (author_id, text)
select a.id,
       'Quer ver uma verdade pra vocês? Foda-se a genética. Eu quero ver o trabalho duro. Eu quero ver o sangue do olho que você tem. Eu quero ver a honra que você tem de falar assim: "Eu vou ter perna grande, eu vou ter braço grande, eu vou ter a cintura". Não interessa o que você quer. Eu quero saber se você tem culhão pra isso.'
from authors a
where a.name = 'Jorlan'
  and not exists (
    select 1 from quotes q
    where q.text = 'Quer ver uma verdade pra vocês? Foda-se a genética. Eu quero ver o trabalho duro. Eu quero ver o sangue do olho que você tem. Eu quero ver a honra que você tem de falar assim: "Eu vou ter perna grande, eu vou ter braço grande, eu vou ter a cintura". Não interessa o que você quer. Eu quero saber se você tem culhão pra isso.'
  );
