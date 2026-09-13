import type { Area } from './supabase/types';

// =====================================================================
// Pedro's defaults from Pedro-OS-App-Scope.md §3.2 (habits) and §4.2 (split).
// Surfaced to the wizard pre-filled. Every value is editable before saving.
// =====================================================================

export interface DefaultHabit {
  name: string;
  area: Area;
  time_slot: string | null; // 'HH:MM' or null
  is_counter: boolean;
  counter_target_value?: number;
  counter_unit?: string;
  reminder_lead_minutes: number;
  sort_order: number;
}

export const DEFAULT_HABITS: DefaultHabit[] = [
  { name: 'Wake up before 6am',     area: 'health',        time_slot: '05:45', is_counter: false, reminder_lead_minutes: 0,  sort_order: 10 },
  { name: 'Meditation',             area: 'health',        time_slot: '05:50', is_counter: false, reminder_lead_minutes: 1,  sort_order: 20 },
  { name: 'Studies / Reading (2h)', area: 'professional',  time_slot: '06:00', is_counter: false, reminder_lead_minutes: 0,  sort_order: 30 },
  { name: 'Breakfast',              area: 'health',        time_slot: '07:45', is_counter: false, reminder_lead_minutes: 0,  sort_order: 40 },
  { name: 'Next-day planning',      area: 'professional',  time_slot: '18:30', is_counter: false, reminder_lead_minutes: 5,  sort_order: 60 },
  { name: 'Train',                  area: 'health',        time_slot: '19:00', is_counter: false, reminder_lead_minutes: 10, sort_order: 70 },
  { name: 'Journaling',             area: 'cross_cutting', time_slot: '21:15', is_counter: false, reminder_lead_minutes: 0,  sort_order: 100 },
  { name: 'Call partner',              area: 'marriage',      time_slot: '22:00', is_counter: false, reminder_lead_minutes: 5,  sort_order: 110 },
  { name: 'Sleep before 22:30',     area: 'health',        time_slot: '22:30', is_counter: false, reminder_lead_minutes: 30, sort_order: 120 },
  { name: 'Drink +3L water',        area: 'health',        time_slot: null,    is_counter: true,  counter_target_value: 3000, counter_unit: 'ml', reminder_lead_minutes: 0, sort_order: 130 },
];

export type ExerciseType = 'compound' | 'isolation' | 'cardio' | 'mma' | 'mobility';

export interface DefaultExercise {
  name: string;
  type: ExerciseType;
  muscle_group_primary: string;
}

export const DEFAULT_EXERCISES: DefaultExercise[] = [
  { name: 'Incline Bench Press',     type: 'compound',  muscle_group_primary: 'chest' },
  { name: 'Pec Fly',                 type: 'isolation', muscle_group_primary: 'chest' },
  { name: 'Flat Bench Press',        type: 'compound',  muscle_group_primary: 'chest' },
  { name: 'Triceps Pushdown',        type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Skull Crusher',           type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Triceps Machine',         type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Lateral Raise',           type: 'isolation', muscle_group_primary: 'shoulders' },
  { name: 'Graviton',                type: 'compound',  muscle_group_primary: 'back' },
  { name: 'Chest Supported Row',     type: 'compound',  muscle_group_primary: 'back' },
  { name: 'Cable Curl',              type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Hammer Curl (ascending)', type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Rear Delt',               type: 'isolation', muscle_group_primary: 'shoulders' },
  { name: 'Leg Extension',           type: 'isolation', muscle_group_primary: 'legs' },
  { name: 'Lying Leg Curl',          type: 'isolation', muscle_group_primary: 'legs' },
  { name: 'Upper Abs',               type: 'isolation', muscle_group_primary: 'abs' },
  { name: 'Lower Abs',               type: 'isolation', muscle_group_primary: 'abs' },
  { name: 'Parallel Bar Dips',       type: 'compound',  muscle_group_primary: 'chest' },
  { name: 'Wide-Grip Low Row',       type: 'compound',  muscle_group_primary: 'back' },
  { name: 'Straight Bar Pushdown',   type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Scott Curl',              type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'Shoulder Press',          type: 'compound',  muscle_group_primary: 'shoulders' },
  { name: 'Overhead Cable Triceps',  type: 'isolation', muscle_group_primary: 'arms' },
  { name: 'MMA session',             type: 'mma',       muscle_group_primary: 'full_body' },
];

export interface DefaultSplitDay {
  day_of_week: number; // 0 = Sun, 6 = Sat
  split_name: string;
  is_rest: boolean;
  exercises: { name: string; default_sets: number; default_reps_target: number | null }[];
}

export const DEFAULT_SPLIT: DefaultSplitDay[] = [
  {
    day_of_week: 0, split_name: 'Chest + Triceps + Shoulder', is_rest: false,
    exercises: [
      { name: 'Incline Bench Press', default_sets: 3, default_reps_target: 8 },
      { name: 'Pec Fly',             default_sets: 3, default_reps_target: 8 },
      { name: 'Flat Bench Press',    default_sets: 3, default_reps_target: 8 },
      { name: 'Skull Crusher',       default_sets: 3, default_reps_target: 8 },
      { name: 'Triceps Pushdown',    default_sets: 3, default_reps_target: 8 },
      { name: 'Lateral Raise',       default_sets: 3, default_reps_target: 8 },
    ],
  },
  {
    day_of_week: 1, split_name: 'Back + Biceps + Rear Shoulder', is_rest: false,
    exercises: [
      { name: 'Graviton',                default_sets: 3, default_reps_target: 8 },
      { name: 'Chest Supported Row',     default_sets: 3, default_reps_target: 8 },
      { name: 'Cable Curl',              default_sets: 3, default_reps_target: 8 },
      { name: 'Hammer Curl (ascending)', default_sets: 3, default_reps_target: 8 },
      { name: 'Rear Delt',               default_sets: 2, default_reps_target: 8 },
    ],
  },
  {
    // Cardio is logged standalone in the Cardio tab (any day) — not a weekday
    // split. Left open so strength can be assigned here later.
    day_of_week: 2, split_name: 'Unassigned', is_rest: false,
    exercises: [],
  },
  {
    day_of_week: 3, split_name: 'Legs + Abs', is_rest: false,
    exercises: [
      { name: 'Leg Extension',  default_sets: 4, default_reps_target: 10 },
      { name: 'Lying Leg Curl', default_sets: 4, default_reps_target: 10 },
      { name: 'Upper Abs',      default_sets: 3, default_reps_target: 10 },
      { name: 'Lower Abs',      default_sets: 3, default_reps_target: 10 },
    ],
  },
  {
    // Cardio is logged standalone in the Cardio tab (any day) — not a weekday
    // split. Left open so strength can be assigned here later.
    day_of_week: 4, split_name: 'Unassigned', is_rest: false,
    exercises: [],
  },
  {
    day_of_week: 5, split_name: 'Push + Back + Shoulder', is_rest: false,
    exercises: [
      { name: 'Parallel Bar Dips',     default_sets: 3, default_reps_target: 8 },
      { name: 'Wide-Grip Low Row',     default_sets: 3, default_reps_target: 8 },
      { name: 'Shoulder Press',        default_sets: 3, default_reps_target: 8 },
      { name: 'Scott Curl',            default_sets: 3, default_reps_target: 8 },
      { name: 'Overhead Cable Triceps', default_sets: 3, default_reps_target: 8 },
    ],
  },
  {
    day_of_week: 6, split_name: 'Legs + Abs', is_rest: false,
    exercises: [
      { name: 'Leg Extension',  default_sets: 4, default_reps_target: 10 },
      { name: 'Lying Leg Curl', default_sets: 4, default_reps_target: 10 },
      { name: 'Upper Abs',      default_sets: 3, default_reps_target: 10 },
      { name: 'Lower Abs',      default_sets: 3, default_reps_target: 10 },
    ],
  },
];

export const DAY_OF_WEEK_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
