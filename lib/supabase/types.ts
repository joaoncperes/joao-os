// Hand-written types for Sprint 0. Replace with `supabase gen types typescript`
// once the cloud project is provisioned.

export type Area =
  | 'professional'
  | 'health'
  | 'family'
  | 'marriage'
  | 'cross_cutting';

export type SubArea =
  | 'strategic'
  | 'product'
  | 'ai_native'
  | 'training'
  | 'recovery'
  | 'nutrition'
  | 'mma'
  | 'parents'
  | 'brother'
  | 'friends'
  | 'gabi'
  | 'self'
  | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  time_zone: string;
  week_start_day: number; // 0 = Sun, 1 = Mon
  time_format: number; // 12 | 24
  setup_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  area: Area;
  time_slot: string | null; // 'HH:MM:SS' or null
  is_counter: boolean;
  counter_target_value: number | null;
  counter_unit: string | null;
  reminder_lead_minutes: number;
  freeze_tokens_enabled: boolean;
  sort_order: number;
  archived: boolean;
  notes: string | null;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string; // 'YYYY-MM-DD'
  completed_at: string | null;
  value: number | null;
  notes: string | null;
  miss_reason: 'forgot' | 'skipped' | 'obstacle' | 'rescheduled' | null;
  freeze_used: boolean;
}

export interface TodayHabit {
  // Live view only; historical RPC responses omit this derived field.
  missed_yesterday?: boolean;
  habit_id: string;
  user_id: string;
  name: string;
  area: Area;
  time_slot: string | null;
  is_counter: boolean;
  counter_target_value: number | null;
  counter_unit: string | null;
  sort_order: number;
  completed_at: string | null;
  logged_value: number | null;
  miss_reason: HabitLog['miss_reason'];
  notes: string | null;
  freeze_used: boolean;
  today_in_tz: string;
  // Added in migration 041 (habits.if_missed_plan + anchor_habit_id + view widen).
  if_missed_plan: string | null;
  anchor_habit_id: string | null;
  anchor_habit_name: string | null;
}

export type TaskBucket = 'today' | 'tomorrow' | 'backlog';

export interface TodayTask {
  task_id: string;
  user_id: string;
  title: string;
  scheduled_date: string; // 'YYYY-MM-DD'
  scheduled_time: string | null; // 'HH:MM:SS'
  area: Area | null;
  notes: string | null;
  weekly_commitment_id: string | null;
  completed_at: string | null;
  created_at: string;
  today_in_tz: string;
  bucket: TaskBucket;
}

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  type: 'compound' | 'isolation' | 'cardio' | 'mma' | 'mobility';
  muscle_group_primary: string | null;
  muscle_group_secondary: string | null;
  notes: string | null;
  archived: boolean;
}

export interface WorkoutSplit {
  id: string;
  user_id: string;
  day_of_week: number; // 0–6, 0 = Sun
  split_name: string;
  is_rest: boolean;
  notes: string | null;
}

export interface WorkoutSplitExercise {
  id: string;
  user_id: string;
  workout_split_id: string;
  exercise_id: string;
  position: number;
  default_sets: number;
  default_reps_target: number | null;
}

// Cardio is logged standalone (any day) in cardio_sessions — decoupled from the
// weekday split. One row per logged cardio session; the Cardio tab lists these.
export interface CardioListRow {
  id: string;
  session_date: string; // 'YYYY-MM-DD'
  kcal: number | null;
}

// One Sunday-anchored week of cardio, aggregated in JS in insights/page.tsx
// (mirrors the weekly volume bucketing). Not a DB view.
export interface CardioWeeklyRow {
  weekStart: string; // Sunday 'YYYY-MM-DD'
  kcal: number; // Σ kcal that week
  sessions: number; // count that week
}

export interface WeeklyPlan {
  id: string;
  user_id: string;
  iso_year: number | null;
  iso_week: number | null;
  week_start_date: string;
  theme: string | null;
  weekly_question: string | null;
  free_notes: string | null;
  reflection: string | null;
  prep_checklist: string[];
}

export interface WeeklyPriority {
  id: string;
  user_id: string;
  weekly_plan_id: string;
  position: number;
  text: string;
}

// ---------------------------------------------------------------
// V2 redesign — added in migration 006.
// ---------------------------------------------------------------

export interface DailyState {
  user_id: string;
  state_date: string;     // 'YYYY-MM-DD' in user TZ
  intention: string | null;
  updated_at: string;
}

// One row per day of the user's current ISO week (Mon..Sun).
// Returned by v_user_week.
export interface UserWeekDay {
  user_id: string;
  day_index: number;      // 0=Mon..6=Sun
  log_date: string;
  is_today: boolean;
  is_future: boolean;
  habit_total: number;
  done_count: number;
  pct: number;            // 0..100
}

// One row per (habit, Sunday week start). Returned by v_weekly_habit_summary.
// Filter by week_start to get the picture for a given Sun..Sat week.
export interface WeeklyHabitSummary {
  user_id: string;
  habit_id: string;
  habit_name: string;
  area: Area;
  week_start: string;     // Sunday of the Sun..Sat week
  completed_count: number;
  total_logged: number;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  pr_type: 'max_weight' | 'max_reps_at_weight' | 'max_volume_session';
  weight_kg: number | null;
  reps: number | null;
  set_id: string | null;
  achieved_at: string;
  notes: string | null;
}

// One row per workout session. Returned by v_workout_session_volume (migration 060).
// total_volume = Σ weight_kg*reps over non-warmup, fully-logged sets.
export interface VolumeSessionRow {
  session_id: string;
  session_date: string;        // 'YYYY-MM-DD'
  day_of_week: number;         // 0=Sun .. 6=Sat
  split_name_snapshot: string;
  total_volume: number;        // numeric → may arrive as string; normalize with Number()
  total_sets: number;          // ::int → safe number
}

// Quote of the Day — added in migration 007.

export interface Author {
  id: string;
  name: string;
  photo_url: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  author_id: string;
  text: string;
  source: string | null;
  created_at: string;
}

export interface QuoteWithAuthor extends Quote {
  author: { name: string; photo_url: string | null };
}

// =============================================================
// Books — Notion "Livros" mirror, added in migration 049.
// =============================================================

export type BookPriority =
  | 'lendo'    // currently reading
  | 'urgente'  // must read next
  | 'alta'     // high priority queue
  | 'media'    // medium
  | 'baixa'    // low / someday
  | 'lido';    // finished

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  priority: BookPriority;
  categories: string[];
  why: string | null;
  started_at: string | null;   // 'YYYY-MM-DD' — shown for Lendo
  finished_at: string | null;  // 'YYYY-MM-DD' — Notion "Data da Leitura"
  finished_year?: number | null; // Historical reading with a known year but no exact date.
  finished_month?: number | null; // Optional month for historical readings without a day.
  finished_month_estimated?: boolean; // Month assigned from the user's approximate reading pace.
  rating: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  // Derived server-side by joining book_notes — true when a non-empty
  // notes page exists. Optional because some surfaces don't compute it.
  has_notes?: boolean;
}

// A category in the user's book vocabulary. `books.categories` stores NAMES
// (not ids), so renames/deletes cascade through that array server-side — see
// supabase/migrations/077_book_categories.sql for why.
export interface BookCategory {
  id: string;
  user_id: string;
  name: string;
  color: ChipColor;
  position: number;
  created_at: string;
  updated_at: string;
}

// TipTap document — kept loose so we don't fight the editor's shape.
export type TipTapDoc = {
  type: 'doc';
  content?: TipTapNode[];
};
export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

export interface BookNote {
  id: string;
  user_id: string;
  book_id: string;
  content_json: TipTapDoc;
  content_md: string;
  // Inline #hashtags extracted from content_md on save (migration 061).
  tags: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================
// Meditation logs — added in migration 059. One quantitative entry per
// date (total minutes meditated). Decoupled from the habits system: the
// existing "Meditation" habit on Today stays a binary checkbox.
// =============================================================

export interface MeditationLog {
  id: string;
  user_id: string;
  log_date: string;       // 'YYYY-MM-DD'
  day_of_week: number;    // 0..6 (Sun..Sat)
  minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================
// Custom daily reminders — added in migration 055.
// =============================================================

export interface CustomReminder {
  id: string;
  user_id: string;
  text: string;
  scheduled_time: string; // 'HH:MM:SS' in user's TZ
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================
// Second Brain — PARA-Identity, added in migration 054.
// =============================================================

// Top-level lens: Pedro's 3 identity areas. Independent from the
// granular `Area` above (which stays compatible with identity/decisions).
export type LifeArea = 'professional' | 'health' | 'personal';

// Same vocabulary as `Area`, plus 'friends' (only valid for Second Brain rows).
export type NoteArea = Area | 'friends';

export type NoteSource = 'manual' | 'voice' | 'quick_capture' | 'import';

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

export interface Note {
  id: string;
  user_id: string;
  // Legacy. Kept for backward compat until migration 060 drops it; new code reads folder_id.
  life_area: LifeArea | null;
  area: NoteArea | null;
  // Null = Inbox. Set by migration 058 from life_area for existing notes.
  folder_id: string | null;
  title: string | null;
  content_json: TipTapDoc;
  content_md: string;
  // Inline #hashtags extracted from content_md on save (migration 061).
  tags: string[];
  // Per-note typed-column cell values, keyed by FolderColumn.id (migration 068).
  properties: NoteProperties;
  source: NoteSource;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  life_area: LifeArea;
  area: NoteArea | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  due_date: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Resource {
  id: string;
  user_id: string;
  life_area: LifeArea;
  area: NoteArea | null;
  title: string;
  description: string | null;
  is_guiding_question: boolean;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================
// PARA folders — added in migration 056. Replaces the life_area-based
// organization with Tiago Forte's Projects/Areas/Resources/Archive model.
// =============================================================

export type ParaCategory = 'projects' | 'areas' | 'resources' | 'archive';

export type ParaProjectStatus = 'active' | 'on_hold' | 'completed';

export type FolderKind = 'standard' | 'books';

export interface Folder {
  id: string;
  user_id: string;
  para_category: ParaCategory;
  parent_folder_id: string | null;
  title: string;
  description: string | null;
  // Project-only metadata. Null for non-project folders.
  status: ParaProjectStatus | null;
  due_date: string | null;
  completed_at: string | null;
  // Areas folders only — used for color mapping in lib/area-color.ts.
  life_area: LifeArea | null;
  kind: FolderKind;
  // Grid/Table view preference for the folder-as-database view (migration 068).
  default_view: FolderDefaultView;
  // Persisted table view — sort/filters/widths/hidden (migration 072). '{}' when
  // unset; normalized on read via normalizeViewConfig (lib/second-brain/table-view).
  table_view: Record<string, unknown>;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================
// Folder-as-database — typed columns on a PARA folder (migration 068).
// A folder = a database; each note in it = a row; note.title = the implicit
// "Name" column. folder_columns holds the schema; notes.properties holds the
// per-note cell values keyed by FolderColumn.id.
// =============================================================

export type ColumnType = 'text' | 'multi_select' | 'date' | 'url' | 'checkbox';

// Palette key — maps to a Tailwind chip class in lib/second-brain/column-display.ts.
export type ChipColor =
  | 'gray' | 'red' | 'orange' | 'amber' | 'yellow'
  | 'emerald' | 'sky' | 'violet' | 'fuchsia' | 'rose';

export interface MultiSelectOption {
  id: string; // stable; rows reference this id, not the name
  name: string;
  color: ChipColor;
}

export interface FolderColumn {
  id: string;
  user_id: string;
  folder_id: string;
  name: string;
  type: ColumnType;
  // Populated only when type === 'multi_select'; [] otherwise.
  options: MultiSelectOption[];
  position: number;
  created_at: string;
  updated_at: string;
}

// One note's cell values, keyed by FolderColumn.id. A missing key = empty cell.
//   text | url     → string
//   date           → 'YYYY-MM-DD'
//   multi_select   → string[] (MultiSelectOption.id[])
export type PropertyValue = string | string[];
export type NoteProperties = Record<string, PropertyValue>;

export type FolderDefaultView = 'grid' | 'table';

// =============================================================
// Unified Second Brain search — returned by the search_brain() RPC
// (migration 061). One row per hit across notes + book_notes.
// =============================================================

export interface BrainSearchHit {
  kind: 'note' | 'book';
  id: string; // note id, or book id for the 'book' kind
  title: string;
  snippet: string; // may contain <mark> highlight tags
  tags: string[];
  folder_id: string | null;
  folder_title: string | null;
  // 'inbox' for an unclassified note, a PARA category for a foldered note,
  // null for a book note.
  para_category: ParaCategory | 'inbox' | null;
  archived: boolean;
  updated_at: string;
  rank: number;
}

// =============================================================
// Blog articles — added in migration 064. Supabase is the source of truth;
// publishing commits markdown to the pedro-blog GitHub repo, which deploys
// to example.com. content_json (TipTap) + content_md (published body).
// =============================================================

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface Article {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  summary: string | null; // → blog frontmatter `description`
  content_json: TipTapDoc;
  content_md: string;
  status: ArticleStatus;
  published_at: string | null; // set at first publish, preserved across unpublish
  // Live-artifact tracking — drive safe update/delete via the GitHub API.
  published_slug: string | null; // slug the live file is named with
  published_path: string | null; // repo path of the live file
  published_commit_sha: string | null; // last publish commit (audit only)
  created_at: string;
  updated_at: string;
}

// List-view projection — omits the heavy content columns. The /blog list
// query selects exactly these fields (never content_json/content_md).
export type ArticleListItem = Omit<Article, 'content_json' | 'content_md'>;
