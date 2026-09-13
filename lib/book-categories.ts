import { createClient } from '@/lib/supabase/server';
import type { BookCategory, ChipColor } from '@/lib/supabase/types';

/** name → palette key, for rendering chips on server-fetched surfaces.
 *  Names with no vocabulary row are simply absent; CategoryChip falls back to
 *  the static map in lib/books-display.ts for those.
 *
 *  Insertion order is the user's vocabulary order (position, then name), so
 *  `Object.keys()` is a valid ordering for chip rows — string keys preserve
 *  insertion order in JS objects. */
export type CategoryColorMap = Record<string, ChipColor>;

export interface BookCategoryData {
  /** Full vocabulary rows, in the user's order. Drives the picker + manager. */
  categories: BookCategory[];
  /** name → how many books carry it. Powers the delete confirmation. */
  counts: Record<string, number>;
  /** name → palette key, for chip rendering on read-only surfaces. */
  colorMap: CategoryColorMap;
}

const EMPTY: BookCategoryData = { categories: [], counts: {}, colorMap: {} };

/** Server-side fetch of the category vocabulary. Pages call this and pass the
 *  result down — the project convention is Server Component fetches, Client
 *  Component interacts, so no dialog fetches this itself. */
export async function getBookCategoryData(): Promise<BookCategoryData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const [{ data: rows }, { data: books }] = await Promise.all([
    supabase
      .from('book_categories')
      .select('id, user_id, name, color, position, created_at, updated_at')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('books').select('categories').eq('user_id', user.id),
  ]);

  const categories = (rows ?? []) as BookCategory[];

  const colorMap: CategoryColorMap = {};
  for (const c of categories) colorMap[c.name] = c.color;

  // ~78 book rows today — counting here beats adding an unnest RPC.
  const counts: Record<string, number> = {};
  for (const b of (books ?? []) as { categories: string[] | null }[]) {
    for (const name of b.categories ?? []) {
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }

  return { categories, counts, colorMap };
}
