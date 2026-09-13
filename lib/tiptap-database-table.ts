// DatabaseTable — a Notion-style typed-database block embedded in the note
// editor. The ENTIRE table (columns + rows + cell values) lives in the node's
// attrs as JSON, so it rides the note's existing content_json round-trip: no
// migration, no server action, no RPC. A React NodeView (database-table-view)
// renders the grid and mutates attrs via updateAttributes.
//
// Attrs are declared EXPLICITLY (never spread this.parent?.()) because the
// parent-inheritance path silently drops attrs under Next 16 + Turbopack +
// ReactNodeViewRenderer (see tiptap-resizable-image.ts). The JSON is also
// mirrored into data-* attributes via renderHTML/parseHTML so copy/paste and
// HTML export round-trip.

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { DatabaseTableView } from '@/components/database-table-view';
import type { ColumnType, MultiSelectOption, PropertyValue } from '@/lib/supabase/types';

export interface DbColumn {
  id: string;
  name: string;
  type: ColumnType;
  options: MultiSelectOption[];
}

export interface DbRow {
  id: string;
  cells: Record<string, PropertyValue>;
}

function uid(): string {
  return crypto.randomUUID();
}

// A fresh table: a text "Name" column + a multi-select "Tags" column + three
// empty rows — so it reads as a typed table immediately and shows off the
// non-text columns. The user retypes/adds columns from the header menu.
function starterAttrs(): { columns: DbColumn[]; rows: DbRow[] } {
  const columns: DbColumn[] = [
    { id: uid(), name: 'Name', type: 'text', options: [] },
    { id: uid(), name: 'Tags', type: 'multi_select', options: [] },
  ];
  const rows: DbRow[] = [
    { id: uid(), cells: {} },
    { id: uid(), cells: {} },
    { id: uid(), cells: {} },
  ];
  return { columns, rows };
}

// Build a fresh databaseTable node for the toolbar's insert action. We use a
// plain insertContent call (rather than a custom command) to avoid a Commands
// type augmentation, which pnpm's nested @tiptap/core layout can't resolve.
export function createDatabaseTableContent() {
  return { type: 'databaseTable', attrs: { id: uid(), ...starterAttrs() } };
}

function parseJsonAttr<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const DatabaseTable = Node.create({
  name: 'databaseTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      // Stable id for this table node — keys its persisted view (sort/filter/…)
      // in localStorage. Set at creation; backfilled on first mount for older
      // tables. Mirrored to data-id so copy/paste + HTML export round-trip.
      id: {
        default: null as string | null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
        renderHTML: (attrs: Record<string, unknown>) => {
          const id = (attrs as { id?: string | null }).id;
          return id ? { 'data-id': id } : {};
        },
      },
      columns: {
        default: [] as DbColumn[],
        parseHTML: (el) => parseJsonAttr<DbColumn[]>(el.getAttribute('data-columns'), []),
        renderHTML: (attrs) => ({
          'data-columns': JSON.stringify((attrs as { columns?: DbColumn[] }).columns ?? []),
        }),
      },
      rows: {
        default: [] as DbRow[],
        parseHTML: (el) => parseJsonAttr<DbRow[]>(el.getAttribute('data-rows'), []),
        renderHTML: (attrs) => ({
          'data-rows': JSON.stringify((attrs as { rows?: DbRow[] }).rows ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-database-table]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-database-table': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseTableView);
  },
});
