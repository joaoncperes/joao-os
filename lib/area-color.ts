import type { Area } from './supabase/types';

// Maps the 4 life-areas (+ cross) to the Webflow secondary palette
// (DESIGN.md §2). Tokens live as CSS vars on :root in globals.css.
export const AREA_COLOR: Record<Area, { dot: string; bg: string; text: string; label: string }> = {
  professional: {
    dot: 'bg-[var(--area-professional)]',
    bg: 'bg-[var(--area-professional)]/10',
    text: 'text-[var(--area-professional)]',
    label: 'Pro',
  },
  health: {
    dot: 'bg-[var(--area-health)]',
    bg: 'bg-[var(--area-health)]/10',
    text: 'text-[var(--area-health)]',
    label: 'Health',
  },
  family: {
    dot: 'bg-[var(--area-family)]',
    bg: 'bg-[var(--area-family)]/10',
    text: 'text-[var(--area-family)]',
    label: 'Family',
  },
  marriage: {
    dot: 'bg-[var(--area-marriage)]',
    bg: 'bg-[var(--area-marriage)]/10',
    text: 'text-[var(--area-marriage)]',
    label: 'Marriage',
  },
  cross_cutting: {
    dot: 'bg-[var(--area-cross)]',
    bg: 'bg-[var(--area-cross)]/10',
    text: 'text-[var(--area-cross)]',
    label: 'Cross',
  },
};
