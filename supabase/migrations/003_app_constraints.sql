-- Sprint 1-4 enabling constraints.

-- Enable upsert for exercise sets keyed by (session, exercise, set_number).
alter table exercise_sets
  add constraint exercise_sets_session_exercise_set_uk
  unique (session_id, exercise_id, set_number);

-- Helpful indexes for journal + week views.
create index if not exists journals_user_date_desc on journals(user_id, journal_date desc);
create index if not exists weekly_plans_user_year_week on weekly_plans(user_id, iso_year desc, iso_week desc);
