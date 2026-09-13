'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnType, MultiSelectOption, PropertyValue } from '@/lib/supabase/types';
import type { DbColumn, DbRow } from '@/lib/tiptap-database-table';
import {
  applyView,
  coerceValue,
  normalizeViewConfig,
  type FilterSpec,
  type SortDirection,
  type SortSpec,
} from '@/lib/second-brain/table-view';
import { CellDispatch } from '@/components/database-cells/cell-dispatch';
import { AddColumnButton, ColumnHeader } from '@/components/database-cells/column-header';
import { SortFilterBar } from '@/components/database-cells/sort-filter-ui';
import { RowMenu } from '@/components/database-cells/row-menu';
import { HiddenColumnsControl } from '@/components/database-cells/hidden-columns-control';

function uid(): string {
  return crypto.randomUUID();
}

function isEmpty(v: PropertyValue | null | undefined): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Read a table's persisted view (sort/filter) from localStorage. Returns defaults
// when there's no id, no saved entry, or storage is unavailable.
function readStoredView(id: string | null): {
  sort: SortSpec | null;
  filters: FilterSpec[];
  hidden: string[];
  widths: Record<string, number>;
} {
  if (!id || typeof window === 'undefined') {
    return { sort: null, filters: [], hidden: [], widths: {} };
  }
  try {
    const raw = window.localStorage.getItem(`db-table-view:${id}`);
    if (!raw) return { sort: null, filters: [], hidden: [], widths: {} };
    const v = normalizeViewConfig(JSON.parse(raw));
    return { sort: v.sort, filters: v.filters, hidden: v.hidden, widths: v.widths };
  } catch {
    return { sort: null, filters: [], hidden: [], widths: {} };
  }
}

// React NodeView for the `databaseTable` node. Owns every mutation: it reads the
// current columns/rows fresh from node.attrs inside each handler (never a stale
// closure) and writes the full array back via updateAttributes. The editor's
// autosave (notes-editor onUpdate → 1500ms) then persists content_json.
export function DatabaseTableView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  // Memoize so the derived refs stay stable between renders (the visibleRows
  // useMemo below depends on them); they change only when attrs actually change.
  const columns = useMemo(() => (node.attrs.columns as DbColumn[]) ?? [], [node.attrs.columns]);
  const rows = useMemo(() => (node.attrs.rows as DbRow[]) ?? [], [node.attrs.rows]);

  const readCols = useCallback(() => (node.attrs.columns as DbColumn[]) ?? [], [node]);
  const readRows = useCallback(() => (node.attrs.rows as DbRow[]) ?? [], [node]);

  // Stable id for this table node — keys its persisted view in localStorage.
  // New tables get one at creation; backfill older tables once on mount.
  const tableId = node.attrs.id as string | null;
  useEffect(() => {
    if (!tableId) updateAttributes({ id: uid() });
  }, [tableId, updateAttributes]);

  // Sort + filter are view-only (kept in React, never written to node.attrs so
  // they don't churn autosave or pollute the editor's undo stack). They're seeded
  // from + saved to localStorage, keyed by the node id, so the view survives a
  // reopen on this device. Cell edits still target rows by id, so reordering the
  // displayed rows never affects which row is written.
  const [sort, setSort] = useState<SortSpec | null>(() => readStoredView(tableId).sort);
  const [filters, setFilters] = useState<FilterSpec[]>(() => readStoredView(tableId).filters);
  const [hidden, setHidden] = useState<string[]>(() => readStoredView(tableId).hidden);
  const [widths, setWidths] = useState<Record<string, number>>(
    () => readStoredView(tableId).widths,
  );

  // Persist the view (debounced) — out of band from the document, so autosave and
  // undo stay untouched. The initial run just re-saves the seeded value.
  const viewKey = tableId ? `db-table-view:${tableId}` : null;
  useEffect(() => {
    if (!viewKey) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(viewKey, JSON.stringify({ sort, filters, hidden, widths }));
      } catch {
        // ignore unavailable storage
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [viewKey, sort, filters, hidden, widths]);

  const visibleRows = useMemo(
    () => applyView(rows, columns, sort, filters, (r, colId) => r.cells[colId]),
    [rows, columns, sort, filters],
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.includes(c.id)),
    [columns, hidden],
  );

  const setColumnFilter = useCallback((colId: string, next: FilterSpec | null) => {
    setFilters((fs) => {
      const without = fs.filter((f) => f.columnId !== colId);
      return next ? [...without, next] : without;
    });
  }, []);

  const removeFilter = useCallback((colId: string) => {
    setFilters((fs) => fs.filter((f) => f.columnId !== colId));
  }, []);

  const clearView = useCallback(() => {
    setSort(null);
    setFilters([]);
  }, []);

  const hideColumn = useCallback((colId: string) => {
    setHidden((h) => (h.includes(colId) ? h : [...h, colId]));
  }, []);
  const showColumn = useCallback((colId: string) => {
    setHidden((h) => h.filter((id) => id !== colId));
  }, []);
  const setColumnWidth = useCallback((colId: string, px: number) => {
    setWidths((w) => ({ ...w, [colId]: px }));
  }, []);

  const setCell = useCallback(
    (rowId: string, colId: string, value: PropertyValue | null) => {
      const next = readRows().map((r) => {
        if (r.id !== rowId) return r;
        const cells = { ...r.cells };
        if (isEmpty(value)) delete cells[colId];
        else cells[colId] = value as PropertyValue;
        return { ...r, cells };
      });
      updateAttributes({ rows: next });
    },
    [readRows, updateAttributes],
  );

  const addRow = useCallback(() => {
    updateAttributes({ rows: [...readRows(), { id: uid(), cells: {} }] });
  }, [readRows, updateAttributes]);

  const deleteRow = useCallback(
    (rowId: string) => {
      updateAttributes({ rows: readRows().filter((r) => r.id !== rowId) });
    },
    [readRows, updateAttributes],
  );

  const duplicateRow = useCallback(
    (rowId: string) => {
      const rs = readRows();
      const i = rs.findIndex((r) => r.id === rowId);
      if (i === -1) return;
      const copy: DbRow = { id: uid(), cells: { ...rs[i].cells } };
      updateAttributes({ rows: [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)] });
    },
    [readRows, updateAttributes],
  );

  const addColumn = useCallback(
    (name: string, type: ColumnType) => {
      updateAttributes({
        columns: [...readCols(), { id: uid(), name: name.trim() || 'Column', type, options: [] }],
      });
    },
    [readCols, updateAttributes],
  );

  const renameColumn = useCallback(
    (colId: string, name: string) => {
      const clean = name.trim();
      if (!clean) return;
      updateAttributes({
        columns: readCols().map((c) => (c.id === colId ? { ...c, name: clean } : c)),
      });
    },
    [readCols, updateAttributes],
  );

  const setColumnOptions = useCallback(
    (colId: string, options: MultiSelectOption[]) => {
      updateAttributes({
        columns: readCols().map((c) => (c.id === colId ? { ...c, options } : c)),
      });
    },
    [readCols, updateAttributes],
  );

  const retypeColumn = useCallback(
    (colId: string, toType: ColumnType) => {
      const cols = readCols();
      const col = cols.find((c) => c.id === colId);
      if (!col || col.type === toType) return;
      const nextCols = cols.map((c) => (c.id === colId ? { ...c, type: toType } : c));
      const nextRows = readRows().map((r) => {
        if (!(colId in r.cells)) return r;
        const coerced = coerceValue(r.cells[colId], col.type, toType, col.options);
        const cells = { ...r.cells };
        if (isEmpty(coerced)) delete cells[colId];
        else cells[colId] = coerced as PropertyValue;
        return { ...r, cells };
      });
      // A filter built for the old type no longer makes sense — drop it.
      setFilters((fs) => fs.filter((f) => f.columnId !== colId));
      updateAttributes({ columns: nextCols, rows: nextRows });
    },
    [readCols, readRows, updateAttributes],
  );

  const moveColumn = useCallback(
    (colId: string, dir: -1 | 1) => {
      const cols = readCols();
      const visIds = cols.filter((c) => !hidden.includes(c.id)).map((c) => c.id);
      const target = visIds[visIds.indexOf(colId) + dir];
      if (!target) return;
      const arr = [...cols];
      const a = arr.findIndex((c) => c.id === colId);
      const b = arr.findIndex((c) => c.id === target);
      [arr[a], arr[b]] = [arr[b], arr[a]];
      updateAttributes({ columns: arr });
    },
    [readCols, updateAttributes, hidden],
  );

  const deleteColumn = useCallback(
    (colId: string) => {
      const nextRows = readRows().map((r) => {
        if (!(colId in r.cells)) return r;
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      });
      // Drop any view state that referenced the now-deleted column.
      setFilters((fs) => fs.filter((f) => f.columnId !== colId));
      setSort((s) => (s?.columnId === colId ? null : s));
      setHidden((h) => h.filter((id) => id !== colId));
      setWidths((w) => {
        if (!(colId in w)) return w;
        const next = { ...w };
        delete next[colId];
        return next;
      });
      updateAttributes({ columns: readCols().filter((c) => c.id !== colId), rows: nextRows });
    },
    [readCols, readRows, updateAttributes],
  );

  // Keep clicks inside the grid from triggering ProseMirror node-selection drags.
  // Bubbles after the inner input already handled the event, so inputs still focus.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <NodeViewWrapper
      as="div"
      contentEditable={false}
      className={cn(
        'group/db my-4',
        selected && 'ring-accent ring-offset-surface rounded-xl ring-2 ring-offset-2',
      )}
      onMouseDown={stop}
    >
      <SortFilterBar
        columns={columns}
        sort={sort}
        filters={filters}
        shown={visibleRows.length}
        total={rows.length}
        onClearSort={() => setSort(null)}
        onRemoveFilter={removeFilter}
        onClearAll={clearView}
      />
      {hidden.length > 0 ? (
        <div className="px-0.5 pb-2">
          <HiddenColumnsControl columns={columns} hidden={hidden} onShow={showColumn} />
        </div>
      ) : null}
      <div className="bg-surface border-border -mx-4 overflow-x-auto border-y sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-max min-w-full border-collapse">
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.id} style={widths[col.id] ? { width: widths[col.id] } : undefined} />
            ))}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              {visibleColumns.map((col, i) => (
                <th
                  key={col.id}
                  className="border-border bg-surface-2 min-w-[160px] border-b border-r text-left"
                >
                  <ColumnHeader
                    column={col}
                    index={i}
                    total={visibleColumns.length}
                    sort={sort}
                    filter={filters.find((f) => f.columnId === col.id)}
                    onRename={(name) => renameColumn(col.id, name)}
                    onRetype={(t) => retypeColumn(col.id, t)}
                    onMove={(dir) => moveColumn(col.id, dir)}
                    onDelete={() => deleteColumn(col.id)}
                    onHide={() => hideColumn(col.id)}
                    onOptionsChange={(opts) => setColumnOptions(col.id, opts)}
                    width={widths[col.id]}
                    onResize={(px) => setColumnWidth(col.id, px)}
                    onSort={(dir: SortDirection) => setSort({ columnId: col.id, direction: dir })}
                    onClearSort={() => setSort(null)}
                    onFilter={(next) => setColumnFilter(col.id, next)}
                  />
                </th>
              ))}
              <th className="border-border bg-surface-2 w-10 min-w-[40px] border-b p-0 align-middle">
                <AddColumnButton onAdd={addColumn} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="group/row">
                {visibleColumns.map((col) => (
                  <td key={col.id} className="border-border border-b border-r align-top">
                    <CellDispatch
                      column={col}
                      value={row.cells[col.id]}
                      onChange={(v) => setCell(row.id, col.id, v)}
                      onColumnOptionsChange={(opts) => setColumnOptions(col.id, opts)}
                    />
                  </td>
                ))}
                <td className="border-border border-b p-0 align-middle">
                  <RowMenu
                    onDuplicate={() => duplicateRow(row.id)}
                    onDelete={() => deleteRow(row.id)}
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={visibleColumns.length + 1} className="border-border border-b p-0">
                <button
                  type="button"
                  onClick={addRow}
                  className="text-text-3 hover:bg-surface-2 hover:text-text flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[13px] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover/db:opacity-100">
        <button
          type="button"
          onClick={() => deleteNode()}
          className="text-text-4 flex items-center gap-1 px-1 text-[11px] hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
          Delete table
        </button>
      </div>
    </NodeViewWrapper>
  );
}
