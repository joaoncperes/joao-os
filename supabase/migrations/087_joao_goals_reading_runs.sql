-- 087_joao_goals_reading_runs.sql
-- João OS: metas semanais + objetivos de longo prazo, sessões de leitura
-- (minutos) e distância nas corridas.

-- ---------------------------------------------------------------
-- 1. Metas
--    kind = 'weekly'  → meta que reinicia toda semana (segunda a domingo)
--    kind = 'target'  → objetivo "chegar em X até a data Y"
--    metric define de onde o progresso é calculado automaticamente.
-- ---------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('weekly', 'target')),
  metric text not null check (metric in (
    'workouts',         -- treinos de musculação (sessões com séries)
    'runs',             -- corridas registradas
    'run_km',           -- km corridos
    'reading_minutes',  -- minutos de leitura
    'books_finished',   -- livros terminados (só target)
    'exercise_max',     -- maior carga num exercício (só target)
    'manual'            -- valor atualizado à mão (só target)
  )),
  target_value numeric not null check (target_value > 0),
  start_value numeric,
  current_value numeric,
  exercise_id uuid references public.exercises(id) on delete set null,
  start_date date not null default current_date,
  due_date date,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id, archived_at, position);
drop trigger if exists goals_updated_at on public.goals;
create trigger goals_updated_at before update on public.goals
  for each row execute function set_updated_at();
alter table public.goals enable row level security;
drop policy if exists goals_all on public.goals;
create policy goals_all on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 2. Sessões de leitura (minutos por dia, opcionalmente ligadas a um livro)
-- ---------------------------------------------------------------
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  session_date date not null default current_date,
  minutes int not null check (minutes > 0 and minutes <= 1440),
  created_at timestamptz not null default now()
);
create index if not exists reading_sessions_user_date_idx
  on public.reading_sessions(user_id, session_date desc);
alter table public.reading_sessions enable row level security;
drop policy if exists reading_sessions_all on public.reading_sessions;
create policy reading_sessions_all on public.reading_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 3. Corrida: distância
-- ---------------------------------------------------------------
alter table public.cardio_sessions add column if not exists distance_km numeric(6,2)
  check (distance_km is null or distance_km >= 0);

-- ---------------------------------------------------------------
-- 4. Permissões (projetos novos do Supabase não concedem automaticamente)
-- ---------------------------------------------------------------
grant select, insert, update, delete on public.goals, public.reading_sessions
  to authenticated, service_role;

-- ---------------------------------------------------------------
-- 5. Metas iniciais do João
-- ---------------------------------------------------------------
insert into public.goals (user_id, title, kind, metric, target_value, position)
select u.id, g.title, 'weekly', g.metric, g.target, g.pos
from public.users u
cross join (values
  ('Treinar', 'workouts', 4, 10),
  ('Correr', 'runs', 2, 20),
  ('Ler', 'reading_minutes', 315, 30)
) as g(title, metric, target, pos)
where not exists (select 1 from public.goals x where x.user_id = u.id);
