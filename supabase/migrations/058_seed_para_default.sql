-- =============================================================
-- 058_seed_para_default.sql
-- Seed PARA folders + migrate existing rows for every existing user.
-- Idempotent: re-running is a no-op.
--
-- For each user:
--   * Seed 3 Areas folders (Profissional / Saúde / Pessoal) linked to
--     the matching life_area enum so chip colors keep working.
--   * Seed Resources "Books" folder (kind='books'); detail page in the app
--     deep-links to /books.
--   * Seed Resources "Perguntas Guia" folder.
--   * Backfill notes.folder_id from the legacy life_area column.
--   * Migrate every resources row with is_guiding_question=true to a note
--     inside "Perguntas Guia".
--   * Migrate every active projects row to a folder in Projects (or
--     Archive when status in {done, archived}).
-- =============================================================

do $$
declare
  u_id uuid;
  prof_id uuid;
  health_id uuid;
  pers_id uuid;
  guiding_id uuid;
  rec record;
begin
  for u_id in select id from users loop
    -- Areas folders.
    if not exists (
      select 1 from folders
      where user_id = u_id and para_category = 'areas' and life_area = 'professional'
    ) then
      insert into folders (user_id, para_category, title, life_area, position)
      values (u_id, 'areas', 'Profissional', 'professional', 0);
    end if;

    if not exists (
      select 1 from folders
      where user_id = u_id and para_category = 'areas' and life_area = 'health'
    ) then
      insert into folders (user_id, para_category, title, life_area, position)
      values (u_id, 'areas', 'Saúde', 'health', 1);
    end if;

    if not exists (
      select 1 from folders
      where user_id = u_id and para_category = 'areas' and life_area = 'personal'
    ) then
      insert into folders (user_id, para_category, title, life_area, position)
      values (u_id, 'areas', 'Pessoal', 'personal', 2);
    end if;

    -- Resources folders.
    if not exists (
      select 1 from folders where user_id = u_id and kind = 'books'
    ) then
      insert into folders (user_id, para_category, title, kind, position)
      values (u_id, 'resources', 'Books', 'books', 0);
    end if;

    if not exists (
      select 1 from folders
      where user_id = u_id and para_category = 'resources' and title = 'Perguntas Guia'
    ) then
      insert into folders (user_id, para_category, title, position)
      values (u_id, 'resources', 'Perguntas Guia', 1);
    end if;

    -- Resolve seeded folder IDs for backfill.
    select id into prof_id   from folders where user_id = u_id and para_category = 'areas' and life_area = 'professional' limit 1;
    select id into health_id from folders where user_id = u_id and para_category = 'areas' and life_area = 'health'       limit 1;
    select id into pers_id   from folders where user_id = u_id and para_category = 'areas' and life_area = 'personal'     limit 1;
    select id into guiding_id from folders where user_id = u_id and para_category = 'resources' and title = 'Perguntas Guia' limit 1;

    -- Notes: assign folder_id by life_area (only when not yet assigned).
    update notes set folder_id = prof_id   where user_id = u_id and life_area = 'professional' and folder_id is null;
    update notes set folder_id = health_id where user_id = u_id and life_area = 'health'       and folder_id is null;
    update notes set folder_id = pers_id   where user_id = u_id and life_area = 'personal'     and folder_id is null;

    -- Guiding questions → notes inside "Perguntas Guia".
    for rec in
      select title, description
      from resources
      where user_id = u_id and is_guiding_question = true and archived_at is null
    loop
      if not exists (
        select 1 from notes
        where user_id = u_id and folder_id = guiding_id and title = rec.title
      ) then
        insert into notes (user_id, folder_id, title, content_md, source)
        values (u_id, guiding_id, rec.title, coalesce(rec.description, ''), 'import');
      end if;
    end loop;

    -- Legacy projects → folders. Expected empty (UI never exposed); kept
    -- in case there's seed data.
    for rec in
      select title, description, status, due_date, life_area
      from projects
      where user_id = u_id and archived_at is null
    loop
      if not exists (
        select 1 from folders
        where user_id = u_id
          and para_category in ('projects','archive')
          and title = rec.title
      ) then
        insert into folders (user_id, para_category, title, description, due_date, life_area, status, position)
        values (
          u_id,
          case when rec.status in ('done','archived') then 'archive'::para_category
               else 'projects'::para_category end,
          rec.title,
          rec.description,
          rec.due_date,
          rec.life_area,
          case
            when rec.status = 'active' then 'active'::para_project_status
            when rec.status = 'paused' then 'on_hold'::para_project_status
            when rec.status = 'done'   then 'completed'::para_project_status
            else null
          end,
          0
        );
      end if;
    end loop;
  end loop;
end $$;
