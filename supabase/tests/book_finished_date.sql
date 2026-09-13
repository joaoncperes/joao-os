-- Run in an empty disposable PostgreSQL database.
begin;
create table public.users (id uuid primary key, time_zone text);
create table public.books (id int primary key, user_id uuid, priority text, finished_at date, title text);
insert into public.users values ('00000000-0000-0000-0000-000000000001', 'America/Sao_Paulo');
-- Legacy records must not be backfilled with an invented finish date.
insert into public.books values (1, '00000000-0000-0000-0000-000000000001', 'lido', null, 'Legacy');
\ir ../migrations/081_book_finished_date.sql
\ir ../migrations/082_book_finished_year.sql
\ir ../migrations/084_book_finished_month.sql
do $$ begin
  assert (select finished_at is null from books where id = 1), 'Migration preserves unknown historical dates';
end $$;
insert into books values (2, '00000000-0000-0000-0000-000000000001', 'lendo', '2020-01-01', 'Reading');
update books set priority = 'lido' where id = 2;
do $$ begin
  assert (select finished_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date from books where id = 2), 'Transition stamps owner local date, replacing stale date';
end $$;
insert into books values (3, '00000000-0000-0000-0000-000000000001', 'lido', '2024-02-29', 'Historical import');
update books set title = 'Edited title', priority = 'lido' where id = 3;
do $$ begin
  assert (select finished_at = '2024-02-29'::date from books where id = 3), 'Import and ordinary edits preserve historical completion';
end $$;
insert into books values (4, '00000000-0000-0000-0000-000000000001', 'lido', null, 'Just finished');
do $$ begin
  assert (select finished_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date from books where id = 4), 'New Read entries default to today';
end $$;
update books set priority = 'lendo' where id = 3;
update books set priority = 'lido' where id = 3;
do $$ begin
  assert (select finished_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date from books where id = 3), 'Marking Read again records the new completion date';
end $$;
insert into books (id,user_id,priority,title,finished_year) values
  (5, '00000000-0000-0000-0000-000000000001', 'lido', 'Known year only', 2026);
update books set title = 'Edited year-only book' where id = 5;
do $$ begin
  assert (select finished_at is null and finished_year = 2026 from books where id = 5), 'Historical year survives creation and ordinary edits without inventing a day';
end $$;
update books set finished_at = '2026-02-01' where id = 5;
do $$ begin
  assert (select finished_at = '2026-02-01'::date and finished_year is null from books where id = 5), 'Exact date replaces year-only precision';
end $$;
update books set finished_at = null, finished_year = 2025, priority = 'lendo' where id = 5;
update books set priority = 'lido' where id = 5;
do $$ begin
  assert (select finished_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date and finished_year is null from books where id = 5), 'New Read transition replaces historical year with current exact date';
end $$;
insert into books (id,user_id,priority,title,finished_year,finished_month,finished_month_estimated) values
  (6, '00000000-0000-0000-0000-000000000001', 'lido', 'Estimated month', 2026, 2, true);
update books set title = 'Edited estimated book' where id = 6;
do $$ begin
  assert (select finished_at is null and finished_year = 2026 and finished_month = 2 and finished_month_estimated from books where id = 6), 'Historical month and estimate survive creation and ordinary edits';
end $$;
update books set finished_at = '2026-03-02' where id = 6;
do $$ begin
  assert (select finished_at = '2026-03-02'::date and finished_year is null and finished_month is null and not finished_month_estimated from books where id = 6), 'Exact date clears month and estimate';
end $$;
update books set priority = 'lendo', finished_at = null, finished_year = 2026, finished_month = 2, finished_month_estimated = true where id = 6;
update books set priority = 'lido' where id = 6;
do $$ begin
  assert (select finished_at = (statement_timestamp() at time zone 'America/Sao_Paulo')::date and finished_month is null and not finished_month_estimated from books where id = 6), 'Read transition clears previous month estimate';
end $$;
rollback;
