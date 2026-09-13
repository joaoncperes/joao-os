-- =============================================================
-- 028_quote_unknown_pay_the_price.sql
-- Adds another quote under the existing 'Unknown Author' entry. Idempotent.
-- This one uses real newlines for the bullet-style list — the QuoteOfDay
-- component now renders text with whitespace-pre-line.
-- =============================================================

insert into quotes (author_id, text)
select a.id,
       E'You wanna achieve success? You have to pay the price, and it won''t be cheap. It''ll be:\ntireless nights\nlong days\nempty bank accounts\ndepressing thoughts\nisolation\nloneliness\ntribulation\nheartaches\nheadaches\na lot of pain\n\nBut on the other side of pain is pleasure. On the other side of pain is success. If you understand that you have it as the beacon in the forefront of your life, the journey becomes more enjoyable.'
from authors a
where a.name = 'Unknown Author'
  and not exists (
    select 1 from quotes q
    where q.text like '%You wanna achieve success? You have to pay the price%'
  );
