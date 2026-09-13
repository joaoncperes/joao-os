'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { extractHashtags } from '@/lib/hashtags';
import { nextDefaultColor } from '@/lib/second-brain/column-display';
import type {
  BookCategory,
  BookPriority,
  ChipColor,
  TipTapDoc,
} from '@/lib/supabase/types';

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const VALID_PRIORITIES: BookPriority[] = [
  'lendo', 'urgente', 'alta', 'media', 'baixa', 'lido',
];

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, userId: user.id };
}

export interface BookInput {
  title: string;
  author: string | null;
  priority: BookPriority;
  categories: string[];
  why: string | null;
  started_at: string | null;
  finished_at: string | null;
  rating: number | null;
}

function sanitize(input: BookInput): BookInput {
  return {
    title: input.title.trim(),
    author: input.author?.trim() || null,
    priority: VALID_PRIORITIES.includes(input.priority) ? input.priority : 'media',
    categories: Array.from(new Set((input.categories ?? []).map((c) => c.trim()).filter(Boolean))),
    why: input.why?.trim() || null,
    started_at: input.started_at || null,
    finished_at: input.finished_at || null,
    rating: input.rating != null && Number.isFinite(input.rating)
      ? Math.max(0, Math.min(10, Math.round(input.rating)))
      : null,
  };
}

export async function createBook(
  input: BookInput,
): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    const row = sanitize(input);
    if (!row.title) return { ok: false, error: 'Title is required.' };

    const { data, error } = await supabase
      .from('books')
      .insert({ user_id: userId, ...row })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'create failed' };

    // Eagerly create an empty book_notes row so the editor opens to a stable state.
    await supabase.from('book_notes').insert({
      user_id: userId,
      book_id: data.id,
    });

    revalidatePath('/books');
    revalidatePath('/today');
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateBook(
  bookId: string,
  input: BookInput,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const row = sanitize(input);
    if (!row.title) return { ok: false, error: 'Title is required.' };

    const { error } = await supabase
      .from('books')
      .update(row)
      .eq('id', bookId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/books');
    revalidatePath(`/books/${bookId}`);
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteBook(bookId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/books');
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveBookNotes(input: {
  bookId: string;
  // Wire format: JSON-stringified TipTapDoc. Sending text avoids React Flight
  // edge cases with ProseMirror's null-proto attrs objects (which were stripping
  // image src/alt during transport on the Cloudflare Worker).
  contentJsonString: string;
  contentMd: string;
}): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    let contentJson: TipTapDoc;
    try {
      contentJson = JSON.parse(input.contentJsonString) as TipTapDoc;
    } catch (e) {
      return { ok: false, error: `Invalid contentJson: ${(e as Error).message}` };
    }

    const { data: existing } = await supabase
      .from('book_notes')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', input.bookId)
      .maybeSingle();

    const tags = extractHashtags(input.contentMd);

    if (existing) {
      const { error } = await supabase
        .from('book_notes')
        .update({
          content_json: contentJson,
          content_md: input.contentMd,
          tags,
        })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('book_notes').insert({
        user_id: userId,
        book_id: input.bookId,
        content_json: contentJson,
        content_md: input.contentMd,
        tags,
      });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/books/${input.bookId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface SearchHit {
  book_id: string;
  title: string;
  snippet: string;
}

export async function searchBookNotes(query: string): Promise<Result<SearchHit[]>> {
  try {
    const q = query.trim();
    if (!q) return { ok: true, data: [] };
    const { supabase } = await ctx();

    // RPC reads auth.uid() server-side — no need to pass user_id from the client.
    const { data, error } = await supabase.rpc('search_book_notes', { q });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as SearchHit[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================
// Book categories — the user-owned vocabulary behind the picker.
// `books.categories` stores names, so rename/delete cascade through every
// book row; that happens inside the SQL RPCs (see migration 077).
// =============================================================

export async function createBookCategory(
  name: string,
  color?: ChipColor,
): Promise<Result<BookCategory>> {
  try {
    const { supabase, userId } = await ctx();
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Category name is required.' };

    // Case-insensitive duplicate check up front, so the user gets a readable
    // message instead of a raw unique-violation from the expression index.
    const { data: existing } = await supabase
      .from('book_categories')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', clean)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: `"${existing.name}" already exists.` };
    }

    const { count } = await supabase
      .from('book_categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const used = count ?? 0;

    const { data, error } = await supabase
      .from('book_categories')
      .insert({
        user_id: userId,
        name: clean,
        color: color ?? nextDefaultColor(used),
        position: used,
      })
      .select('id, user_id, name, color, position, created_at, updated_at')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'create failed' };

    revalidatePath('/books');
    return { ok: true, data: data as BookCategory };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Rename + cascade onto every book carrying the old name. Merges on collision. */
export async function renameBookCategory(
  id: string,
  newName: string,
): Promise<Result> {
  try {
    const { supabase } = await ctx();
    const clean = newName.trim();
    if (!clean) return { ok: false, error: 'Category name is required.' };

    const { error } = await supabase.rpc('rename_book_category', {
      p_id: id,
      p_new_name: clean,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/books');
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setBookCategoryColor(
  id: string,
  color: ChipColor,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('book_categories')
      .update({ color })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/books');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Delete + strip the tag from every book. Destructive; UI confirms first. */
export async function deleteBookCategory(id: string): Promise<Result> {
  try {
    const { supabase } = await ctx();
    const { error } = await supabase.rpc('delete_book_category', { p_id: id });
    if (error) return { ok: false, error: error.message };

    revalidatePath('/books');
    revalidatePath('/today');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
