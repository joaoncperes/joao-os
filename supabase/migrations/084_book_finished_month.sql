-- Support confirmed / estimated historical months without inventing a day.
alter table public.books
  add column finished_month smallint check (finished_month between 1 and 12),
  add column finished_month_estimated boolean not null default false,
  add constraint books_finish_month_requires_year check (finished_month is null or finished_year is not null),
  add constraint books_estimated_month_requires_month check (not finished_month_estimated or finished_month is not null);

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
  -- Exact dates supersede historical year/month precision and estimates.
  if new.finished_at is not null then
    new.finished_year := null;
    new.finished_month := null;
    new.finished_month_estimated := false;
  end if;
  return new;
end;
$$;
