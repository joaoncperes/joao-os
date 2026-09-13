'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type {
  ColumnType,
  FolderColumn,
  MultiSelectOption,
  NoteProperties,
  PropertyValue,
} from '@/lib/supabase/types';
import {
  applyView,
  coerceValue,
  type FilterSpec,
  type SortDirection,
  type SortSpec,
  type TableViewConfig,
  type ViewColumn,
} from '@/lib/second-brain/table-view';
import { COLUMN_TYPE_META } from '@/lib/second-brain/column-display';
import type { FolderRowData } from './types';
import {
  addColumn as addColumnAction,
  createNote as createNoteAction,
  deleteColumn as deleteColumnAction,
  deleteNote as deleteNoteAction,
  duplicateNote as duplicateNoteAction,
  renameColumn as renameColumnAction,
  reorderColumns as reorderColumnsAction,
  retypeColumn as retypeColumnAction,
  saveFolderTableView as saveFolderTableViewAction,
  setNoteProperty as setNotePropertyAction,
  updateColumnOptions as updateColumnOptionsAction,
  updateNoteTitle as updateNoteTitleAction,
} from '../../../actions';

function isEmptyValue(value: PropertyValue | null): boolean {
  return (
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function applyValue(
  props: NoteProperties,
  columnId: string,
  value: PropertyValue | null,
): NoteProperties {
  const next = { ...props };
  if (isEmptyValue(value)) delete next[columnId];
  else next[columnId] = value as PropertyValue;
  return next;
}

function byCreatedAsc(a: FolderRowData, b: FolderRowData): number {
  return a.created_at.localeCompare(b.created_at);
}

// Sentinel id for the implicit "Name" column (note.title), which isn't a
// folder_column. Lets it participate in sort/filter like a text column.
export const NAME_COLUMN_ID = 'title';

interface FolderTableCtx {
  folderId: string;
  columns: FolderColumn[];
  // visibleColumns = columns minus hidden ones (render order); columns = all.
  visibleColumns: FolderColumn[];
  // rows = raw, created-order; visibleRows = after active filters + sort.
  rows: FolderRowData[];
  visibleRows: FolderRowData[];
  sort: SortSpec | null;
  filters: FilterSpec[];
  setCell: (noteId: string, columnId: string, value: PropertyValue | null) => void;
  setTitle: (noteId: string, title: string) => void;
  addColumn: (name: string, type: ColumnType) => Promise<void>;
  renameColumn: (columnId: string, name: string) => void;
  retypeColumn: (columnId: string, toType: ColumnType) => void;
  deleteColumn: (columnId: string) => void;
  reorderColumns: (orderedIds: string[]) => void;
  setColumnOptions: (columnId: string, options: MultiSelectOption[]) => void;
  addRow: () => Promise<string | null>;
  deleteRow: (noteId: string) => void;
  duplicateRow: (noteId: string) => Promise<void>;
  setSort: (columnId: string, direction: SortDirection) => void;
  clearSort: () => void;
  setColumnFilter: (columnId: string, next: FilterSpec | null) => void;
  removeFilter: (columnId: string) => void;
  clearView: () => void;
  hidden: string[];
  hideColumn: (columnId: string) => void;
  showColumn: (columnId: string) => void;
  widths: Record<string, number>;
  setColumnWidth: (columnId: string, px: number) => void;
}

const Ctx = createContext<FolderTableCtx | null>(null);

export function useFolderTable(): FolderTableCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFolderTable must be used within FolderTableProvider');
  return ctx;
}

// Holds the folder's columns + rows in local state and applies every mutation
// optimistically (instant UI), rolling back + toasting if the server rejects.
// Cell components debounce *when* they call setCell; the optimistic write here
// is immediate.
export function FolderTableProvider({
  folderId,
  initialColumns,
  initialRows,
  initialView,
  children,
}: {
  folderId: string;
  initialColumns: FolderColumn[];
  initialRows: FolderRowData[];
  initialView?: TableViewConfig;
  children: ReactNode;
}) {
  const [columns, setColumns] = useState<FolderColumn[]>(initialColumns);
  const [rows, setRows] = useState<FolderRowData[]>(() =>
    [...initialRows].sort(byCreatedAsc),
  );

  // View state — seeded from the persisted folders.table_view and saved back
  // (debounced) so the view survives reloads. Without a sort, visibleRows keeps
  // the created-order of `rows`.
  const [sort, setSortState] = useState<SortSpec | null>(initialView?.sort ?? null);
  const [filters, setFilters] = useState<FilterSpec[]>(initialView?.filters ?? []);
  const [widths, setWidths] = useState<Record<string, number>>(initialView?.widths ?? {});
  const [hidden, setHidden] = useState<string[]>(initialView?.hidden ?? []);

  // Persist the view (debounced); skip the initial render so the seeded value
  // isn't immediately re-saved. The server action does NOT revalidate, so the
  // table isn't remounted out from under the optimistic state.
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    const t = setTimeout(() => {
      void saveFolderTableViewAction(folderId, { sort, filters, widths, hidden });
    }, 700);
    return () => clearTimeout(t);
  }, [folderId, sort, filters, widths, hidden]);

  // The Name column (note.title) joins the typed columns as a synthetic text
  // column so it can be sorted/filtered alongside them.
  const viewColumns: ViewColumn[] = useMemo(
    () => [
      { id: NAME_COLUMN_ID, type: 'text', options: [] },
      ...columns.map((c) => ({ id: c.id, type: c.type, options: c.options })),
    ],
    [columns],
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.includes(c.id)),
    [columns, hidden],
  );

  const visibleRows = useMemo(
    () =>
      applyView(rows, viewColumns, sort, filters, (r, colId) =>
        colId === NAME_COLUMN_ID ? r.title ?? '' : r.properties[colId],
      ),
    [rows, viewColumns, sort, filters],
  );

  function setSort(columnId: string, direction: SortDirection) {
    setSortState({ columnId, direction });
  }
  function clearSort() {
    setSortState(null);
  }
  function setColumnFilter(columnId: string, next: FilterSpec | null) {
    setFilters((fs) => {
      const without = fs.filter((f) => f.columnId !== columnId);
      return next ? [...without, next] : without;
    });
  }
  function removeFilter(columnId: string) {
    setFilters((fs) => fs.filter((f) => f.columnId !== columnId));
  }
  function clearView() {
    setSortState(null);
    setFilters([]);
  }
  function hideColumn(columnId: string) {
    setHidden((h) => (h.includes(columnId) ? h : [...h, columnId]));
  }
  function showColumn(columnId: string) {
    setHidden((h) => h.filter((id) => id !== columnId));
  }
  function setColumnWidth(columnId: string, px: number) {
    setWidths((w) => ({ ...w, [columnId]: px }));
  }

  function setCell(noteId: string, columnId: string, value: PropertyValue | null) {
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.id === noteId
          ? { ...r, properties: applyValue(r.properties, columnId, value) }
          : r,
      ),
    );
    setNotePropertyAction({ noteId, columnId, value }).then((res) => {
      if (!res.ok) {
        setRows(prev);
        toast.error(`Couldn't save: ${res.error}`);
      }
    });
  }

  function setTitle(noteId: string, title: string) {
    const clean = title.trim() || null;
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === noteId ? { ...r, title: clean } : r)));
    updateNoteTitleAction({ noteId, title: clean }).then((res) => {
      if (!res.ok) {
        setRows(prev);
        toast.error(`Couldn't save: ${res.error}`);
      }
    });
  }

  async function addColumn(name: string, type: ColumnType) {
    const clean = name.trim();
    if (!clean) return;
    const res = await addColumnAction({ folderId, name: clean, type });
    if (!res.ok) {
      toast.error(`Failed: ${res.error}`);
      return;
    }
    setColumns((cs) => [
      ...cs,
      {
        id: res.data.id,
        user_id: '',
        folder_id: folderId,
        name: clean,
        type,
        options: [],
        position: cs.length,
        created_at: '',
        updated_at: '',
      },
    ]);
  }

  function renameColumn(columnId: string, name: string) {
    const clean = name.trim();
    if (!clean) return;
    const prev = columns;
    setColumns((cs) => cs.map((c) => (c.id === columnId ? { ...c, name: clean } : c)));
    renameColumnAction(folderId, columnId, clean).then((res) => {
      if (!res.ok) {
        setColumns(prev);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  // Change a column's type, coercing existing cell values via the shared
  // coerceValue (so client + server agree). Confirms first when the column holds
  // data, since some values may be cleared.
  function retypeColumn(columnId: string, toType: ColumnType) {
    const col = columns.find((c) => c.id === columnId);
    if (!col || col.type === toType) return;
    const hasData = rows.some((r) => !isEmptyValue(r.properties[columnId] ?? null));
    if (
      hasData &&
      !window.confirm(
        `Change “${col.name}” to ${COLUMN_TYPE_META[toType].label}? Some values may be cleared.`,
      )
    ) {
      return;
    }
    const prevCols = columns;
    const prevRows = rows;
    setColumns((cs) => cs.map((c) => (c.id === columnId ? { ...c, type: toType } : c)));
    setRows((rs) =>
      rs.map((r) => {
        if (!(columnId in r.properties)) return r;
        const coerced = coerceValue(r.properties[columnId], col.type, toType, col.options);
        return { ...r, properties: applyValue(r.properties, columnId, coerced ?? null) };
      }),
    );
    // A filter built for the old type no longer fits — drop it.
    setFilters((fs) => fs.filter((f) => f.columnId !== columnId));
    retypeColumnAction(folderId, columnId, toType).then((res) => {
      if (!res.ok) {
        setColumns(prevCols);
        setRows(prevRows);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  function deleteColumn(columnId: string) {
    const prevCols = columns;
    const prevRows = rows;
    setColumns((cs) => cs.filter((c) => c.id !== columnId));
    setRows((rs) =>
      rs.map((r) => {
        if (!(columnId in r.properties)) return r;
        const next = { ...r.properties };
        delete next[columnId];
        return { ...r, properties: next };
      }),
    );
    // Drop any view state that referenced the now-deleted column.
    setFilters((fs) => fs.filter((f) => f.columnId !== columnId));
    setSortState((s) => (s?.columnId === columnId ? null : s));
    setWidths((w) => {
      if (!(columnId in w)) return w;
      const next = { ...w };
      delete next[columnId];
      return next;
    });
    setHidden((h) => (h.includes(columnId) ? h.filter((id) => id !== columnId) : h));
    deleteColumnAction(folderId, columnId).then((res) => {
      if (!res.ok) {
        setColumns(prevCols);
        setRows(prevRows);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  function reorderColumns(orderedIds: string[]) {
    const prev = columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is FolderColumn => Boolean(c));
    if (next.length !== columns.length) return;
    setColumns(next.map((c, i) => ({ ...c, position: i })));
    reorderColumnsAction(folderId, orderedIds).then((res) => {
      if (!res.ok) {
        setColumns(prev);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  function setColumnOptions(columnId: string, options: MultiSelectOption[]) {
    const prev = columns;
    setColumns((cs) => cs.map((c) => (c.id === columnId ? { ...c, options } : c)));
    updateColumnOptionsAction(folderId, columnId, options).then((res) => {
      if (!res.ok) {
        setColumns(prev);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  async function addRow(): Promise<string | null> {
    const res = await createNoteAction({ folderId });
    if (!res.ok) {
      toast.error(`Failed: ${res.error}`);
      return null;
    }
    setRows((rs) => [
      ...rs,
      {
        id: res.data.id,
        title: null,
        content_md: '',
        source: 'manual',
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        properties: {},
      },
    ]);
    return res.data.id;
  }

  function deleteRow(noteId: string) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== noteId));
    deleteNoteAction(noteId).then((res) => {
      if (!res.ok) {
        setRows(prev);
        toast.error(`Failed: ${res.error}`);
      }
    });
  }

  async function duplicateRow(noteId: string): Promise<void> {
    const src = rows.find((r) => r.id === noteId);
    if (!src) return;
    const res = await duplicateNoteAction(noteId);
    if (!res.ok) {
      toast.error(`Failed: ${res.error}`);
      return;
    }
    const copy: FolderRowData = {
      ...src,
      id: res.data.id,
      title: src.title ? `${src.title} (copy)` : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      properties: { ...src.properties },
    };
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === noteId);
      return i === -1 ? [...rs, copy] : [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)];
    });
  }

  const value: FolderTableCtx = {
    folderId,
    columns,
    visibleColumns,
    rows,
    visibleRows,
    sort,
    filters,
    setCell,
    setTitle,
    addColumn,
    renameColumn,
    retypeColumn,
    deleteColumn,
    reorderColumns,
    setColumnOptions,
    addRow,
    deleteRow,
    duplicateRow,
    setSort,
    clearSort,
    setColumnFilter,
    removeFilter,
    clearView,
    hidden,
    hideColumn,
    showColumn,
    widths,
    setColumnWidth,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
