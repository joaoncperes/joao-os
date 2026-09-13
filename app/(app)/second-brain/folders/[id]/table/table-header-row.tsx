'use client';

import { cn } from '@/lib/utils';
import { AddColumnButton, ColumnHeader } from '@/components/database-cells/column-header';
import { COL_MIN, HEAD_BASE, NAME_HEAD_STICKY, NAME_MIN } from './table-tokens';
import { NAME_COLUMN_ID, useFolderTable } from './use-folder-table';

// The folder's implicit "Name" column (note.title) is synthetic — feed it to the
// shared header as a text column in the sticky name variant (sort + filter only;
// it can't be renamed/retyped/deleted/moved/hidden here).
const NAME_COLUMN = { id: NAME_COLUMN_ID, name: 'Name', type: 'text' as const, options: [] };

export function TableHeaderRow() {
  const {
    columns,
    visibleColumns,
    sort,
    filters,
    renameColumn,
    retypeColumn,
    reorderColumns,
    deleteColumn,
    setColumnOptions,
    setSort,
    clearSort,
    setColumnFilter,
    addColumn,
    hideColumn,
    widths,
    setColumnWidth,
  } = useFolderTable();

  // Move a visible column one slot left/right past any hidden ones — operate in
  // the full folder_columns id space so the persisted order stays correct.
  function move(colId: string, dir: -1 | 1) {
    const visIds = visibleColumns.map((c) => c.id);
    const target = visIds[visIds.indexOf(colId) + dir];
    if (!target) return;
    const ids = columns.map((c) => c.id);
    const a = ids.indexOf(colId);
    const b = ids.indexOf(target);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    reorderColumns(ids);
  }

  return (
    <tr>
      <th className={cn(HEAD_BASE, NAME_MIN, NAME_HEAD_STICKY)}>
        <ColumnHeader
          column={NAME_COLUMN}
          index={0}
          total={visibleColumns.length}
          variant="name"
          sort={sort}
          filter={filters.find((f) => f.columnId === NAME_COLUMN_ID)}
          width={widths[NAME_COLUMN_ID]}
          onResize={(px) => setColumnWidth(NAME_COLUMN_ID, px)}
          onSort={(dir) => setSort(NAME_COLUMN_ID, dir)}
          onClearSort={clearSort}
          onFilter={(next) => setColumnFilter(NAME_COLUMN_ID, next)}
        />
      </th>
      {visibleColumns.map((c, i) => (
        <th key={c.id} className={cn(HEAD_BASE, COL_MIN)}>
          <ColumnHeader
            column={c}
            index={i}
            total={visibleColumns.length}
            sort={sort}
            filter={filters.find((f) => f.columnId === c.id)}
            onRename={(name) => renameColumn(c.id, name)}
            onRetype={(t) => retypeColumn(c.id, t)}
            onMove={(dir) => move(c.id, dir)}
            onDelete={() => deleteColumn(c.id)}
            onHide={() => hideColumn(c.id)}
            onOptionsChange={(opts) => setColumnOptions(c.id, opts)}
            width={widths[c.id]}
            onResize={(px) => setColumnWidth(c.id, px)}
            onSort={(dir) => setSort(c.id, dir)}
            onClearSort={clearSort}
            onFilter={(next) => setColumnFilter(c.id, next)}
          />
        </th>
      ))}
      <th className={cn(HEAD_BASE, 'w-10 min-w-[40px] p-0')}>
        <AddColumnButton onAdd={(name, type) => void addColumn(name, type)} />
      </th>
    </tr>
  );
}
