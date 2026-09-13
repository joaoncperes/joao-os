-- A confirmed historical year must not fabricate a month/day for the chart.
alter table public.books
  add column finished_year integer check (finished_year between 1000 and 9999),
  add constraint books_finish_precision check (finished_at is null or finished_year is null);

comment on column public.books.finished_year is
  'Known completion year when the exact finish date is unknown. Null when finished_at is recorded.';

create or replace function public.set_book_finished_date()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_tz text;
  stamp_today boolean := false;
begin
  if new.priority = 'lido' then
    if tg_op = 'UPDATE' then
      stamp_today := old.priority is distinct from 'lido';
    else
      stamp_today := new.finished_at is null and new.finished_year is null;
    end if;
    if stamp_today then
      select time_zone into owner_tz from public.users where id = new.user_id;
      new.finished_at := (statement_timestamp() at time zone coalesce(owner_tz, 'America/Sao_Paulo'))::date;
    end if;
  end if;
  -- Adding an exact date supersedes the historical year, including on rereads.
  if new.finished_at is not null then new.finished_year := null; end if;
  return new;
end;
$$;
