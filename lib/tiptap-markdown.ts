// Minimal TipTap-JSON → Markdown serializer. Handles the block types we
// expose in the editor toolbar plus the marks that StarterKit + Link offer.
// Outputs CommonMark with GFM extensions (strikethrough). Lives at the
// app level so we don't take a runtime dep on tiptap-markdown.

import type { TipTapDoc, TipTapNode } from '@/lib/supabase/types';

export function tipTapToMarkdown(doc: TipTapDoc | undefined | null): string {
  if (!doc?.content?.length) return '';
  return doc.content
    .map((n) => renderBlock(n))
    .filter((s) => s.length > 0)
    .join('\n\n')
    .trim();
}

function renderBlock(node: TipTapNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderInline(node.content ?? []);
    case 'heading': {
      const level = clamp(Number(node.attrs?.level) || 1, 1, 6);
      return '#'.repeat(level) + ' ' + renderInline(node.content ?? []);
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => renderListItem(item, '-'))
        .join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      return (node.content ?? [])
        .map((item, i) => renderListItem(item, `${start + i}.`))
        .join('\n');
    }
    case 'taskList':
      // Checkbox list → GFM task list. Reuse renderListItem with a checkbox
      // marker; its marker.length-based indent handles "- [ ] " and nesting.
      return (node.content ?? [])
        .map((item) => renderListItem(item, item.attrs?.checked ? '- [x]' : '- [ ]'))
        .join('\n');
    case 'blockquote':
      return (node.content ?? [])
        .map((child) => renderBlock(child))
        .join('\n\n')
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n');
    case 'codeBlock': {
      const lang = (node.attrs?.language as string | undefined) ?? '';
      const text = (node.content ?? [])
        .map((c) => c.text ?? '')
        .join('');
      return '```' + lang + '\n' + text + '\n```';
    }
    case 'horizontalRule':
      return '---';
    case 'table':
      return renderTable(node);
    case 'databaseTable':
      return renderDatabaseTable(node);
    case 'image': {
      const alt = (node.attrs?.alt as string | undefined) ?? '';
      const src = (node.attrs?.src as string | undefined) ?? '';
      const width = node.attrs?.width;
      // Preserve resized width via inline HTML — GFM passes it through and
      // /make-pdf renders it correctly.
      if (typeof width === 'number' && width > 0 && width < 100) {
        const safeAlt = alt.replace(/"/g, '&quot;');
        return `<img src="${src}" alt="${safeAlt}" width="${width}%" />`;
      }
      return `![${alt}](${src})`;
    }
    case 'hardBreak':
      return '';
    default:
      if (node.content) return renderInline(node.content);
      return '';
  }
}

function renderTable(node: TipTapNode): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '';
  const cols = (rows[0].content ?? []).length || 1;

  const renderRow = (row: TipTapNode): string => {
    const cells = row.content ?? [];
    const out: string[] = [];
    for (let i = 0; i < cols; i += 1) out.push(renderCell(cells[i]));
    return `| ${out.join(' | ')} |`;
  };

  // GFM requires a header row + delimiter. Always promote row 0 to the header
  // (a user may have deleted the original header row; GFM still needs one).
  const header = renderRow(rows[0]);
  const delimiter = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  const body = rows.slice(1).map(renderRow);
  return [header, delimiter, ...body].join('\n');
}

function renderCell(cell: TipTapNode | undefined): string {
  if (!cell) return ' ';
  // Flatten block children to a single inline line: GFM pipe cells can't hold
  // real newlines. Collapse newlines to spaces and escape pipes. colspan /
  // rowspan / colwidth are dropped — GFM can't express spans.
  const text = (cell.content ?? [])
    .map((child) => renderBlock(child))
    .join(' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
  return text.length > 0 ? text : ' ';
}

type DbColAttr = {
  id: string;
  name: string;
  type: string;
  options?: Array<{ id: string; name: string }>;
};
type DbRowAttr = { id: string; cells?: Record<string, unknown> };

// Serialize a databaseTable node (the typed in-note database) to a GFM table so
// content_md stays searchable. multi_select ids resolve to option names; date /
// url / text render as their string value.
function renderDatabaseTable(node: TipTapNode): string {
  const attrs = node.attrs as { columns?: DbColAttr[]; rows?: DbRowAttr[] } | undefined;
  const columns = attrs?.columns ?? [];
  const rows = attrs?.rows ?? [];
  if (columns.length === 0) return '';

  const esc = (s: string): string => s.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();

  const renderValue = (col: DbColAttr, value: unknown): string => {
    if (value == null) return '';
    if (col.type === 'checkbox') return value === 'true' ? '✓' : '';
    if (col.type === 'multi_select') {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      const names = (col.options ?? []).filter((o) => ids.includes(o.id)).map((o) => o.name);
      return esc(names.join(', '));
    }
    return esc(typeof value === 'string' ? value : String(value));
  };

  const header = `| ${columns.map((c) => esc(c.name) || ' ').join(' | ')} |`;
  const delimiter = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => {
    const cells = columns.map((c) => {
      const out = renderValue(c, (r.cells ?? {})[c.id]);
      return out.length > 0 ? out : ' ';
    });
    return `| ${cells.join(' | ')} |`;
  });
  return [header, delimiter, ...body].join('\n');
}

function renderListItem(node: TipTapNode, marker: string): string {
  const blocks = (node.content ?? []).map((c) => renderBlock(c));
  if (blocks.length === 0) return `${marker} `;
  const first = blocks[0];
  const rest = blocks.slice(1);
  const indent = ' '.repeat(marker.length + 1);
  const indented = rest
    .map((b) =>
      b
        .split('\n')
        .map((line) => indent + line)
        .join('\n'),
    )
    .join('\n');
  return `${marker} ${first}${indented ? '\n' + indented : ''}`;
}

function renderInline(content: TipTapNode[]): string {
  return content.map(renderInlineNode).join('');
}

function renderInlineNode(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = node.text ?? '';
    // Apply marks in a stable order — code goes innermost.
    const marks = [...(node.marks ?? [])].sort((a, b) => markOrder(a.type) - markOrder(b.type));
    for (const mark of marks) {
      text = applyMark(text, mark);
    }
    return text;
  }
  if (node.type === 'hardBreak') return '  \n';
  if (node.type === 'image') {
    const alt = (node.attrs?.alt as string | undefined) ?? '';
    const src = (node.attrs?.src as string | undefined) ?? '';
    const width = node.attrs?.width;
    if (typeof width === 'number' && width > 0 && width < 100) {
      const safeAlt = alt.replace(/"/g, '&quot;');
      return `<img src="${src}" alt="${safeAlt}" width="${width}%" />`;
    }
    return `![${alt}](${src})`;
  }
  if (node.content) return renderInline(node.content);
  return '';
}

function applyMark(
  text: string,
  mark: { type: string; attrs?: Record<string, unknown> },
): string {
  switch (mark.type) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'strike':
      return `~~${text}~~`;
    case 'code':
      return `\`${text}\``;
    case 'link': {
      const href = (mark.attrs?.href as string | undefined) ?? '';
      return `[${text}](${href})`;
    }
    case 'highlight':
      return `<mark>${text}</mark>`;
    case 'underline':
      return `<u>${text}</u>`;
    default:
      return text;
  }
}

function markOrder(type: string): number {
  // Inner marks first; outer marks last (link wraps everything else).
  if (type === 'code') return 0;
  if (type === 'bold') return 1;
  if (type === 'italic') return 2;
  if (type === 'strike') return 3;
  if (type === 'highlight') return 4;
  if (type === 'underline') return 5;
  if (type === 'link') return 9;
  return 6;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
