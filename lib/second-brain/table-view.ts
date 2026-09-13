// Shared, pure sort + filter logic for the two Notion-style table systems:
// the in-editor `databaseTable` node (components/database-table-view) and the
// folder-as-database table (app/(app)/second-brain/folders/[id]/table). Both
// share the four column types (text | multi_select | date | url); only their
// row shape and storage differ. These helpers take an accessor so they work for
// either — `DbRow.cells[colId]` or `FolderRowData.properties[colId]` (+ title).
//
// State is held in React (ephemeral, per Pedro's choice): nothing here persists.

import type { ColumnType, MultiSelectOption, PropertyValue } from '@/lib/supabase/types';

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  columnId: string;
  direction: SortDirection;
}

// Operators grouped by the column type they apply to (see operatorsForType).
// is_empty / is_not_empty apply to every type.
export type FilterOperator =
  | 'contains'
  | 'is'
  | 'is_empty'
  | 'is_not_empty'
  | 'date_is'
  | 'date_before'
  | 'date_after'
  | 'has_any'
  | 'has_all'
  | 'is_checked'
  | 'is_unchecked';

export interface FilterSpec {
  columnId: string;
  operator: FilterOperator;
  // text/url → string; date → 'YYYY-MM-DD'; multi_select → MultiSelectOption.id[].
  // Absent for the unary operators (is_empty / is_not_empty).
  value?: string | string[];
}

// Minimal column shape both systems satisfy structurally (DbColumn, FolderColumn,
// and the synthetic folder "Name" column { id:'title', type:'text', options:[] }).
export interface ViewColumn {
  id: string;
  type: ColumnType;
  options: MultiSelectOption[];
}

export function isEmptyValue(v: PropertyValue | null | undefined): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

// The operators offered for a column type. The first entry is the default when a
// filter is freshly opened.
export function operatorsForType(type: ColumnType): FilterOperator[] {
  switch (type) {
    case 'date':
      return ['date_is', 'date_before', 'date_after', 'is_empty', 'is_not_empty'];
    case 'multi_select':
      return ['has_any', 'has_all', 'is_empty', 'is_not_empty'];
    case 'checkbox':
      return ['is_checked', 'is_unchecked'];
    default: // text | url
      return ['contains', 'is', 'is_empty', 'is_not_empty'];
  }
}

export const OPERATOR_LABEL: Record<FilterOperator, string> = {
  contains: 'contains',
  is: 'is',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  date_is: 'on',
  date_before: 'before',
  date_after: 'after',
  has_any: 'has any',
  has_all: 'has all',
  is_checked: 'checked',
  is_unchecked: 'unchecked',
};

// True for operators that carry no value control.
export function operatorIsUnary(op: FilterOperator): boolean {
  return (
    op === 'is_empty' || op === 'is_not_empty' || op === 'is_checked' || op === 'is_unchecked'
  );
}

function asString(v: PropertyValue | undefined): string {
  return typeof v === 'string' ? v : '';
}
function asArray(v: PropertyValue | undefined): string[] {
  return Array.isArray(v) ? v : [];
}

// Does one cell value satisfy one filter? An operator with an empty value is a
// no-op (returns true) — the UI clears such filters, but we stay defensive here.
export function matchesFilter(value: PropertyValue | undefined, filter: FilterSpec): boolean {
  const empty = isEmptyValue(value);
  switch (filter.operator) {
    case 'is_empty':
      return empty;
    case 'is_not_empty':
      return !empty;
    case 'is_checked':
      return value === 'true';
    case 'is_unchecked':
      return value !== 'true';
    case 'contains': {
      const needle = (typeof filter.value === 'string' ? filter.value : '').trim().toLowerCase();
      if (!needle) return true;
      return asString(value).toLowerCase().includes(needle);
    }
    case 'is': {
      const target = (typeof filter.value === 'string' ? filter.value : '').trim().toLowerCase();
      if (!target) return true;
      return asString(value).trim().toLowerCase() === target;
    }
    case 'date_is':
    case 'date_before':
    case 'date_after': {
      const target = typeof filter.value === 'string' ? filter.value : '';
      if (!target) return true;
      if (empty) return false;
      const v = asString(value); // ISO 'YYYY-MM-DD' compares lexicographically = chronologically
      if (filter.operator === 'date_is') return v === target;
      if (filter.operator === 'date_before') return v < target;
      return v > target;
    }
    case 'has_any':
    case 'has_all': {
      const wanted = Array.isArray(filter.value) ? filter.value : [];
      if (wanted.length === 0) return true;
      const have = new Set(asArray(value));
      return filter.operator === 'has_any'
        ? wanted.some((id) => have.has(id))
        : wanted.every((id) => have.has(id));
    }
    default:
      return true;
  }
}

// Comparator factory. Empty values always sort last (in BOTH directions); the
// type-aware comparison then has the direction applied. `options` gives a
// multi_select column its canonical option order.
export function makeComparator(
  type: ColumnType,
  options: MultiSelectOption[],
  direction: SortDirection,
): (a: PropertyValue | undefined, b: PropertyValue | undefined) => number {
  const dir = direction === 'asc' ? 1 : -1;
  const optionIndex = new Map(options.map((o, i) => [o.id, i] as const));

  // multi_select rank = position of the earliest selected option in the column.
  function rank(v: PropertyValue | undefined): number {
    let best = Number.POSITIVE_INFINITY;
    for (const id of asArray(v)) {
      const idx = optionIndex.get(id);
      if (idx != null && idx < best) best = idx;
    }
    return best;
  }

  return (a, b) => {
    // Checkbox: false (0) before true (1) in ascending order — NOT "empties last",
    // so unchecked rows group together. Must run before the empty-value check
    // (unchecked is stored as an absent/empty value).
    if (type === 'checkbox') {
      return ((a === 'true' ? 1 : 0) - (b === 'true' ? 1 : 0)) * dir;
    }
    const ae = isEmptyValue(a);
    const be = isEmptyValue(b);
    if (ae && be) return 0;
    if (ae) return 1; // empties last, regardless of direction
    if (be) return -1;

    let cmp = 0;
    if (type === 'multi_select') {
      cmp = rank(a) - rank(b);
    } else if (type === 'date') {
      cmp = asString(a).localeCompare(asString(b));
    } else {
      cmp = asString(a).localeCompare(asString(b), undefined, { sensitivity: 'base' });
    }
    return cmp * dir;
  };
}

// Apply active filters (AND-combined) then the single active sort. Generic over
// the row type via `getValue`. Filters/sort referencing a missing column are
// skipped (defensive: a column may have been deleted while a view was active).
export function applyView<T>(
  rows: T[],
  columns: ViewColumn[],
  sort: SortSpec | null,
  filters: FilterSpec[],
  getValue: (row: T, columnId: string) => PropertyValue | undefined,
): T[] {
  const colById = new Map(columns.map((c) => [c.id, c] as const));

  let out = rows;
  for (const f of filters) {
    if (!colById.has(f.columnId)) continue;
    out = out.filter((r) => matchesFilter(getValue(r, f.columnId), f));
  }

  if (sort) {
    const col = colById.get(sort.columnId);
    if (col) {
      const cmp = makeComparator(col.type, col.options, sort.direction);
      out = [...out].sort((a, b) => cmp(getValue(a, sort.columnId), getValue(b, sort.columnId)));
    }
  }

  return out;
}

const COERCE_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Best-effort value coercion when a column's type changes. Shared by both
// surfaces (the in-editor retype, the folder optimistic retype) AND the folder
// server action, so client and server always agree on what survives a retype.
// Returns undefined to clear the cell.
export function coerceValue(
  value: PropertyValue | undefined,
  fromType: ColumnType,
  toType: ColumnType,
  options: MultiSelectOption[],
): PropertyValue | undefined {
  if (fromType === toType) return value;
  if (toType === 'multi_select') return undefined; // raw strings can't map to option ids
  if (toType === 'checkbox') return value === 'true' ? 'true' : undefined;
  if (fromType === 'multi_select') {
    if (toType === 'date') return undefined;
    const ids = Array.isArray(value) ? value : [];
    const names = options.filter((o) => ids.includes(o.id)).map((o) => o.name).join(', ');
    return names || undefined;
  }
  const s = typeof value === 'string' ? value : '';
  if (toType === 'date') return COERCE_ISO_DATE_RE.test(s) ? s : undefined;
  return s || undefined; // text or url — keep the string
}

// Persisted "remember current view" config. Folder tables store this in the
// folders.table_view jsonb column; in-editor tables store it in localStorage
// keyed by the node id. widths/hidden are populated by the column resize/hide UI.
export interface TableViewConfig {
  sort: SortSpec | null;
  filters: FilterSpec[];
  widths: Record<string, number>;
  hidden: string[];
}

// Coerce an untrusted parsed value (DB jsonb / localStorage) into a full config,
// so a partial or malformed blob never breaks the table.
export function normalizeViewConfig(raw: unknown): TableViewConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<TableViewConfig>;
  const sort =
    v.sort && typeof v.sort === 'object' && typeof (v.sort as SortSpec).columnId === 'string'
      ? (v.sort as SortSpec)
      : null;
  return {
    sort,
    filters: Array.isArray(v.filters) ? (v.filters as FilterSpec[]) : [],
    widths: v.widths && typeof v.widths === 'object' ? (v.widths as Record<string, number>) : {},
    hidden: Array.isArray(v.hidden) ? (v.hidden as string[]) : [],
  };
}
