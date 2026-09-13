-- Stamp the owner's local calendar date when Priority changes to Read.
-- Existing dates are historical data; updated_at is NOT a completion history.
-- Do not backfill undated legacy books with their import / last-edit date.
create or replace function public.set_book_finished_date()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_tz text;
begin
  if new.priority = 'lido' then
    if tg_op = 'UPDATE' then
      if old.priority = 'lido' then
        return new;
      end if;
    elsif new.finished_at is not null then
      -- Preserve an explicitly supplied historical date on import / creation.
      return new;
    end if;

    select time_zone into owner_tz from public.users where id = new.user_id;
    new.finished_at := (statement_timestamp() at time zone coalesce(owner_tz, 'America/Sao_Paulo'))::date;
  end if;
  return new;
end;
$$;

create trigger books_finished_date
before insert or update on public.books
for each row execute function public.set_book_finished_date();
