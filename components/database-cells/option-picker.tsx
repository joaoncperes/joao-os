'use client';

import { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { OptionChip } from '@/components/option-chip';
import { nextDefaultColor } from '@/lib/second-brain/column-display';
import type { MultiSelectOption } from '@/lib/supabase/types';

// Body of a multi-select cell popover: search, toggle options on/off, and
// create a new option (auto color) which is added to the column AND selected.
// Prop-driven and shared by both table surfaces.
export function DbOptionPicker({
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
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(q)),
    [options, q],
  );
  const exact = options.some((o) => o.name.toLowerCase() === q);

  function toggle(id: string) {
    const next = selected.has(id) ? value.filter((v) => v !== id) : [...value, id];
    onChange(next);
  }

  function create() {
    const name = query.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const color = nextDefaultColor(options.length);
    onOptionsChange([...options, { id, name, color }]);
    onChange([...value, id]);
    setQuery('');
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim() && !exact) {
            e.preventDefault();
            create();
          }
        }}
        placeholder="Search or create…"
        className="bg-surface-2 text-text placeholder:text-text-4 rounded-md px-2 py-1.5 text-[13px] outline-none"
      />
      <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
        {filtered.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className="hover:bg-surface-2 flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
          >
            <OptionChip label={o.name} color={o.color} size="sm" />
            {selected.has(o.id) ? <Check className="text-accent h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        ))}
        {query.trim() && !exact ? (
          <button
            type="button"
            onClick={create}
            className="hover:bg-surface-2 text-text-2 flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[12.5px]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create “{query.trim()}”
          </button>
        ) : null}
        {options.length === 0 && !query.trim() ? (
          <span className="text-text-4 px-1.5 py-2 text-[12px]">No options yet. Type to create.</span>
        ) : null}
      </div>
    </div>
  );
}
