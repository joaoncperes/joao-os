'use client';

import { Plus } from 'lucide-react';
import { useFolderTable } from './use-folder-table';

export function NewRowButton() {
  const { visibleColumns, addRow } = useFolderTable();
  return (
    <tr>
      <td colSpan={visibleColumns.length + 2} className="border-border border-b p-0">
        <button
          type="button"
          onClick={() => {
            void addRow();
          }}
          className="text-text-3 hover:text-text hover:bg-surface-2 sticky left-0 flex items-center gap-1.5 px-2.5 py-2 text-left text-[13px] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </td>
    </tr>
  );
}
