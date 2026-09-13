-- Paul Graham author + "plan every day" quote.
insert into authors (name, photo_url)
select 'Paul Graham', null
where not exists (select 1 from authors where name = 'Paul Graham');

insert into quotes (author_id, text)
select a.id, 'Plan every day of your life, including weekends and holidays.'
from authors a
where a.name = 'Paul Graham'
  and not exists (
    select 1 from quotes q
    where q.text like 'Plan every day of your life, including weekends and holidays%'
  );
