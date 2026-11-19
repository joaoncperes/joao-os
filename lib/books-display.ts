import type { Book, BookPriority } from '@/lib/supabase/types';

export const PRIORITY_ORDER: BookPriority[] = [
  'lendo',
  'urgente',
  'alta',
  'media',
  'baixa',
  'lido',
];

// Display labels only. The stored values stay Portuguese ('lendo', 'lido', …)
// — they're the check-constrained column values mirrored from Notion, and the
// import mapping in lib/notion-to-tiptap.ts still keys off them.
export const PRIORITY_LABEL: Record<BookPriority, string> = {
  lendo: 'Lendo',
  urgente: 'Urgente',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  lido: 'Lido',
};

// Tailwind utility strings chosen to mirror the Notion chip colors Pedro is
// used to. Light-theme-friendly: soft tint + darker text + subtle ring.
export const PRIORITY_CHIP: Record<BookPriority, string> = {
  lendo:   'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  urgente: 'bg-red-100 text-red-900 ring-1 ring-red-200',
  alta:    'bg-orange-100 text-orange-900 ring-1 ring-orange-200',
  media:   'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200',
  baixa:   'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
  lido:    'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
};

// FALLBACK ONLY. The category vocabulary now lives in the `book_categories`
// table (migration 077) and carries its own color, resolved via chipClass() in
// lib/second-brain/column-display.ts. This map survives for names that have no
// vocabulary row — legacy tags, or a category deleted in another tab — so a
// book never renders an unstyled chip. New categories never reach it.
//
// Keyed by the English names migration 078 renamed the built-ins to; the
// Portuguese originals are kept as aliases so a book row that somehow escaped
// the cascade still renders in its old color instead of falling through.
export function categoryChipClass(category: string): string {
  switch (category) {
    case 'Habits':
    case 'Hábitos':
      return 'bg-fuchsia-100 text-fuchsia-800 ring-1 ring-fuchsia-200';
    case 'Mindset':
    case 'Mentalidade':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
    case 'Philosophy':
    case 'Filosofia':
      return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200';
    case 'Management':
    case 'Gestão':
      return 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200';
    case 'Business':
    case 'Negócios':
      return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200';
    case 'Communication':
    case 'Comunicação':
      return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200';
    case 'Creativity':
    case 'Criatividade':
      return 'bg-sky-100 text-sky-800 ring-1 ring-sky-200';
    default:
      return 'bg-surface-2 text-text-2 ring-1 ring-border';
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "12 February 2026". Parsed by hand rather than via Date so a 'YYYY-MM-DD'
// string is never shifted a day by the runtime's time zone.
export function formatReadingDate(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatBookFinishedDate(book: Pick<Book, 'finished_at' | 'finished_year' | 'finished_month' | 'finished_month_estimated'>): string {
  if (book.finished_at) return formatReadingDate(book.finished_at);
  if (!book.finished_year) return '';
  if (!book.finished_month) return String(book.finished_year);
  return `${MONTHS[book.finished_month - 1]} ${book.finished_year}`;
}

// Slug helper — used for markdown export filenames.
export function bookSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}
