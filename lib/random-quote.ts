import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuoteWithAuthor } from './supabase/types';

/** Pick from the whole visible library without transferring it to the Worker. */
export async function readRandomQuote(supabase: SupabaseClient): Promise<QuoteWithAuthor | null> {
  const { count, error } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true });
  if (error || !count) return null;

  const offset = Math.floor(Math.random() * count);
  const readAt = (index: number) => supabase
    .from('quotes')
    .select('id, author_id, text, source, created_at, author:authors(name, photo_url)')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(index, index)
    .maybeSingle();

  const result = await readAt(offset);
  if (result.error) return null;
  if (result.data) return result.data as unknown as QuoteWithAuthor;

  // A quote may have been deleted between the count and the read. One bounded
  // fallback keeps the card populated without a retry loop or a full-table read.
  if (offset === 0) return null;
  const fallback = await readAt(0);
  return fallback.error ? null : fallback.data as unknown as QuoteWithAuthor | null;
}
