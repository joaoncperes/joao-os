-- =============================================================
-- Pedro OS — Supabase Schema (Sprint 0, fixed)
-- Single-user PWA. RLS enforces auth.uid() = user_id everywhere.
-- Stack: Postgres 16 + pgvector. Run in Supabase SQL editor.
-- Apply order: 000_schema.sql → 001_handle_new_user.sql → 002_fixes.sql
-- =============================================================

-- -------------------------------------------------------------
-- 0. Extensions
-- -------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists vector;
-- pg_cron is conditional: requires Supabase Pro on some plans.
-- Sprint 0 doesn't need it (insight cron is Sprint 5). Skip silently if unavailable.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable on this plan; skipping (Sprint 0 does not need it).';
  end;
end $$;

-- -------------------------------------------------------------
-- 1. Helper: updated_at trigger
-- -------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================
-- 2. USERS (single row — Pedro)
--    FIX: removed `default auth.uid()` (returns NULL in admin context).
--         Auto-population is handled by the handle_new_user trigger
--         in 001_handle_new_user.sql.
--    FIX: added setup_completed_at to gate the wizard cheaply
--         (single field check, no join, in middleware).
-- =============================================================

create table users (
  id uuid primary key,
  email text not null unique,
  name text not null default 'Pedro',
  time_zone text not null default 'America/Sao_Paulo',
  week_start_day smallint not null default 1 check (week_start_day in (0, 1)), -- 0 = Sunday, 1 = Monday
  time_format smallint not null default 24 check (time_format in (12, 24)),
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at
  before update on users
  for each row execute function set_updated_at();

alter table users enable row level security;
create policy users_select on users for select using (auth.uid() = id);
create policy users_insert on users for insert with check (auth.uid() = id);
create policy users_update on users for update using (auth.uid() = id);

-- =============================================================
-- 3. IDENTITY: Values, Standards, Vision
-- =============================================================

create table core_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  sort_order int not null default 0,
  starred boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index core_values_user_active_idx on core_values(user_id, active);
create trigger core_values_updated_at before update on core_values for each row execute function set_updated_at();

alter table core_values enable row level security;
create policy core_values_all on core_values for all using (auth.uid() = user_id);

create table core_value_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  value_id uuid references core_values(id) on delete set null,
  change_type text not null check (change_type in ('created','renamed','description_updated','retired','reactivated','reordered','starred','unstarred')),
  before_snapshot jsonb,
  after_snapshot jsonb,
  changed_at timestamptz not null default now()
);
create index core_value_history_user_idx on core_value_history(user_id, changed_at desc);

alter table core_value_history enable row level security;
create policy core_value_history_all on core_value_history for all using (auth.uid() = user_id);

create table standards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  area text not null check (area in ('professional','health','family','marriage','cross_cutting')),
  rule text not null,
  leading_indicator text,
  target text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index standards_user_area_idx on standards(user_id, area, active);
create trigger standards_updated_at before update on standards for each row execute function set_updated_at();

alter table standards enable row level security;
create policy standards_all on standards for all using (auth.uid() = user_id);

create table vision_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  horizon text not null check (horizon in ('5y','10y','annual')),
  area text check (area in ('professional','health','family','marriage','cross_cutting','overall')),
  body text not null,
  effective_from date not null default current_date,
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);
create index vision_user_idx on vision_entries(user_id, horizon, effective_from desc);

alter table vision_entries enable row level security;
create policy vision_all on vision_entries for all using (auth.uid() = user_id);

-- =============================================================
-- 4. HABITS & TASKS
-- =============================================================

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  area text not null check (area in ('professional','health','family','marriage','cross_cutting')),
  time_slot time, -- null = all-day
  is_counter boolean not null default false,
  counter_target_value numeric,
  counter_unit text,
  reminder_lead_minutes int default 0,
  freeze_tokens_enabled boolean not null default true,
  sort_order int not null default 0,
  archived boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_active_idx on habits(user_id, archived, sort_order);
create trigger habits_updated_at before update on habits for each row execute function set_updated_at();

alter table habits enable row level security;
create policy habits_all on habits for all using (auth.uid() = user_id);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  completed_at timestamptz,
  value numeric,
  notes text,
  miss_reason text check (miss_reason in ('forgot','skipped','obstacle','rescheduled')),
  freeze_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on habit_logs(user_id, log_date desc);
create index habit_logs_habit_date_idx on habit_logs(habit_id, log_date desc);

alter table habit_logs enable row level security;
create policy habit_logs_all on habit_logs for all using (auth.uid() = user_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  scheduled_date date not null default current_date,
  scheduled_time time,
  area text check (area in ('professional','health','family','marriage','cross_cutting')),
  notes text,
  weekly_commitment_id uuid,
  is_recurring_candidate boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_date_idx on tasks(user_id, scheduled_date, scheduled_time);
create trigger tasks_updated_at before update on tasks for each row execute function set_updated_at();

alter table tasks enable row level security;
create policy tasks_all on tasks for all using (auth.uid() = user_id);

-- =============================================================
-- 5. WORKOUT
-- =============================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('compound','isolation','cardio','mma','mobility')),
  muscle_group_primary text,
  muscle_group_secondary text,
  notes text,
  archived boolean not null default false,
  aliases text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);
create index exercises_user_active_idx on exercises(user_id, archived);
create trigger exercises_updated_at before update on exercises for each row execute function set_updated_at();

alter table exercises enable row level security;
create policy exercises_all on exercises for all using (auth.uid() = user_id);

create table workout_split (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  split_name text not null,
  is_rest boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, day_of_week)
);
create trigger workout_split_updated_at before update on workout_split for each row execute function set_updated_at();

alter table workout_split enable row level security;
create policy workout_split_all on workout_split for all using (auth.uid() = user_id);

create table workout_split_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workout_split_id uuid not null references workout_split(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  position int not null,
  default_sets int not null default 3,
  default_reps_target int,
  notes text,
  created_at timestamptz not null default now()
);
create index workout_split_ex_idx on workout_split_exercises(workout_split_id, position);

alter table workout_split_exercises enable row level security;
create policy workout_split_ex_all on workout_split_exercises for all using (auth.uid() = user_id);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_date date not null default current_date,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  split_name_snapshot text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  energy_pre smallint check (energy_pre between 1 and 5),
  energy_post smallint check (energy_post between 1 and 5),
  post_workout_note text,
  created_at timestamptz not null default now(),
  unique(user_id, session_date)
);
create index workout_sessions_user_date_idx on workout_sessions(user_id, session_date desc);

alter table workout_sessions enable row level security;
create policy workout_sessions_all on workout_sessions for all using (auth.uid() = user_id);

create table exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2),
  reps int,
  rpe smallint check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index exercise_sets_session_idx on exercise_sets(session_id, exercise_id, set_number);
create index exercise_sets_user_exercise_idx on exercise_sets(user_id, exercise_id, completed_at desc);

alter table exercise_sets enable row level security;
create policy exercise_sets_all on exercise_sets for all using (auth.uid() = user_id);

create table cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_id uuid references workout_sessions(id) on delete cascade,
  session_date date not null default current_date,
  type text check (type in ('running','bike','rowing','stairmaster','elliptical','walking','other')),
  duration_minutes int,
  kcal int,
  avg_heart_rate int,
  notes text,
  created_at timestamptz not null default now()
);
create index cardio_user_date_idx on cardio_sessions(user_id, session_date desc);

alter table cardio_sessions enable row level security;
create policy cardio_all on cardio_sessions for all using (auth.uid() = user_id);

create table mma_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_date date not null default current_date,
  focus text,
  intensity smallint check (intensity between 1 and 10),
  sparred boolean not null default false,
  competition_prep_flag boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index mma_user_date_idx on mma_sessions(user_id, session_date desc);

alter table mma_sessions enable row level security;
create policy mma_all on mma_sessions for all using (auth.uid() = user_id);

create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  pr_type text not null check (pr_type in ('max_weight','max_reps_at_weight','max_volume_session')),
  weight_kg numeric(6,2),
  reps int,
  set_id uuid references exercise_sets(id) on delete set null,
  achieved_at timestamptz not null default now(),
  notes text
);
create index pr_user_exercise_idx on personal_records(user_id, exercise_id, achieved_at desc);

alter table personal_records enable row level security;
create policy pr_all on personal_records for all using (auth.uid() = user_id);

-- =============================================================
-- 6. JOURNALING
-- =============================================================

create table journal_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  question_key text not null,
  answer_type text not null check (answer_type in ('text','score','depth_tag','chip','number')),
  required boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  unique(user_id, question_key)
);

alter table journal_questions enable row level security;
create policy journal_questions_all on journal_questions for all using (auth.uid() = user_id);

create table journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  journal_date date not null default current_date,
  win text,
  learned text,
  would_do_differently text,
  one_for_tomorrow text,
  area_pro_score smallint check (area_pro_score between 1 and 5),
  area_health_score smallint check (area_health_score between 1 and 5),
  area_family_score smallint check (area_family_score between 1 and 5),
  area_marriage_score smallint check (area_marriage_score between 1 and 5),
  gratitude jsonb,
  gabi_call_depth smallint check (gabi_call_depth between 1 and 3),
  gabi_call_topic text,
  reach_out_to jsonb,
  free_notes text,
  voice_transcripts jsonb,
  is_partial boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, journal_date)
);
create index journals_user_date_idx on journals(user_id, journal_date desc);
create trigger journals_updated_at before update on journals for each row execute function set_updated_at();

alter table journals enable row level security;
create policy journals_all on journals for all using (auth.uid() = user_id);

-- =============================================================
-- 7. WEEKLY PLANNING
-- =============================================================

create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  iso_year int not null,
  iso_week int not null check (iso_week between 1 and 53),
  week_start_date date not null,
  theme text,
  weekly_question text,
  free_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, iso_year, iso_week)
);
create index weekly_plans_user_idx on weekly_plans(user_id, iso_year desc, iso_week desc);
create trigger weekly_plans_updated_at before update on weekly_plans for each row execute function set_updated_at();

alter table weekly_plans enable row level security;
create policy weekly_plans_all on weekly_plans for all using (auth.uid() = user_id);

create table weekly_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  area text not null check (area in ('professional','health','family','marriage','cross_cutting')),
  sub_area text check (sub_area in ('strategic','product','ai_native','training','recovery','nutrition','mma','parents','brother','friends','gabi','self','other')),
  text text not null,
  status text not null default 'pending' check (status in ('pending','done','partial','missed')),
  status_note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_commitments_plan_idx on weekly_commitments(weekly_plan_id, area);
create trigger weekly_commitments_updated_at before update on weekly_commitments for each row execute function set_updated_at();

alter table weekly_commitments enable row level security;
create policy weekly_commitments_all on weekly_commitments for all using (auth.uid() = user_id);

alter table tasks
  add constraint tasks_weekly_commitment_fk
  foreign key (weekly_commitment_id)
  references weekly_commitments(id)
  on delete set null;

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  area_pro_score smallint check (area_pro_score between 1 and 5),
  area_health_score smallint check (area_health_score between 1 and 5),
  area_family_score smallint check (area_family_score between 1 and 5),
  area_marriage_score smallint check (area_marriage_score between 1 and 5),
  wins text,
  friction text,
  calendar_audit jsonb,
  notes text,
  reviewed_at timestamptz not null default now(),
  unique(weekly_plan_id)
);

alter table weekly_reviews enable row level security;
create policy weekly_reviews_all on weekly_reviews for all using (auth.uid() = user_id);

-- =============================================================
-- 8. MOOD / ENERGY
-- =============================================================

create table mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  log_date date not null default current_date,
  energy_am smallint check (energy_am between 1 and 5),
  energy_pm smallint check (energy_pm between 1 and 5),
  mood smallint check (mood between 1 and 5),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  sleep_hours numeric(3,1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);
create index mood_user_date_idx on mood_logs(user_id, log_date desc);
create trigger mood_updated_at before update on mood_logs for each row execute function set_updated_at();

alter table mood_logs enable row level security;
create policy mood_all on mood_logs for all using (auth.uid() = user_id);

-- =============================================================
-- 9. DECISION ENGINE
-- =============================================================

create table decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  situation text not null,
  options jsonb,
  choice text not null,
  rationale text,
  predicted_outcome text,
  area text check (area in ('professional','health','family','marriage','cross_cutting')),
  tags text[] default '{}',
  logged_at timestamptz not null default now(),
  outcome_review_due_at timestamptz,
  outcome_reviewed_at timestamptz,
  outcome text,
  would_decide_same boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decisions_user_logged_idx on decisions(user_id, logged_at desc);
create index decisions_user_area_idx on decisions(user_id, area);
create index decisions_user_tags_idx on decisions using gin(tags);
create trigger decisions_updated_at before update on decisions for each row execute function set_updated_at();

alter table decisions enable row level security;
create policy decisions_all on decisions for all using (auth.uid() = user_id);

create table decision_embeddings (
  decision_id uuid primary key references decisions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  embedding vector(1536),
  model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);
create index decision_embeddings_ivfflat on decision_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table decision_embeddings enable row level security;
create policy decision_embeddings_all on decision_embeddings for all using (auth.uid() = user_id);

create table heuristics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text not null,
  source_decision_ids uuid[] default '{}',
  promoted_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','paused','retired')),
  retired_at timestamptz,
  notes text
);
create index heuristics_user_status_idx on heuristics(user_id, status);

alter table heuristics enable row level security;
create policy heuristics_all on heuristics for all using (auth.uid() = user_id);

-- =============================================================
-- 10. RELATIONSHIPS
-- =============================================================

create table people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('gabi','family_mom','family_dad','family_brother','family_other','mentor','peer_founder','close_friend','friend','colleague')),
  photo_url text,
  notes text,
  target_cadence_days int,
  last_contact_at timestamptz,
  last_meaningful_contact_at timestamptz,
  birthday date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_user_role_idx on people(user_id, role, active);
create trigger people_updated_at before update on people for each row execute function set_updated_at();

alter table people enable row level security;
create policy people_all on people for all using (auth.uid() = user_id);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  interaction_at timestamptz not null default now(),
  type text not null check (type in ('call','message','in_person','video','letter')),
  depth_tag smallint check (depth_tag between 1 and 3),
  topic text,
  notes text,
  conflict_flag boolean not null default false,
  duration_minutes int,
  created_at timestamptz not null default now()
);
create index interactions_user_person_idx on interactions(user_id, person_id, interaction_at desc);
create index interactions_user_date_idx on interactions(user_id, interaction_at desc);

alter table interactions enable row level security;
create policy interactions_all on interactions for all using (auth.uid() = user_id);

create or replace function update_person_last_contact()
returns trigger as $$
begin
  update people
    set last_contact_at = greatest(coalesce(last_contact_at, '1900-01-01'::timestamptz), new.interaction_at),
        last_meaningful_contact_at = case
          when new.depth_tag >= 2 then greatest(coalesce(last_meaningful_contact_at, '1900-01-01'::timestamptz), new.interaction_at)
          else last_meaningful_contact_at
        end,
        updated_at = now()
    where id = new.person_id;
  return new;
end;
$$ language plpgsql;

create trigger interactions_update_person
  after insert on interactions
  for each row execute function update_person_last_contact();

create table surprise_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  surprise_date date not null default current_date,
  description text not null,
  cost numeric(10,2),
  reaction_notes text,
  created_at timestamptz not null default now()
);
create index surprise_log_user_idx on surprise_log(user_id, surprise_date desc);

alter table surprise_log enable row level security;
create policy surprise_log_all on surprise_log for all using (auth.uid() = user_id);

create table surprise_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  idea text not null,
  source_date date not null default current_date,
  used_at timestamptz,
  source_surprise_log_id uuid references surprise_log(id) on delete set null,
  created_at timestamptz not null default now()
);
create index surprise_ideas_user_unused_idx on surprise_ideas(user_id, used_at);

alter table surprise_ideas enable row level security;
create policy surprise_ideas_all on surprise_ideas for all using (auth.uid() = user_id);

-- =============================================================
-- 11. READING & STUDIES
-- =============================================================

create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  author text,
  category text,
  status text not null default 'in_progress' check (status in ('to_read','in_progress','finished','abandoned')),
  why_picked_up text,
  started_at date,
  finished_at date,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_user_status_idx on books(user_id, status, finished_at desc nulls last);
create trigger books_updated_at before update on books for each row execute function set_updated_at();

alter table books enable row level security;
create policy books_all on books for all using (auth.uid() = user_id);

create table book_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  applied_at date not null default current_date,
  action text not null,
  survived_30d boolean,
  survived_90d boolean,
  reviewed_at_30d timestamptz,
  reviewed_at_90d timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index book_applications_user_idx on book_applications(user_id, applied_at desc);

alter table book_applications enable row level security;
create policy book_applications_all on book_applications for all using (auth.uid() = user_id);

-- =============================================================
-- 12. INSIGHTS & SYSTEM
-- =============================================================

create table insights_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  insight_type text not null check (insight_type in ('drift','pattern','win','ritual_reminder','decision_callback','counterintuitive','weekly_synthesis','monthly_synthesis')),
  title text not null,
  body text not null,
  supporting_data jsonb,
  area text check (area in ('professional','health','family','marriage','cross_cutting','overall')),
  generated_run_id uuid,
  feedback text check (feedback in ('up','down')),
  feedback_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index insights_user_active_idx on insights_cache(user_id, dismissed_at, created_at desc);

alter table insights_cache enable row level security;
create policy insights_all on insights_cache for all using (auth.uid() = user_id);

create table insight_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  run_kind text not null check (run_kind in ('daily','weekly','monthly','on_demand')),
  model text not null,
  input_token_count int,
  output_token_count int,
  estimated_cost_usd numeric(10,5),
  insights_count int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
create index insight_runs_user_idx on insight_runs(user_id, started_at desc);

alter table insight_runs enable row level security;
create policy insight_runs_all on insight_runs for all using (auth.uid() = user_id);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','delivered','failed','dismissed','engaged')),
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  engaged_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index notif_user_scheduled_idx on notifications_log(user_id, scheduled_for desc);

alter table notifications_log enable row level security;
create policy notif_all on notifications_log for all using (auth.uid() = user_id);

create table app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index app_events_user_idx on app_events(user_id, created_at desc);

alter table app_events enable row level security;
create policy app_events_all on app_events for all using (auth.uid() = user_id);

-- =============================================================
-- 13. VIEWS (TZ-aware "today" — see 002_fixes.sql for v_today_habits)
-- =============================================================

-- Last set per exercise (for progressive overload suggestion)
create or replace view v_last_set_per_exercise as
select distinct on (es.exercise_id)
  es.user_id,
  es.exercise_id,
  e.name as exercise_name,
  es.weight_kg,
  es.reps,
  es.rpe,
  es.completed_at
from exercise_sets es
join exercises e on e.id = es.exercise_id
where es.is_warmup = false
order by es.exercise_id, es.completed_at desc;

create or replace view v_weekly_area_scores as
select
  user_id,
  date_trunc('week', journal_date)::date as week_start,
  round(avg(area_pro_score)::numeric, 2) as area_pro_avg,
  round(avg(area_health_score)::numeric, 2) as area_health_avg,
  round(avg(area_family_score)::numeric, 2) as area_family_avg,
  round(avg(area_marriage_score)::numeric, 2) as area_marriage_avg,
  count(*) as journal_count
from journals
group by user_id, date_trunc('week', journal_date);

create or replace view v_relationship_drift as
select
  p.id as person_id,
  p.user_id,
  p.name,
  p.role,
  p.target_cadence_days,
  p.last_meaningful_contact_at,
  case
    when p.last_meaningful_contact_at is null then null
    else extract(day from now() - p.last_meaningful_contact_at)::int
  end as days_since_meaningful,
  case
    when p.target_cadence_days is null then false
    when p.last_meaningful_contact_at is null then true
    else extract(day from now() - p.last_meaningful_contact_at) > p.target_cadence_days
  end as is_drifting
from people p
where p.active = true;

-- =============================================================
-- 14. SEED DATA
-- FIX: removed the original `do $$` block. It used auth.uid() which is
--      NULL in admin SQL editor context, so it silently no-opped.
--      Seeding is now done from the App's setup wizard server actions
--      (which run with Pedro's JWT, so auth.uid() resolves correctly).
-- =============================================================

-- =============================================================
-- 15. Helper functions
-- =============================================================

create or replace function find_similar_decisions(
  query_embedding vector(1536),
  match_threshold float default 0.78,
  match_count int default 3
)
returns table (
  decision_id uuid,
  similarity float,
  situation text,
  choice text,
  outcome text,
  logged_at timestamptz
) as $$
  select
    d.id as decision_id,
    1 - (de.embedding <=> query_embedding) as similarity,
    d.situation,
    d.choice,
    d.outcome,
    d.logged_at
  from decision_embeddings de
  join decisions d on d.id = de.decision_id
  where de.user_id = auth.uid()
    and 1 - (de.embedding <=> query_embedding) > match_threshold
  order by de.embedding <=> query_embedding
  limit match_count;
$$ language sql stable;

-- =============================================================
-- 16. Triggers
-- =============================================================

create or replace function set_outcome_review_due()
returns trigger as $$
begin
  new.outcome_review_due_at := new.logged_at + interval '30 days';
  return new;
end;
$$ language plpgsql;

create trigger decisions_set_review_due
  before insert on decisions
  for each row execute function set_outcome_review_due();

-- =============================================================
-- END OF 000_schema.sql
-- Apply 001_handle_new_user.sql next.
-- =============================================================
