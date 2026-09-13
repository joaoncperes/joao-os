/**
 * One-shot backfill: restore image src/alt/width onto book_notes.content_json
 * for image nodes that were stripped down to `{type: "image"}` by the schema
 * bug fixed in lib/tiptap-resizable-image.ts.
 *
 * Strategy: walk content_md for `<img src="..." alt="..." width="X%" />` and
 * `![alt](url)` references whose URL contains `book-images`, then graft each
 * onto the Nth image node in content_json by ordinal position. Images whose
 * MD ref is empty `![]()` cannot be recovered.
 *
 * Run from pedro-os/:
 *   pnpm exec tsx scripts/restore-book-image-attrs.ts          # dry run
 *   pnpm exec tsx scripts/restore-book-image-attrs.ts --apply  # write changes
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import type { TipTapDoc, TipTapNode } from '../lib/supabase/types';

loadDotenv({ path: '.env.local' });
loadDotenv({ path: '.env' });

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

interface MdImageRef {
  src: string;
  alt: string;
  width: number | null;
}

// Walk content_md and pull out image refs in document order. We match both
// the inline HTML form (resized images) and the standard markdown form.
// Refs without a usable URL are returned as null placeholders so we keep
// ordinal alignment with the JSON image nodes.
function extractMdImageRefs(md: string): (MdImageRef | null)[] {
  const refs: (MdImageRef | null)[] = [];
  const pattern = /<img\s+([^>]*?)\/?>|!\[([^\]]*)\]\(([^)]*)\)/g;
  for (const match of md.matchAll(pattern)) {
    if (match[0].startsWith('<img')) {
      const attrs = match[1];
      const src = (/src="([^"]*)"/.exec(attrs)?.[1] ?? '').trim();
      const alt = (/alt="([^"]*)"/.exec(attrs)?.[1] ?? '').replace(/&quot;/g, '"');
      const widthStr = /width="(\d+(?:\.\d+)?)%"/.exec(attrs)?.[1];
      const width = widthStr ? parseFloat(widthStr) : null;
      refs.push(src ? { src, alt, width } : null);
    } else {
      const alt = match[2] ?? '';
      const src = (match[3] ?? '').trim();
      refs.push(src ? { src, alt, width: null } : null);
    }
  }
  return refs;
}

// Walk the doc tree and return refs to image nodes in document order so we
// can mutate them in place.
function findImageNodes(doc: TipTapDoc): TipTapNode[] {
  const found: TipTapNode[] = [];
  const visit = (node: TipTapNode): void => {
    if (node.type === 'image') found.push(node);
    if (node.content) for (const child of node.content) visit(child);
  };
  visit(doc as unknown as TipTapNode);
  return found;
}

async function main() {
  console.log(APPLY ? 'MODE: --apply (will write)' : 'MODE: dry run (read only)');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('book_notes')
    .select('id, book_id, content_json, content_md');
  if (error) throw new Error(error.message);
  if (!rows) throw new Error('no rows');

  let touchedRows = 0;
  let restoredNodes = 0;
  let unrecoverableNodes = 0;

  for (const row of rows) {
    const doc = row.content_json as TipTapDoc;
    const md = row.content_md as string;
    const imageNodes = findImageNodes(doc);
    if (imageNodes.length === 0) continue;
    const mdRefs = extractMdImageRefs(md);

    let mutated = false;
    for (let i = 0; i < imageNodes.length; i++) {
      const node = imageNodes[i];
      const hasSrc =
        typeof node.attrs?.src === 'string' && (node.attrs.src as string).length > 0;
      if (hasSrc) continue;
      const ref = mdRefs[i];
      if (!ref) {
        unrecoverableNodes++;
        continue;
      }
      node.attrs = {
        ...(node.attrs ?? {}),
        src: ref.src,
        alt: ref.alt || (node.attrs?.alt ?? null),
        width: ref.width ?? (node.attrs?.width ?? null),
      };
      restoredNodes++;
      mutated = true;
    }

    if (!mutated) continue;
    touchedRows++;
    console.log(
      `  book ${row.book_id}: restored ${
        imageNodes.filter((n) => typeof n.attrs?.src === 'string').length
      }/${imageNodes.length} images`,
    );

    if (APPLY) {
      const { error: upErr } = await supabase
        .from('book_notes')
        .update({ content_json: doc })
        .eq('id', row.id);
      if (upErr) {
        console.error(`    ! update failed: ${upErr.message}`);
      }
    }
  }

  console.log('');
  console.log(`rows touched:        ${touchedRows}`);
  console.log(`nodes restored:      ${restoredNodes}`);
  console.log(`nodes unrecoverable: ${unrecoverableNodes}`);
  if (!APPLY) console.log('(dry run — re-run with --apply to write)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
