import { AlignLeft, Calendar, CheckSquare, Link2, Tags, type LucideIcon } from 'lucide-react';
import type { ChipColor, ColumnType } from '@/lib/supabase/types';

// Notion-style light chips — mirror lib/books-display.ts (soft tint + darker
// text + subtle ring). The stored value on an option is the palette KEY; this
// maps key → Tailwind class so the DB stays decoupled from styling.
export const CHIP_COLORS: ChipColor[] = [
  'gray', 'red', 'orange', 'amber', 'yellow',
  'emerald', 'sky', 'violet', 'fuchsia', 'rose',
];

const CHIP_CLASS: Record<ChipColor, string> = {
  gray: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
  red: 'bg-red-100 text-red-900 ring-1 ring-red-200',
  orange: 'bg-orange-100 text-orange-900 ring-1 ring-orange-200',
  amber: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  yellow: 'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200',
  emerald: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  sky: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  violet: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200',
  rose: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
};

// Solid swatch (for the color picker) — the chip bg at full saturation.
const SWATCH_CLASS: Record<ChipColor, string> = {
  gray: 'bg-zinc-400',
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  amber: 'bg-amber-400',
  yellow: 'bg-yellow-400',
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  violet: 'bg-violet-400',
  fuchsia: 'bg-fuchsia-400',
  rose: 'bg-rose-400',
};

export function chipClass(color: string): string {
  return CHIP_CLASS[color as ChipColor] ?? CHIP_CLASS.gray;
}

export function swatchClass(color: string): string {
  return SWATCH_CLASS[color as ChipColor] ?? SWATCH_CLASS.gray;
}

// Round-robin a default color when a new multi_select option is created.
export function nextDefaultColor(usedCount: number): ChipColor {
  return CHIP_COLORS[usedCount % CHIP_COLORS.length];
}

// Lucide icon + label per column type (for headers + the add-column picker).
export const COLUMN_TYPE_META: Record<
  ColumnType,
  { icon: LucideIcon; label: string }
> = {
  text: { icon: AlignLeft, label: 'Text' },
  multi_select: { icon: Tags, label: 'Multi-select' },
  date: { icon: Calendar, label: 'Date' },
  url: { icon: Link2, label: 'URL' },
  checkbox: { icon: CheckSquare, label: 'Checkbox' },
};

export const COLUMN_TYPE_ORDER: ColumnType[] = ['text', 'multi_select', 'date', 'url', 'checkbox'];
