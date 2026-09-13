'use client';

import { Popover } from '@base-ui/react/popover';
import { Eye, EyeOff } from 'lucide-react';
import { COLUMN_TYPE_META } from '@/lib/second-brain/column-display';
import type { DbColumn } from '@/lib/tiptap-database-table';

// "N hidden" control: lists the hidden columns; click one to restore it. Renders
// nothing when no columns are hidden. Shared by both table surfaces.
export function HiddenColumnsControl({
  columns,
  hidden,
  onShow,
}: {
  columns: DbColumn[];
  hidden: string[];
  onShow: (columnId: string) => void;
}) {
  const hiddenCols = columns.filter((c) => hidden.includes(c.id));
  if (hiddenCols.length === 0) return null;
  return (
    <Popover.Root>
      <Popover.Trigger className="text-text-3 hover:text-text hover:bg-surface-2 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px]">
        <EyeOff className="h-3 w-3" />
        {hiddenCols.length} hidden
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className="bg-surface border-border data-ending-style:opacity-0 data-starting-style:opacity-0 z-50 w-[220px] rounded-xl border p-1.5 shadow-lg transition-opacity">
            <div className="text-text-3 px-2 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase">
              Hidden columns
            </div>
            {hiddenCols.map((c) => {
              const Icon = COLUMN_TYPE_META[c.type].icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onShow(c.id)}
                  className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
                >
                  <Icon className="text-text-4 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <Eye className="text-text-4 h-3.5 w-3.5 shrink-0" />
                </button>
              );
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
