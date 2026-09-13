-- =============================================================
-- 064 — Articles (blog).
--
-- Pedro authors blog posts in the app; Supabase is the source of truth.
-- Publishing writes src/content/articles/<slug>.md to the blog repo
-- (YOUR_USERNAME/YOUR_BLOG) via the GitHub Contents API; a GitHub Action
-- rebuilds + deploys to Cloudflare Pages (example.com).
--
-- Mirrors the book_notes rich-content pattern: content_json (TipTap) +
-- content_md (derived markdown, the published body) + content_tsv (FTS).
-- Status is text+check (project convention — no enums). Extra published_*
-- columns track the live artifact so updates/deletes via the GitHub API
-- stay correct across slug renames.
-- =============================================================

create table if not exists articles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,

  title                text not null,
  slug                 text not null,
  summary              text,                       -- maps to frontmatter `description`

  content_json         jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_md           text  not null default '',
  content_tsv          tsvector generated always as (
                         to_tsvector('simple',
                           coalesce(title, '') || ' ' || coalesce(content_md, ''))
                       ) stored,

  status               text not null default 'draft'
                         check (status in ('draft', 'published', 'archived')),
  published_at         timestamptz,                -- set in Pedro's TZ at first publish

  -- Published-artifact tracking. published_slug can differ from `slug`
  -- after a rename-while-published; published_path is the repo path of the
  -- live file; published_commit_sha is the last commit sha (audit only).
  published_slug       text,
  published_path       text,
  published_commit_sha text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Guarantees the slug is a safe filename (no slashes, dots, spaces, unicode).
  constraint articles_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  unique (user_id, slug)
);

create index if not exists articles_user_status_idx
  on articles (user_id, status, published_at desc nulls last);
create index if not exists articles_user_updated_idx
  on articles (user_id, updated_at desc);
create index if not exists articles_content_tsv_idx
  on articles using gin (content_tsv);

create trigger articles_set_updated_at
  before update on articles
  for each row execute function set_updated_at();

alter table articles enable row level security;
create policy articles_all on articles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
