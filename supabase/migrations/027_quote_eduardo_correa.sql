-- =============================================================
-- 027_quote_eduardo_correa.sql
-- Adds Eduardo Correa + first quote (Portuguese). Photo NULL —
-- sandboxed screenshot temp dir again. Idempotent.
-- =============================================================

insert into authors (name, photo_url)
select 'Eduardo Correa', null
where not exists (select 1 from authors where name = 'Eduardo Correa');

insert into quotes (author_id, text)
select a.id,
       'A diferença de um atleta de alta performance para uma pessoa comum é que ambas ouvem as mesmas vozes dentro da cabeça, mas a diferença é que a pessoa de alta performance não negocia com elas. A pessoa comum fica o tempo todo negociando com elas, procurando o caminho mais fácil.'
from authors a
where a.name = 'Eduardo Correa'
  and not exists (
    select 1 from quotes q
    where q.text = 'A diferença de um atleta de alta performance para uma pessoa comum é que ambas ouvem as mesmas vozes dentro da cabeça, mas a diferença é que a pessoa de alta performance não negocia com elas. A pessoa comum fica o tempo todo negociando com elas, procurando o caminho mais fácil.'
  );
