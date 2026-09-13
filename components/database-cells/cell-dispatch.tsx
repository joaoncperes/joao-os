'use client';

import type { MultiSelectOption, PropertyValue } from '@/lib/supabase/types';
import type { DbColumn } from '@/lib/tiptap-database-table';
import { DbTextCell } from './text-cell';
import { DbDateCell } from './date-cell';
import { DbUrlCell } from './url-cell';
import { DbMultiSelectCell } from './multi-select-cell';
import { DbCheckboxCell } from './checkbox-cell';

// Dispatches a cell to the right editor by column type. `value` is this row's
// raw value for the column (undefined = empty cell). onChange writes back to the
// node attrs (owned by the NodeView); onColumnOptionsChange updates the column's
// multi-select options.
export function CellDispatch({
  column,
  value,
  onChange,
  onColumnOptionsChange,
}: {
  column: DbColumn;
  value: PropertyValue | undefined;
  onChange: (next: PropertyValue | null) => void;
  onColumnOptionsChange: (next: MultiSelectOption[]) => void;
}) {
  switch (column.type) {
    case 'multi_select':
      return (
        <DbMultiSelectCell
          options={column.options}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v)}
          onOptionsChange={onColumnOptionsChange}
        />
      );
    case 'date':
      return (
        <DbDateCell value={typeof value === 'string' ? value : ''} onChange={(v) => onChange(v)} />
      );
    case 'url':
      return (
        <DbUrlCell value={typeof value === 'string' ? value : ''} onChange={(v) => onChange(v)} />
      );
    case 'checkbox':
      return (
        <DbCheckboxCell
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return (
        <DbTextCell value={typeof value === 'string' ? value : ''} onChange={(v) => onChange(v)} />
      );
  }
}
