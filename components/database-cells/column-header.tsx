'use client';

import { useState, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Filter,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLUMN_TYPE_META, COLUMN_TYPE_ORDER } from '@/lib/second-brain/column-display';
import type { ColumnType, MultiSelectOption } from '@/lib/supabase/types';
import type { DbColumn } from '@/lib/tiptap-database-table';
import type { FilterSpec, SortDirection, SortSpec } from '@/lib/second-brain/table-view';
import { DbManageOptions } from './manage-options';
import { FilterEditor } from './sort-filter-ui';
import { ColumnResizeHandle } from './column-resize-handle';

function MenuItem({
  onClick,
  icon,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40',
        danger ? 'text-red-500 hover:bg-surface-2' : 'text-text hover:bg-surface-2',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// A row of the column types — used both to set a new column's type and to retype
// an existing one.
function TypeRow({
  active,
  onPick,
}: {
  active?: ColumnType;
  onPick: (type: ColumnType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {COLUMN_TYPE_ORDER.map((t) => {
        const Icon = COLUMN_TYPE_META[t].icon;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className={cn(
              'flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px]',
              active === t ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-surface-2',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {COLUMN_TYPE_META[t].label}
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return <div className="border-border my-1 border-t" />;
}

// The unified column header for BOTH table surfaces (the in-editor databaseTable
// node and the folder-as-database table). One click anywhere on the header opens
// a single discoverable menu: rename (the field at the top), change type, sort,
// filter, multi-select options, move, and a clearly-separated Delete — so the
// "how do I delete a column?" trap is gone.
//
// `variant='name'` renders the folder's implicit, sticky "Name" column (the note
// title): sort + filter only, no schema edits (it can't be renamed/retyped/
// deleted/moved here). The mutation callbacks are optional so that variant can
// omit them.
export function ColumnHeader({
  column,
  index,
  total,
  sort,
  filter,
  variant = 'column',
  onRename,
  onRetype,
  onMove,
  onDelete,
  onHide,
  onOptionsChange,
  width,
  onResize,
  onSort,
  onClearSort,
  onFilter,
}: {
  column: DbColumn;
  index: number;
  total: number;
  sort: SortSpec | null;
  filter: FilterSpec | undefined;
  variant?: 'column' | 'name';
  onRename?: (name: string) => void;
  onRetype?: (type: ColumnType) => void;
  onMove?: (dir: -1 | 1) => void;
  onDelete?: () => void;
  onHide?: () => void;
  onOptionsChange?: (options: MultiSelectOption[]) => void;
  width?: number;
  onResize?: (px: number) => void;
  onSort: (direction: SortDirection) => void;
  onClearSort: () => void;
  onFilter: (next: FilterSpec | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const Icon = COLUMN_TYPE_META[column.type].icon;
  const sortDir = sort?.columnId === column.id ? sort.direction : null;
  const isName = variant === 'name';

  function commitRename() {
    const t = draft.trim();
    if (t && t !== column.name) onRename?.(t);
  }

  function remove() {
    setOpen(false);
    if (!window.confirm(`Delete the “${column.name}” column? Its values will be lost.`)) return;
    onDelete?.();
  }

  return (
    <div className="relative flex items-stretch">
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(column.name);
        if (!o) {
          setManaging(false);
          setFiltering(false);
        }
      }}
    >
      <Popover.Trigger
        className="group/col text-text-2 hover:bg-surface-2 flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors"
        aria-label={`${column.name} column options`}
      >
        <Icon className="text-text-4 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{column.name}</span>
        {sortDir ? (
          sortDir === 'asc' ? (
            <ArrowUp className="text-accent h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="text-accent h-3 w-3 shrink-0" />
          )
        ) : null}
        {filter ? <Filter className="text-accent h-3 w-3 shrink-0" /> : null}
        <ChevronDown className="text-text-4 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/col:opacity-100" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align={isName ? 'start' : 'end'} sideOffset={6}>
          <Popover.Popup className="bg-surface border-border data-ending-style:opacity-0 data-starting-style:opacity-0 z-50 w-[230px] rounded-xl border p-1.5 shadow-lg transition-opacity">
            {filtering ? (
              <FilterEditor column={column} filter={filter} onChange={onFilter} />
            ) : managing ? (
              <DbManageOptions options={column.options} onChange={(o) => onOptionsChange?.(o)} />
            ) : (
              <div className="flex flex-col">
                {!isName ? (
                  <>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename();
                          setOpen(false);
                        }
                        if (e.key === 'Escape') {
                          setDraft(column.name);
                          setOpen(false);
                        }
                      }}
                      placeholder="Column name"
                      className="bg-surface-2 text-text placeholder:text-text-4 mb-1 rounded-md px-2 py-1.5 text-[13px] font-medium outline-none"
                    />
                    <div className="px-1 pb-1">
                      <TypeRow active={column.type} onPick={(t) => onRetype?.(t)} />
                    </div>
                    <Divider />
                  </>
                ) : null}

                <MenuItem
                  onClick={() => {
                    onSort('asc');
                    setOpen(false);
                  }}
                  icon={<ArrowUp className={cn('h-3.5 w-3.5', sortDir === 'asc' && 'text-accent')} />}
                >
                  Sort ascending
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    onSort('desc');
                    setOpen(false);
                  }}
                  icon={
                    <ArrowDown className={cn('h-3.5 w-3.5', sortDir === 'desc' && 'text-accent')} />
                  }
                >
                  Sort descending
                </MenuItem>
                {sortDir ? (
                  <MenuItem
                    onClick={() => {
                      onClearSort();
                      setOpen(false);
                    }}
                    icon={<ArrowUpDown className="h-3.5 w-3.5" />}
                  >
                    Clear sort
                  </MenuItem>
                ) : null}
                <MenuItem
                  onClick={() => setFiltering(true)}
                  icon={<Filter className={cn('h-3.5 w-3.5', filter && 'text-accent')} />}
                >
                  {filter ? 'Edit filter' : 'Filter…'}
                </MenuItem>

                {!isName && column.type === 'multi_select' ? (
                  <MenuItem onClick={() => setManaging(true)} icon={<Tags className="h-3.5 w-3.5" />}>
                    Edit options
                  </MenuItem>
                ) : null}

                {!isName ? (
                  <>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        onMove?.(-1);
                        setOpen(false);
                      }}
                      disabled={index === 0}
                      icon={<ChevronLeft className="h-3.5 w-3.5" />}
                    >
                      Move left
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        onMove?.(1);
                        setOpen(false);
                      }}
                      disabled={index === total - 1}
                      icon={<ChevronRight className="h-3.5 w-3.5" />}
                    >
                      Move right
                    </MenuItem>
                    {onHide ? (
                      <MenuItem
                        onClick={() => {
                          onHide();
                          setOpen(false);
                        }}
                        icon={<EyeOff className="h-3.5 w-3.5" />}
                      >
                        Hide column
                      </MenuItem>
                    ) : null}
                    <Divider />
                    <MenuItem onClick={remove} danger icon={<Trash2 className="h-3.5 w-3.5" />}>
                      Delete column
                    </MenuItem>
                  </>
                ) : null}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
      {onResize ? <ColumnResizeHandle width={width} onResize={onResize} /> : null}
    </div>
  );
}

export function AddColumnButton({ onAdd }: { onAdd: (name: string, type: ColumnType) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');

  function add() {
    onAdd(name.trim() || 'Column', type);
    setName('');
    setType('text');
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="text-text-3 hover:text-text hover:bg-surface-2 flex h-9 w-10 items-center justify-center"
        aria-label="Add column"
      >
        <Plus className="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6}>
          <Popover.Popup className="bg-surface border-border data-ending-style:opacity-0 data-starting-style:opacity-0 z-50 w-[230px] rounded-xl border p-2 shadow-lg transition-opacity">
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="Column name…"
                className="bg-surface-2 text-text placeholder:text-text-4 rounded-md px-2 py-1.5 text-[13px] outline-none"
              />
              <TypeRow active={type} onPick={setType} />
              <button
                type="button"
                onClick={add}
                className="bg-accent text-accent-foreground rounded-md px-2 py-1.5 text-[13px] font-medium"
              >
                Add column
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
