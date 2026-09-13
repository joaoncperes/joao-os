'use client';

import { Popover } from '@base-ui/react/popover';
import { OptionChip } from '@/components/option-chip';
import type { MultiSelectOption } from '@/lib/supabase/types';
import { DbOptionPicker } from './option-picker';

const MAX_VISIBLE = 6;

// Display = colored chips for the selected options; tap opens the picker. Stale
// ids (option deleted from the column) simply don't resolve → skipped. The
// popover renders through a Portal, escaping the contentEditable=false subtree.
export function DbMultiSelectCell({
  options,
  value,
  onChange,
  onOptionsChange,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  onOptionsChange: (next: MultiSelectOption[]) => void;
}) {
  const selected = options.filter((o) => value.includes(o.id));
  const visible = selected.slice(0, MAX_VISIBLE);
  const overflow = selected.length - visible.length;

  return (
    <Popover.Root>
      <Popover.Trigger className="flex min-h-[34px] w-full flex-wrap items-center gap-1 px-2.5 py-1.5 text-left">
        {selected.length > 0 ? (
          <>
            {visible.map((o) => (
              <OptionChip key={o.id} label={o.name} color={o.color} size="sm" />
            ))}
            {overflow > 0 ? (
              <span className="bg-surface-2 text-text-3 rounded-md px-1.5 py-0.5 text-[11px]">
                +{overflow}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-text-4 text-[13px]">—</span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className="bg-surface border-border data-ending-style:opacity-0 data-starting-style:opacity-0 z-50 w-[240px] rounded-xl border p-2 shadow-lg transition-opacity">
            <DbOptionPicker
              options={options}
              value={value}
              onChange={onChange}
              onOptionsChange={onOptionsChange}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
