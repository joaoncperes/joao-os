'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorSwatchGrid } from '@/components/color-swatch-grid';
import { swatchClass } from '@/lib/second-brain/column-display';
import {
  createBookCategory,
  deleteBookCategory,
  renameBookCategory,
  setBookCategoryColor,
} from '@/app/(app)/books/actions';
import type { BookCategory, ChipColor } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

// Rename / recolor / delete / add the book category vocabulary. Rendered
// inline inside the book form dialog (Base UI has no nested-popover story
// worth the trouble here, and the panel is short).
//
// Every mutation round-trips to the server before the list refreshes — the
// rename and delete paths cascade across book rows, so optimistic UI would
// risk showing a state the DB never reached.
export function ManageBookCategories({
  categories,
  counts,
  onChanged,
  onClose,
}: {
  categories: BookCategory[];
  counts: Record<string, number>;
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Something went wrong.');
        return;
      }
      toast.success(success);
      await onChanged();
    });
  }

  function commitRename(cat: BookCategory) {
    const clean = draftName.trim();
    setEditingId(null);
    if (!clean || clean === cat.name) return;

    const used = counts[cat.name] ?? 0;
    const collides = categories.some(
      (c) => c.id !== cat.id && c.name.toLowerCase() === clean.toLowerCase(),
    );
    if (collides) {
      const ok = confirm(
        `"${clean}" already exists. Merge "${cat.name}" into it? ` +
          `${used} ${used === 1 ? 'book' : 'books'} will be retagged.`,
      );
      if (!ok) return;
    }
    run(() => renameBookCategory(cat.id, clean), `Renamed to "${clean}".`);
  }

  function remove(cat: BookCategory) {
    const used = counts[cat.name] ?? 0;
    const warning = used
      ? `Remove "${cat.name}" from ${used} ${used === 1 ? 'book' : 'books'}? This can't be undone.`
      : `Delete "${cat.name}"?`;
    if (!confirm(warning)) return;
    run(() => deleteBookCategory(cat.id), `Deleted "${cat.name}".`);
  }

  function add() {
    const clean = newName.trim();
    if (!clean) return;
    setNewName('');
    run(() => createBookCategory(clean), `Added "${clean}".`);
  }

  return (
    <div className="border-border bg-surface-2 flex flex-col gap-1 rounded-lg border p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-text-2 text-[11px] font-semibold tracking-wide uppercase">
          Manage categories
        </span>
        <div className="flex items-center gap-1">
          {pending ? (
            <Loader2 className="text-text-2 h-3.5 w-3.5 animate-spin" />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="text-text-2 hover:text-text rounded p-0.5"
            aria-label="Close category manager"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {categories.map((cat) => {
        const used = counts[cat.name] ?? 0;
        return (
          <div key={cat.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setColorFor((p) => (p === cat.id ? null : cat.id))}
                className={cn(
                  'h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-110',
                  swatchClass(cat.color),
                )}
                aria-label={`Change color for ${cat.name}`}
                disabled={pending}
              />

              {editingId === cat.id ? (
                <Input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(cat)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(cat);
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-7 text-[13px]"
                  disabled={pending}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(cat.id);
                    setDraftName(cat.name);
                  }}
                  className="text-text hover:bg-surface flex-1 truncate rounded px-1 py-0.5 text-left text-[13px]"
                  disabled={pending}
                >
                  {cat.name}
                </button>
              )}

              <span className="text-text-2 shrink-0 text-[11px] tabular-nums">
                {used}
              </span>
              <button
                type="button"
                onClick={() => remove(cat)}
                className="text-text-2 shrink-0 rounded p-1 hover:text-red-500"
                aria-label={`Delete ${cat.name}`}
                disabled={pending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {colorFor === cat.id ? (
              <div className="pb-1 pl-5">
                <ColorSwatchGrid
                  value={cat.color}
                  onChange={(color: ChipColor) => {
                    setColorFor(null);
                    run(() => setBookCategoryColor(cat.id, color), 'Color updated.');
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category…"
          className="h-7 text-[13px]"
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={add}
          disabled={pending || !newName.trim()}
          aria-label="Add category"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
