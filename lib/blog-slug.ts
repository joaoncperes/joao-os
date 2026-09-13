// Article slug generation. Reuses the generic slugify from books-display
// (lowercase, strip diacritics, non-alnum → '-', trim, 60-char cap), then
// re-trims any hyphen the 60-char slice could leave dangling — so the output
// always satisfies the `articles_slug_format` CHECK (migration 064).
import { bookSlug } from '@/lib/books-display';

export function articleSlug(title: string): string {
  return bookSlug(title).replace(/^-+|-+$/g, '');
}
