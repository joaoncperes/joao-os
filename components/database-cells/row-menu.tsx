'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Per-row actions (duplicate / delete), shown on row hover. Shared by both table
// surfaces; the caller decides what duplicate/delete mean (and whether to confirm).
export function RowMenu({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Row actions"
        className={cn(
          'text-text-4 hover:text-text hover:bg-surface-2 flex h-full w-full items-center justify-center transition-opacity',
          open ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4}>
          <Popover.Popup className="bg-surface border-border data-ending-style:opacity-0 data-starting-style:opacity-0 z-50 w-[160px] rounded-xl border p-1 shadow-lg transition-opacity">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
              className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-500 hover:bg-surface-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
