'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorSwatchGrid } from '@/components/color-swatch-grid';
import { nextDefaultColor, swatchClass } from '@/lib/second-brain/column-display';
import type { ChipColor, MultiSelectOption } from '@/lib/supabase/types';

// Rename / recolor / delete / add the options of a multi-select column. Every
// edit sends the whole options array through onChange. Prop-driven and shared by
// both table surfaces.
export function DbManageOptions({
  options,
  onChange,
}: {
  options: MultiSelectOption[];
  onChange: (next: MultiSelectOption[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);

  function rename(id: string, name: string) {
    onChange(options.map((o) => (o.id === id ? { ...o, name } : o)));
  }
  function recolor(id: string, color: ChipColor) {
    onChange(options.map((o) => (o.id === id ? { ...o, color } : o)));
  }
  function remove(id: string) {
    onChange(options.filter((o) => o.id !== id));
  }
  function add() {
    const name = newName.trim();
    if (!name) return;
    onChange([...options, { id: crypto.randomUUID(), name, color: nextDefaultColor(options.length) }]);
    setNewName('');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-text-3 px-1 text-[10px] font-semibold tracking-[0.06em] uppercase">
        Options
      </div>
      <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
        {options.map((o) => (
          <div key={o.id} className="flex flex-col gap-1 rounded-md px-1 py-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setColorFor(colorFor === o.id ? null : o.id)}
                className={cn('h-4 w-4 shrink-0 rounded-full', swatchClass(o.color))}
                aria-label="Color"
              />
              <input
                value={o.name}
                onChange={(e) => rename(o.id, e.target.value)}
                className="text-text min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
              <button
                type="button"
                onClick={() => remove(o.id)}
                className="text-text-4 shrink-0 hover:text-red-500"
                aria-label="Delete option"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {colorFor === o.id ? (
              <div className="px-1 pb-1">
                <ColorSwatchGrid
                  value={o.color}
                  onChange={(c) => {
                    recolor(o.id, c);
                    setColorFor(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="New option…"
          className="bg-surface-2 text-text placeholder:text-text-4 min-w-0 flex-1 rounded-md px-2 py-1 text-[13px] outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="text-text-3 hover:text-text shrink-0 rounded-md p-1"
          aria-label="Add option"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
