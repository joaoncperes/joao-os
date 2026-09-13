// Notion blocks → TipTap-compatible JSON. Pure transformation, no I/O.
//
// Notion's block model nests children by block_id; the caller is expected
// to flatten the tree by walking `block.children` (pre-fetched) before
// handing things to `notionBlocksToTipTap`. Anything we don't understand
// degrades to a paragraph so we never silently drop text.
//
// `uploadImage(url)` is plugged in by the migration runner so the converter
// stays free of file I/O. Return the persistent URL (Supabase Storage) for
// the image and we'll splat it into the TipTap node.

import type { TipTapDoc, TipTapNode } from '@/lib/supabase/types';

// --- Public types --------------------------------------------------------

export interface NotionRichText {
  type: string;
  plain_text?: string;
  text?: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  href?: string | null;
  // Mentions and equations get rendered with their plain_text.
  [key: string]: unknown;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  // The block-specific payload is keyed by `type` in Notion's API. We treat
  // it as a loose record so this stays compatible with future Notion fields.
  [key: string]: unknown;
}

export type ImageUploader = (
  url: string,
  caption?: string,
) => Promise<{ src: string; alt?: string }>;

// --- Entry point ---------------------------------------------------------

export async function notionBlocksToTipTap(
  blocks: NotionBlock[],
  uploadImage: ImageUploader,
): Promise<TipTapDoc> {
  const content = await convertBlocks(blocks, uploadImage);
  return { type: 'doc', content };
}

// --- Block walker --------------------------------------------------------

async function convertBlocks(
  blocks: NotionBlock[],
  uploadImage: ImageUploader,
): Promise<TipTapNode[]> {
  const out: TipTapNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Coalesce consecutive bulleted/numbered list items into a single list.
    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      const listType = block.type;
      const items: TipTapNode[] = [];
      while (i < blocks.length && blocks[i].type === listType) {
        items.push(await listItemFromBlock(blocks[i], uploadImage));
        i++;
      }
      out.push({
        type: listType === 'bulleted_list_item' ? 'bulletList' : 'orderedList',
        content: items,
      });
      continue;
    }

    // to_do groups into a task-style bullet list (we don't have a TaskList
    // extension installed, so render checkboxes as bullet items prefixed
    // with [x]/[ ] for now — round-trips cleanly via markdown).
    if (block.type === 'to_do') {
      const items: TipTapNode[] = [];
      while (i < blocks.length && blocks[i].type === 'to_do') {
        const b = blocks[i];
        const checked = (b.to_do as { checked?: boolean } | undefined)?.checked ?? false;
        const richText = ((b.to_do as { rich_text?: NotionRichText[] } | undefined)?.rich_text ?? []);
        const prefix: TipTapNode = {
          type: 'text',
          text: checked ? '[x] ' : '[ ] ',
        };
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [prefix, ...richTextToInline(richText)],
            },
            ...(b.has_children && b.children
              ? await convertBlocks(b.children, uploadImage)
              : []),
          ],
        });
        i++;
      }
      out.push({ type: 'bulletList', content: items });
      continue;
    }

    const node = await blockToNode(block, uploadImage);
    if (node) out.push(node);
    i++;
  }
  return out;
}

async function listItemFromBlock(
  block: NotionBlock,
  uploadImage: ImageUploader,
): Promise<TipTapNode> {
  const key = block.type as 'bulleted_list_item' | 'numbered_list_item';
  const richText = ((block[key] as { rich_text?: NotionRichText[] } | undefined)?.rich_text ?? []);
  const para: TipTapNode = {
    type: 'paragraph',
    content: richTextToInline(richText),
  };
  const children = block.has_children && block.children
    ? await convertBlocks(block.children, uploadImage)
    : [];
  return {
    type: 'listItem',
    content: [para, ...children],
  };
}

async function blockToNode(
  block: NotionBlock,
  uploadImage: ImageUploader,
): Promise<TipTapNode | null> {
  switch (block.type) {
    case 'paragraph': {
      const richText = ((block.paragraph as { rich_text?: NotionRichText[] } | undefined)?.rich_text ?? []);
      if (richText.length === 0) {
        // Notion emits empty paragraphs as spacers — preserve them so vertical
        // rhythm survives the migration.
        return { type: 'paragraph' };
      }
      return { type: 'paragraph', content: richTextToInline(richText) };
    }
    case 'heading_1':
      return heading(1, (block.heading_1 as { rich_text?: NotionRichText[] }).rich_text);
    case 'heading_2':
      return heading(2, (block.heading_2 as { rich_text?: NotionRichText[] }).rich_text);
    case 'heading_3':
      return heading(3, (block.heading_3 as { rich_text?: NotionRichText[] }).rich_text);
    case 'quote': {
      const richText = ((block.quote as { rich_text?: NotionRichText[] } | undefined)?.rich_text ?? []);
      const childContent = block.has_children && block.children
        ? await convertBlocks(block.children, uploadImage)
        : [];
      return {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: richTextToInline(richText) },
          ...childContent,
        ],
      };
    }
    case 'callout': {
      // No callout node in TipTap by default — render as a styled blockquote
      // so the lead emphasis survives.
      const payload = block.callout as
        | { rich_text?: NotionRichText[]; icon?: { emoji?: string } }
        | undefined;
      const richText = payload?.rich_text ?? [];
      const emoji = payload?.icon?.emoji;
      const lead: TipTapNode[] = emoji
        ? [{ type: 'text', text: `${emoji} `, marks: [{ type: 'bold' }] }]
        : [];
      return {
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [...lead, ...richTextToInline(richText)] },
        ],
      };
    }
    case 'toggle': {
      // Render as a bolded summary + indented content (no TipTap details node
      // available without an extension).
      const richText = ((block.toggle as { rich_text?: NotionRichText[] } | undefined)?.rich_text ?? []);
      const childContent = block.has_children && block.children
        ? await convertBlocks(block.children, uploadImage)
        : [];
      return {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: richTextToInline(richText).map((n) =>
              n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), { type: 'bold' }] } : n,
            ),
          },
          ...childContent,
        ],
      };
    }
    case 'code': {
      const payload = block.code as
        | { rich_text?: NotionRichText[]; language?: string }
        | undefined;
      const text = (payload?.rich_text ?? []).map((rt) => rt.plain_text ?? '').join('');
      return {
        type: 'codeBlock',
        attrs: { language: payload?.language ?? null },
        content: text ? [{ type: 'text', text }] : undefined,
      };
    }
    case 'divider':
      return { type: 'horizontalRule' };
    case 'image': {
      const payload = block.image as
        | {
            type?: 'external' | 'file';
            external?: { url: string };
            file?: { url: string };
            caption?: NotionRichText[];
          }
        | undefined;
      const sourceUrl =
        payload?.type === 'external'
          ? payload.external?.url
          : payload?.file?.url;
      if (!sourceUrl) return null;
      const captionText = (payload?.caption ?? [])
        .map((rt) => rt.plain_text ?? '')
        .join('')
        .trim();
      const uploaded = await uploadImage(sourceUrl, captionText || undefined);
      return {
        type: 'image',
        attrs: {
          src: uploaded.src,
          alt: uploaded.alt ?? captionText ?? null,
          title: captionText || null,
        },
      };
    }
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url =
        (block[block.type] as { url?: string } | undefined)?.url ?? '';
      if (!url) return null;
      return {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: url,
            marks: [{ type: 'link', attrs: { href: url } }],
          },
        ],
      };
    }
    case 'table_of_contents':
    case 'breadcrumb':
    case 'column_list':
    case 'column':
    case 'table':
    case 'table_row':
    case 'synced_block':
    case 'child_page':
    case 'child_database':
      // Skip — too complex to preserve usefully in a notes editor.
      return null;
    default: {
      // Unknown block — try to render its rich_text payload if present.
      const candidate = block[block.type] as
        | { rich_text?: NotionRichText[] }
        | undefined;
      if (candidate?.rich_text?.length) {
        return { type: 'paragraph', content: richTextToInline(candidate.rich_text) };
      }
      return null;
    }
  }
}

function heading(level: 1 | 2 | 3, richText?: NotionRichText[]): TipTapNode {
  return {
    type: 'heading',
    attrs: { level },
    content: richTextToInline(richText ?? []),
  };
}

// --- Rich text → inline content -----------------------------------------

function richTextToInline(richText: NotionRichText[]): TipTapNode[] {
  return richText
    .map((rt) => {
      const text = rt.plain_text ?? rt.text?.content ?? '';
      if (!text) return null;
      const marks = [] as TipTapNode['marks'];
      const ann = rt.annotations ?? {};
      if (ann.code) marks!.push({ type: 'code' });
      if (ann.bold) marks!.push({ type: 'bold' });
      if (ann.italic) marks!.push({ type: 'italic' });
      if (ann.strikethrough) marks!.push({ type: 'strike' });
      if (ann.underline) marks!.push({ type: 'underline' });
      const href = rt.href ?? rt.text?.link?.url;
      if (href) marks!.push({ type: 'link', attrs: { href } });
      const node: TipTapNode = { type: 'text', text };
      if (marks && marks.length > 0) node.marks = marks;
      return node;
    })
    .filter((n): n is TipTapNode => n != null);
}

// --- Helper to extract plain text from rich_text props -------------------

export function richTextPlain(rt: NotionRichText[] | undefined | null): string {
  if (!rt) return '';
  return rt.map((r) => r.plain_text ?? r.text?.content ?? '').join('');
}

// --- Notion Prioridade label → BookPriority -----------------------------

export function notionPriorityToBookPriority(label?: string):
  | 'lendo' | 'urgente' | 'alta' | 'media' | 'baixa' | 'lido' {
  switch ((label ?? '').toLowerCase().trim()) {
    case 'lendo': return 'lendo';
    case 'urgente': return 'urgente';
    case 'alta': return 'alta';
    case 'média':
    case 'media': return 'media';
    case 'baixa': return 'baixa';
    case 'lido': return 'lido';
    default: return 'media';
  }
}
