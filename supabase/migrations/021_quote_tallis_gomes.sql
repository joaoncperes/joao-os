-- =============================================================
-- 021_quote_tallis_gomes.sql
-- Adds Tallis Gomes + first quote (Portuguese). Photo NULL — sandboxed
-- screenshot temp dir again. Two paragraphs joined into one block
-- (the QuoteOfDay component doesn't render newlines yet). Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Tallis Gomes', null
where not exists (select 1 from authors where name = 'Tallis Gomes');

insert into quotes (author_id, text)
select a.id,
       'A galera que nasceu em 2000 pra frente não topa abraçar o sofrimento. Ele faz o que? As escolhas de curto prazo: não quero dormir na empresa, não quero ralar pra construir algo agora, não quero ter que estudar. Agora você vai ter uma relação hedonística com a tua vida: "Ao invés de eu ler, vou assistir Netflix". Faz isso que você vai ver onde tu vai chegar, tu vai ter uma vida de merda. Você tem um benefício agora e paga o preço no longo prazo.'
from authors a
where a.name = 'Tallis Gomes'
  and not exists (
    select 1 from quotes q
    where q.text = 'A galera que nasceu em 2000 pra frente não topa abraçar o sofrimento. Ele faz o que? As escolhas de curto prazo: não quero dormir na empresa, não quero ralar pra construir algo agora, não quero ter que estudar. Agora você vai ter uma relação hedonística com a tua vida: "Ao invés de eu ler, vou assistir Netflix". Faz isso que você vai ver onde tu vai chegar, tu vai ter uma vida de merda. Você tem um benefício agora e paga o preço no longo prazo.'
  );
