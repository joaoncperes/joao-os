-- Sprint 0+: replace the 4-area weekly commitments grid on the Week page
-- with a flat numbered priority list + a free-form weekly reflection.
-- weekly_commitments stays in place (still used by the Sunday Review surface
-- per scope §6.2); this migration only adds the new affordances.

alter table weekly_plans add column if not exists reflection text;

create table if not exists weekly_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  position int not null check (position between 1 and 20),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, position)
);

create index if not exists weekly_priorities_user_idx
  on weekly_priorities(user_id, weekly_plan_id);

create trigger weekly_priorities_updated_at
  before update on weekly_priorities
  for each row execute function set_updated_at();

alter table weekly_priorities enable row level security;
create policy weekly_priorities_all on weekly_priorities
  for all using (auth.uid() = user_id);
