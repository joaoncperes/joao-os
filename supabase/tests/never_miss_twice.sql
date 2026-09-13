-- Run only in an empty disposable PostgreSQL database:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/never_miss_twice.sql
begin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
create table public.users (id uuid primary key, time_zone text);
create table public.habits (id uuid primary key, user_id uuid, name text, area text, time_slot time, is_counter boolean, counter_target_value numeric, counter_unit text, sort_order int, created_at timestamptz default now(), archived boolean default false, if_missed_plan text, anchor_habit_id uuid);
create table public.habit_logs (habit_id uuid, user_id uuid, log_date date, completed_at timestamptz, value numeric, miss_reason text, notes text, freeze_used boolean default false, unique(habit_id, log_date));
create role recovery_test_reader;
grant usage on schema public, auth to recovery_test_reader;
grant select on all tables in schema public to recovery_test_reader;
alter table habits enable row level security;
alter table habit_logs enable row level security;
create policy habit_owner on habits using (user_id = auth.uid());
create policy log_owner on habit_logs using (user_id = auth.uid());
insert into users values ('00000000-0000-0000-0000-000000000001','America/Sao_Paulo'), ('00000000-0000-0000-0000-000000000002','Asia/Tokyo');
insert into habits (id,user_id,name,created_at) select ('10000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, '00000000-0000-0000-0000-000000000001', n::text, now()-interval '5 days' from generate_series(1,8) n;
update habits set created_at=now() where name='4';
update habits set created_at=now()-interval '1 day' where name='5';
update habits set archived=true where name='6';
update habits set user_id='00000000-0000-0000-0000-000000000002' where name='8';
insert into habit_logs (habit_id,user_id,log_date,completed_at,freeze_used) select id,user_id,(now() at time zone 'America/Sao_Paulo')::date-1,case when name='2' then now() end,name='3' from habits where name in ('2','3','7');
\ir ../migrations/080_never_miss_twice.sql
grant select on v_today_habits to recovery_test_reader;
set local test.user_id='00000000-0000-0000-0000-000000000001';
set local role recovery_test_reader;
do $$ begin assert (select count(*)=6 from v_today_habits), 'Exclude archived and other users'; assert (select array_agg(name order by name)=array['1','7'] from v_today_habits where missed_yesterday), 'Only absent and incomplete logs trigger; new habits and freezes do not'; end $$;
reset role;
insert into habit_logs(habit_id,user_id,log_date,completed_at) select id,user_id,(now() at time zone 'America/Sao_Paulo')::date-1,now() from habits where name='1';
set local role recovery_test_reader;
do $$ begin assert (select not missed_yesterday from v_today_habits where name='1'), 'Retroactive completion clears reminder'; end $$;
set local test.user_id='00000000-0000-0000-0000-000000000002';
do $$ begin assert (select count(*)=1 from v_today_habits), 'Second user only sees own habit'; assert (select today_in_tz=(now() at time zone 'Asia/Tokyo')::date from v_today_habits), 'User timezone'; end $$;
reset role;
rollback;
