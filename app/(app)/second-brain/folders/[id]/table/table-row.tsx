'use client';

import { cn } from '@/lib/utils';
import { CellDispatch } from '@/components/database-cells/cell-dispatch';
import { RowMenu } from '@/components/database-cells/row-menu';
import { CELL_BASE, COL_MIN, NAME_MIN, NAME_STICKY } from './table-tokens';
import { NameCell } from './name-cell';
import { useFolderTable } from './use-folder-table';
import type { FolderRowData } from './types';

export function TableRow({ row }: { row: FolderRowData }) {
  const { visibleColumns, setCell, setColumnOptions, deleteRow, duplicateRow } = useFolderTable();
  return (
    <tr className="group/row">
      <td className={cn(CELL_BASE, NAME_MIN, NAME_STICKY, 'p-0')}>
        <NameCell row={row} />
      </td>
      {visibleColumns.map((c) => (
        <td key={c.id} className={cn(CELL_BASE, COL_MIN, 'p-0')}>
          <CellDispatch
            column={c}
            value={row.properties[c.id]}
            onChange={(v) => setCell(row.id, c.id, v)}
            onColumnOptionsChange={(opts) => setColumnOptions(c.id, opts)}
          />
        </td>
      ))}
      <td className={cn(CELL_BASE, 'min-w-[40px] p-0')}>
        <RowMenu
          onDuplicate={() => void duplicateRow(row.id)}
          onDelete={() => {
            if (window.confirm('Delete this row? The note will be permanently removed.')) {
              deleteRow(row.id);
            }
          }}
        />
      </td>
    </tr>
  );
}
