'use client';

import type { FolderColumn } from '@/lib/supabase/types';
import type { TableViewConfig } from '@/lib/second-brain/table-view';
import { SortFilterBar } from '@/components/database-cells/sort-filter-ui';
import { HiddenColumnsControl } from '@/components/database-cells/hidden-columns-control';
import type { FolderRowData } from './types';
import { FolderTableProvider, NAME_COLUMN_ID, useFolderTable } from './use-folder-table';
import { TableHeaderRow } from './table-header-row';
import { TableRow } from './table-row';
import { NewRowButton } from './new-row-button';

function TableBody() {
  const {
    columns,
    rows,
    visibleRows,
    sort,
    filters,
    clearSort,
    removeFilter,
    clearView,
    hidden,
    showColumn,
    visibleColumns,
    widths,
  } = useFolderTable();

  // The bar resolves names/options for the active sort + filters; include the
  // synthetic Name column so a sort/filter on it renders a proper chip.
  const barColumns = [
    { id: NAME_COLUMN_ID, name: 'Name', type: 'text' as const, options: [] },
    ...columns.map((c) => ({ id: c.id, name: c.name, type: c.type, options: c.options })),
  ];

  return (
    <>
      <SortFilterBar
        columns={barColumns}
        sort={sort}
        filters={filters}
        shown={visibleRows.length}
        total={rows.length}
        onClearSort={clearSort}
        onRemoveFilter={removeFilter}
        onClearAll={clearView}
      />
      {hidden.length > 0 ? (
        <div className="px-0.5 pb-2">
          <HiddenColumnsControl columns={columns} hidden={hidden} onShow={showColumn} />
        </div>
      ) : null}
      {/* One horizontal scroll container; the rounded border frames the viewport
          so the sticky Name column stays pinned to its left edge. Edge-to-edge on
          mobile, framed on sm+. */}
      <div className="bg-surface border-border -mx-4 overflow-x-auto border-y sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-max min-w-full border-collapse">
          <colgroup>
            <col style={widths[NAME_COLUMN_ID] ? { width: widths[NAME_COLUMN_ID] } : undefined} />
            {visibleColumns.map((c) => (
              <col key={c.id} style={widths[c.id] ? { width: widths[c.id] } : undefined} />
            ))}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <TableHeaderRow />
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <TableRow key={r.id} row={r} />
            ))}
            <NewRowButton />
          </tbody>
        </table>
      </div>
    </>
  );
}

export function FolderTable({
  folderId,
  columns,
  rows,
  initialView,
}: {
  folderId: string;
  columns: FolderColumn[];
  rows: FolderRowData[];
  initialView?: TableViewConfig;
}) {
  return (
    <FolderTableProvider
      folderId={folderId}
      initialColumns={columns}
      initialRows={rows}
      initialView={initialView}
    >
      <TableBody />
    </FolderTableProvider>
  );
}
