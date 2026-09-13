/**
 * Inline hashtag extraction from a markdown string.
 *
 * A hashtag is `#` immediately followed by a Unicode letter, then any run of
 * letters / digits / `_` / `-`, with optional nested `/` segments
 * (`#area/sub`). Nested tags are kept whole (one tag): the user thinks of the
 * hierarchy as one chip, and the filter RPC uses exact containment, so
 * `#area` and `#area/sub` are intentionally distinct tags.
 *
 * Excluded by construction or pre-stripping:
 *  - ATX headings (`# H`, `## H`): a heading always has whitespace after the
 *    `#`(s); a hashtag requires a *letter* right after `#`, so headings never
 *    match. No special-casing needed.
 *  - Fenced code blocks (``` and ~~~), inline code (`...`): stripped first.
 *  - URLs / `#anchor`: URLs are stripped first, so `https://x/y#anchor` yields
 *    nothing. A `#` attached to a preceding word char (`id#x`) also fails the
 *    boundary rule.
 *  - Pure numeric (`#123`) and digit-leading (`#4you`): the first char after
 *    `#` must be a letter (\p{L}), so both are rejected.
 *
 * Output: lowercased, de-duplicated, first-seen order. Capped at 50 tags and
 * 64 chars each to bound pathological input. Pure, no deps.
 */

const MAX_TAGS = 50;
const MAX_TAG_LEN = 64;

// boundary, then #, letter-start, then letters/digits/_/-, optional /sub parts.
// u flag + \p{L}/\p{N} for PT accents (#ideia, #produção).
const HASHTAG_RE =
  /(^|[^\p{L}\p{N}_/#])#(\p{L}[\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_][\p{L}\p{N}_-]*)*)/gu;

/** Remove fenced code blocks, inline code, and URLs so their `#` never matches. */
function stripNonTagRegions(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ');
}

export function extractHashtags(md: string): string[] {
  if (!md) return [];

  const cleaned = stripNonTagRegions(md);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const m of cleaned.matchAll(HASHTAG_RE)) {
    let tag = m[2].toLowerCase().replace(/[-/]+$/u, '');
    if (tag.length > MAX_TAG_LEN) tag = tag.slice(0, MAX_TAG_LEN).replace(/[-/]+$/u, '');
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }

  return out;
}
