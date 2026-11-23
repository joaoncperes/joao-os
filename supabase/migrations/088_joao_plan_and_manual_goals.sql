-- 088_joao_plan_and_manual_goals.sql
-- 1. Metas manuais (ex.: tocar piano): unidade livre + registros por dia.
-- 2. Plano de treino do João (São Paulo 4x — Smart Fit):
--    Seg Push · Ter Pull · Qui Legs · Sex Upper · Qua/Sáb/Dom descanso.

-- ---------------------------------------------------------------
-- 1. Metas manuais
-- ---------------------------------------------------------------
alter table public.goals add column if not exists unit text;

create table if not exists public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  entry_date date not null default current_date,
  value numeric not null check (value > 0),
  created_at timestamptz not null default now()
);
create index if not exists goal_entries_goal_date_idx
  on public.goal_entries(goal_id, entry_date desc);
alter table public.goal_entries enable row level security;
drop policy if exists goal_entries_all on public.goal_entries;
create policy goal_entries_all on public.goal_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.goal_entries to authenticated, service_role;

-- ---------------------------------------------------------------
-- 2. Plano de treino
-- ---------------------------------------------------------------
-- 2a. Exercícios (cria os que faltam; reativa se estavam arquivados)
insert into public.exercises (user_id, name, type, muscle_group_primary)
select u.id, e.name, e.type, e.muscle
from public.users u
cross join (values
  ('Supino máquina', 'compound', 'peito'),
  ('Supino inclinado com halteres', 'compound', 'peito'),
  ('Crucifixo máquina', 'isolation', 'peito'),
  ('Tríceps polia', 'isolation', 'tríceps'),
  ('Tríceps testa polia', 'isolation', 'tríceps'),
  ('Elevação lateral', 'isolation', 'ombro'),
  ('Abdômen sentado máquina', 'isolation', 'abdômen'),
  ('Barra fixa', 'compound', 'costas'),
  ('Remada pronada máquina', 'compound', 'costas'),
  ('Remada triângulo', 'compound', 'costas'),
  ('Rosca Scott', 'isolation', 'bíceps'),
  ('Rosca martelo corda', 'isolation', 'bíceps'),
  ('Panturrilha sentado', 'isolation', 'panturrilha'),
  ('Panturrilha leg press', 'isolation', 'panturrilha'),
  ('Agachamento Smith', 'compound', 'quadríceps'),
  ('Stiff', 'compound', 'posterior de coxa'),
  ('Cadeira extensora', 'isolation', 'quadríceps'),
  ('Cadeira flexora', 'isolation', 'posterior de coxa'),
  ('Abdômen infra', 'isolation', 'abdômen'),
  ('Supino reto barra', 'compound', 'peito'),
  ('Paralela (ênfase peito)', 'compound', 'peito'),
  ('Remada máquina', 'compound', 'costas'),
  ('Desenvolvimento com halteres', 'compound', 'ombro'),
  ('Rosca direta polia', 'isolation', 'bíceps'),
  ('Tríceps francês polia', 'isolation', 'tríceps')
) as e(name, type, muscle)
on conflict (user_id, name) do update
  set archived = false,
      muscle_group_primary = excluded.muscle_group_primary;

-- 2b. Dias da semana (0 = domingo)
insert into public.workout_split (user_id, day_of_week, split_name, is_rest)
select u.id, d.dow, d.name, d.rest
from public.users u
cross join (values
  (1, 'Push', false),
  (2, 'Pull', false),
  (3, 'Descanso', true),
  (4, 'Legs', false),
  (5, 'Upper', false),
  (6, 'Descanso', true),
  (0, 'Descanso', true)
) as d(dow, name, rest)
on conflict (user_id, day_of_week) do update
  set split_name = excluded.split_name,
      is_rest = excluded.is_rest;

-- 2c. Troca a lista de exercícios de cada dia
delete from public.workout_split_exercises wse
using public.workout_split ws
where wse.workout_split_id = ws.id;

insert into public.workout_split_exercises (user_id, workout_split_id, exercise_id, position, default_sets)
select ws.user_id, ws.id, ex.id, p.pos, p.sets
from (values
  (1, 'Supino máquina', 1, 3),
  (1, 'Supino inclinado com halteres', 2, 2),
  (1, 'Crucifixo máquina', 3, 3),
  (1, 'Tríceps polia', 4, 3),
  (1, 'Tríceps testa polia', 5, 2),
  (1, 'Elevação lateral', 6, 3),
  (1, 'Abdômen sentado máquina', 7, 3),
  (2, 'Barra fixa', 1, 3),
  (2, 'Remada pronada máquina', 2, 3),
  (2, 'Remada triângulo', 3, 3),
  (2, 'Rosca Scott', 4, 3),
  (2, 'Rosca martelo corda', 5, 3),
  (2, 'Panturrilha sentado', 6, 3),
  (4, 'Panturrilha leg press', 1, 3),
  (4, 'Agachamento Smith', 2, 3),
  (4, 'Stiff', 3, 3),
  (4, 'Cadeira extensora', 4, 3),
  (4, 'Cadeira flexora', 5, 3),
  (4, 'Abdômen infra', 6, 3),
  (5, 'Supino reto barra', 1, 3),
  (5, 'Paralela (ênfase peito)', 2, 3),
  (5, 'Remada máquina', 3, 3),
  (5, 'Desenvolvimento com halteres', 4, 3),
  (5, 'Rosca direta polia', 5, 3),
  (5, 'Tríceps francês polia', 6, 3),
  (5, 'Abdômen infra', 7, 3)
) as p(dow, name, pos, sets)
join public.workout_split ws on ws.day_of_week = p.dow
join public.exercises ex on ex.user_id = ws.user_id and ex.name = p.name;

-- 2d. Arquiva exercícios antigos (do Pedro) que saíram do plano e nunca
--     tiveram série registrada. Os que têm histórico ficam intactos.
update public.exercises e
set archived = true
where not exists (select 1 from public.workout_split_exercises w where w.exercise_id = e.id)
  and not exists (select 1 from public.exercise_sets s where s.exercise_id = e.id);
