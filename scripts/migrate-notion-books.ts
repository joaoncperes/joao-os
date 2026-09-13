/**
 * One-shot migration: Notion "Livros" database → pedro-os.
 *
 * Setup (one time):
 *   1. Create an internal Notion integration:
 *      https://www.notion.so/profile/integrations  →  + New integration
 *      Name: "Pedro OS Migration".  Capability: Read content.
 *      Copy the Internal Integration Secret.
 *
 *   2. Open the Livros database in Notion. Click the three-dot menu (top right)
 *      → Connections → add the integration you just created.
 *
 *   3. Copy the Livros database id from its URL (the 32-char hex segment).
 *
 *   4. In Supabase: Settings → API → copy the service_role key.
 *
 *   5. Set env vars in pedro-os/.env.local (or export them in your shell):
 *
 *        NOTION_API_KEY=secret_xxx
 *        NOTION_LIVROS_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *        # NEXT_PUBLIC_SUPABASE_URL is already set
 *
 *   6. Run from pedro-os/:
 *        pnpm tsx scripts/migrate-notion-books.ts            # dry run
 *        pnpm tsx scripts/migrate-notion-books.ts --apply    # write to Supabase
 *
 * The script is idempotent — it upserts by (user_id, title), so re-running
 * updates existing books with the freshest Notion content.
 */

import { Client as NotionClient } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import {
  notionBlocksToTipTap,
  notionPriorityToBookPriority,
  richTextPlain,
  type NotionBlock,
  type ImageUploader,
} from '../lib/notion-to-tiptap';
import { tipTapToMarkdown } from '../lib/tiptap-markdown';

// --- env -----------------------------------------------------------------

loadDotenv({ path: '.env.local' });
loadDotenv({ path: '.env' });

const APPLY = process.argv.includes('--apply');
const USER_EMAIL = process.env.PEDRO_USER_EMAIL ?? 'you@example.com';
const NOTION_API_KEY = required('NOTION_API_KEY');
const NOTION_LIVROS_DB_ID = required('NOTION_LIVROS_DB_ID');
const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// --- clients -------------------------------------------------------------

const notion = new NotionClient({ auth: NOTION_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- main ----------------------------------------------------------------

async function main() {
  console.log(`Notion → Books migration (${APPLY ? 'APPLY' : 'DRY RUN'})`);

  const userId = await resolveUserId(USER_EMAIL);
  console.log(`User: ${USER_EMAIL} (${userId})`);

  const pages = await fetchAllPages();
  console.log(`Found ${pages.length} pages in Notion.`);

  let migrated = 0;
  let withNotes = 0;
  let imagesUploaded = 0;
  let blocksSkipped = 0;

  for (const page of pages) {
    const meta = extractMeta(page);
    if (!meta.title) continue;

    console.log(`\n• ${meta.title}`);
    console.log(`  priority=${meta.priority} categories=[${meta.categories.join(', ')}] finished=${meta.finished_at ?? '—'}`);

    const blocks = await fetchBlocksRecursive(page.id);
    const hasNotes = blocks.length > 0;
    if (hasNotes) console.log(`  ${blocks.length} top-level blocks`);

    if (!APPLY) {
      blocksSkipped += countSkippableBlocks(blocks);
      if (hasNotes) withNotes++;
      migrated++;
      continue;
    }

    // Upsert the book row first so we have a stable book_id for image paths.
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .eq('user_id', userId)
      .eq('title', meta.title)
      .maybeSingle();

    let bookId: string;
    if (existing) {
      bookId = existing.id;
      const { error } = await supabase
        .from('books')
        .update({
          author: meta.author,
          priority: meta.priority,
          categories: meta.categories,
          why: meta.why,
          finished_at: meta.finished_at,
          started_at: meta.started_at,
        })
        .eq('id', bookId);
      if (error) {
        console.error(`  ! update failed: ${error.message}`);
        continue;
      }
    } else {
      const { data, error } = await supabase
        .from('books')
        .insert({
          user_id: userId,
          title: meta.title,
          author: meta.author,
          priority: meta.priority,
          categories: meta.categories,
          why: meta.why,
          finished_at: meta.finished_at,
          started_at: meta.started_at,
        })
        .select('id')
        .single();
      if (error || !data) {
        console.error(`  ! insert failed: ${error?.message ?? 'no data'}`);
        continue;
      }
      bookId = data.id;
    }

    let uploadedCount = 0;
    const uploader: ImageUploader = async (url, caption) => {
      try {
        const { src } = await uploadImage(url, userId, bookId);
        uploadedCount++;
        return { src, alt: caption };
      } catch (e) {
        console.error(`  ! image upload failed: ${(e as Error).message}`);
        return { src: url, alt: caption };
      }
    };

    const doc = await notionBlocksToTipTap(blocks, uploader);
    const md = tipTapToMarkdown(doc);

    const { data: existingNote } = await supabase
      .from('book_notes')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle();

    if (existingNote) {
      const { error } = await supabase
        .from('book_notes')
        .update({ content_json: doc, content_md: md })
        .eq('id', existingNote.id);
      if (error) {
        console.error(`  ! notes update failed: ${error.message}`);
        continue;
      }
    } else {
      const { error } = await supabase.from('book_notes').insert({
        user_id: userId,
        book_id: bookId,
        content_json: doc,
        content_md: md,
      });
      if (error) {
        console.error(`  ! notes insert failed: ${error.message}`);
        continue;
      }
    }

    imagesUploaded += uploadedCount;
    if (hasNotes) withNotes++;
    migrated++;
    if (uploadedCount > 0) console.log(`  ↑ uploaded ${uploadedCount} image(s)`);
  }

  console.log('\nSummary');
  console.log(`  books processed:    ${migrated}`);
  console.log(`  books with notes:   ${withNotes}`);
  console.log(`  images uploaded:    ${imagesUploaded}`);
  if (!APPLY) {
    console.log(`  blocks unsupported: ${blocksSkipped}`);
    console.log('\n(dry run — pass --apply to write to Supabase.)');
  }
}

// --- helpers -------------------------------------------------------------

async function resolveUserId(email: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Could not find user for ${email}: ${error?.message ?? 'no row'}`);
  }
  return data.id as string;
}

async function resolveDataSourceId(databaseId: string): Promise<string> {
  // Notion API v2025 split databases into multiple data sources. For a simple
  // single-view database, take the first data source — that's the legacy view.
  const db = (await notion.databases.retrieve({ database_id: databaseId })) as unknown as {
    data_sources?: Array<{ id: string }>;
  };
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) {
    throw new Error(`Database ${databaseId} has no data sources visible to this integration.`);
  }
  return dsId;
}

async function fetchAllPages(): Promise<NotionPage[]> {
  const dataSourceId = await resolveDataSourceId(NOTION_LIVROS_DB_ID);
  const pages: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const res = (await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    })) as unknown as {
      results: NotionPage[];
      has_more: boolean;
      next_cursor: string | null;
    };
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return pages;
}

async function fetchBlocksRecursive(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = (await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    })) as unknown as {
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    };
    for (const b of res.results) {
      if (b.has_children) {
        b.children = await fetchBlocksRecursive(b.id);
      }
      blocks.push(b);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return blocks;
}

// Minimal Notion page shape — we only read the props we care about.
type NotionPage = {
  id: string;
  url: string;
  properties: Record<string, NotionPageProperty>;
};

type NotionPageProperty =
  | { type: 'title'; title: Array<{ plain_text: string; text?: { content: string } }> }
  | {
      type: 'rich_text';
      rich_text: Array<{ plain_text: string; text?: { content: string } }>;
    }
  | { type: 'select'; select: { name: string } | null }
  | { type: 'status'; status: { name: string } | null }
  | { type: 'multi_select'; multi_select: Array<{ name: string }> }
  | { type: 'date'; date: { start: string | null; end: string | null } | null }
  | { type: string; [k: string]: unknown };

function extractMeta(page: NotionPage) {
  const props = page.properties;
  const titleProp = findProp(props, ['Livro', 'Name', 'Title']);
  const priorityProp = findProp(props, ['Prioridade', 'Priority', 'Status']);
  const whyProp = findProp(props, ['Por que?', 'Por que', 'Why']);
  const catProp = findProp(props, ['Categoria', 'Category', 'Categorias']);
  const dateProp = findProp(props, ['Data da Leitura', 'Reading Date', 'Date']);
  const authorProp = findProp(props, ['Author', 'Autor']);

  const title = titleProp && (titleProp as { type: 'title'; title: Array<{ plain_text: string }> }).type === 'title'
    ? richTextPlain((titleProp as unknown as { title: Array<{ plain_text: string }> }).title as never).trim()
    : '';
  const priorityLabel = readSelectLike(priorityProp);
  const why = whyProp && (whyProp as { type: string }).type === 'rich_text'
    ? richTextPlain((whyProp as unknown as { rich_text: Array<{ plain_text: string }> }).rich_text as never).trim()
    : '';
  const categories = catProp && (catProp as { type: string }).type === 'multi_select'
    ? ((catProp as unknown as { multi_select: Array<{ name: string }> }).multi_select.map((c) => c.name))
    : [];
  const date = dateProp && (dateProp as { type: string }).type === 'date'
    ? ((dateProp as unknown as { date: { start: string | null } | null }).date?.start ?? null)
    : null;
  const author = authorProp && (authorProp as { type: string }).type === 'rich_text'
    ? richTextPlain((authorProp as unknown as { rich_text: Array<{ plain_text: string }> }).rich_text as never).trim() || null
    : null;

  const priority = notionPriorityToBookPriority(priorityLabel);

  return {
    title,
    author,
    priority,
    categories,
    why: why || null,
    finished_at: priority === 'lido' ? date : null,
    started_at: priority === 'lendo' ? date : null,
  };
}

function readSelectLike(prop: NotionPageProperty | undefined): string | undefined {
  if (!prop) return undefined;
  if ((prop as { type: string }).type === 'select') {
    return (prop as unknown as { select: { name: string } | null }).select?.name;
  }
  if ((prop as { type: string }).type === 'status') {
    return (prop as unknown as { status: { name: string } | null }).status?.name;
  }
  return undefined;
}

function findProp(
  props: Record<string, NotionPageProperty>,
  names: string[],
): NotionPageProperty | undefined {
  for (const name of names) {
    if (props[name]) return props[name];
  }
  return undefined;
}

async function uploadImage(
  sourceUrl: string,
  userId: string,
  bookId: string,
): Promise<{ src: string }> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`fetch ${res.status} for ${sourceUrl.slice(0, 80)}`);
  }
  const contentType = res.headers.get('content-type') ?? 'image/png';
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);

  const extFromUrl = extname(new URL(sourceUrl).pathname).slice(1).toLowerCase();
  const ext = extFromUrl && /^[a-z0-9]{1,8}$/.test(extFromUrl)
    ? extFromUrl
    : extFromContentType(contentType);

  const objectName = `${userId}/${bookId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('book-images')
    .upload(objectName, bytes, { contentType, cacheControl: '31536000', upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage
    .from('book-images')
    .getPublicUrl(objectName);
  return { src: pub.publicUrl };
}

function extFromContentType(contentType: string): string {
  switch (contentType.split(';')[0].trim()) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/avif': return 'avif';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

function countSkippableBlocks(blocks: NotionBlock[]): number {
  let count = 0;
  const skip = new Set([
    'table_of_contents',
    'breadcrumb',
    'column_list',
    'column',
    'table',
    'table_row',
    'synced_block',
    'child_page',
    'child_database',
  ]);
  for (const b of blocks) {
    if (skip.has(b.type)) count++;
    if (b.children?.length) count += countSkippableBlocks(b.children);
  }
  return count;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
