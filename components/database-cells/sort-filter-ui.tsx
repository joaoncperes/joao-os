'use client';

// Shared sort/filter UI for both table systems (in-editor databaseTable node and
// the folder-as-database table). Two pieces:
//   - FilterEditor: the per-column filter sub-view, dropped into either column
//     menu (same slot the multi-select "manage options" sub-view uses).
//   - SortFilterBar: the status strip above a table — active sort + filter chips,
//     a visible/total count, and a one-click reset. Filters hide rows, so this
//     bar is the discoverability + escape hatch.

import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionChip } from '@/components/option-chip';
import { formatReadingDate } from '@/lib/books-display';
import {
  OPERATOR_LABEL,
  operatorIsUnary,
  operatorsForType,
  type FilterOperator,
  type FilterSpec,
  type SortSpec,
} from '@/lib/second-brain/table-view';
import type { ColumnType, MultiSelectOption } from '@/lib/supabase/types';

export interface EditorColumn {
  id: string;
  name: string;
  type: ColumnType;
  options: MultiSelectOption[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── FilterEditor ──────────────────────────────────────────────────────────────

export function FilterEditor({
  column,
  filter,
  onChange,
}: {
  column: EditorColumn;
  filter: FilterSpec | undefined;
  onChange: (next: FilterSpec | null) => void;
}) {
  const ops = operatorsForType(column.type);
  const initialValue = filter?.value;
  const [op, setOp] = useState<FilterOperator>(
    filter && ops.includes(filter.operator) ? filter.operator : ops[0],
  );
  const [text, setText] = useState<string>(
    typeof initialValue === 'string' ? initialValue : '',
  );
  const [ids, setIds] = useState<string[]>(Array.isArray(initialValue) ? initialValue : []);

  // Emit a spec, or null when the chosen operator needs a value but has none yet
  // (an empty constraint clears the filter rather than matching everything).
  function push(nextOp: FilterOperator, nextText: string, nextIds: string[]) {
    if (operatorIsUnary(nextOp)) {
      onChange({ columnId: column.id, operator: nextOp });
      return;
    }
    if (column.type === 'multi_select') {
      if (nextIds.length === 0) return onChange(null);
      return onChange({ columnId: column.id, operator: nextOp, value: nextIds });
    }
    const v = nextText.trim();
    if (!v) return onChange(null);
    onChange({ columnId: column.id, operator: nextOp, value: v });
  }

  function pickOp(next: FilterOperator) {
    setOp(next);
    push(next, text, ids);
  }
  function setTextValue(v: string) {
    setText(v);
    push(op, v, ids);
  }
  function toggleId(id: string) {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    push(op, text, next);
  }
  function clear() {
    setText('');
    setIds([]);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="text-text-3 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.06em] uppercase">
        <Filter className="h-3 w-3" />
        Filter · {column.name}
      </div>

      <div className="flex flex-wrap gap-1 px-1">
        {ops.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => pickOp(o)}
            className={cn(
              'rounded-md px-1.5 py-1 text-[12px]',
              op === o ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-surface-2',
            )}
          >
            {OPERATOR_LABEL[o]}
          </button>
        ))}
      </div>

      {operatorIsUnary(op) ? null : column.type === 'multi_select' ? (
        <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto px-1">
          {column.options.length === 0 ? (
            <span className="text-text-4 px-1 py-1 text-[12px]">No options in this column.</span>
          ) : (
            column.options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleId(o.id)}
                className="hover:bg-surface-2 flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
              >
                <OptionChip label={o.name} color={o.color} size="sm" />
                {ids.includes(o.id) ? <Check className="text-accent h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            ))
          )}
        </div>
      ) : column.type === 'date' ? (
        <input
          type="date"
          value={ISO_DATE_RE.test(text) ? text : ''}
          autoFocus
          onChange={(e) => setTextValue(e.target.value)}
          className="bg-surface-2 text-text mx-1 rounded-md px-2 py-1.5 text-[13px] tabular-nums outline-none"
        />
      ) : (
        <input
          autoFocus
          value={text}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="value…"
          className="bg-surface-2 text-text placeholder:text-text-4 mx-1 rounded-md px-2 py-1.5 text-[13px] outline-none"
        />
      )}

      {filter ? (
        <button
          type="button"
          onClick={clear}
          className="text-text-3 hover:text-text mx-1 self-start rounded-md px-1 py-0.5 text-[12px]"
        >
          Clear filter
        </button>
      ) : null}
    </div>
  );
}

// ── SortFilterBar ─────────────────────────────────────────────────────────────

function summarize(filter: FilterSpec, column: EditorColumn | undefined): string {
  if (operatorIsUnary(filter.operator)) return OPERATOR_LABEL[filter.operator];
  if (column?.type === 'multi_select') {
    const ids = Array.isArray(filter.value) ? filter.value : [];
    const names = column.options.filter((o) => ids.includes(o.id)).map((o) => o.name);
    return `${OPERATOR_LABEL[filter.operator]} ${names.join(', ')}`.trim();
  }
  if (column?.type === 'date') {
    const v = typeof filter.value === 'string' ? filter.value : '';
    return `${OPERATOR_LABEL[filter.operator]} ${v ? formatReadingDate(v) : ''}`.trim();
  }
  const v = typeof filter.value === 'string' ? filter.value : '';
  return `${OPERATOR_LABEL[filter.operator]} “${v}”`;
}

function BarChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="bg-surface-2 text-text-2 inline-flex items-center gap-1 rounded-md py-1 pr-1 pl-2 text-[12px]">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="text-text-4 hover:text-text rounded p-0.5"
        aria-label="Remove"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function SortFilterBar({
  columns,
  sort,
  filters,
  shown,
  total,
  onClearSort,
  onRemoveFilter,
  onClearAll,
}: {
  columns: EditorColumn[];
  sort: SortSpec | null;
  filters: FilterSpec[];
  shown: number;
  total: number;
  onClearSort: () => void;
  onRemoveFilter: (columnId: string) => void;
  onClearAll: () => void;
}) {
  if (!sort && filters.length === 0) return null;
  const colById = (id: string) => columns.find((c) => c.id === id);

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-0.5 pb-2">
      <span className="text-text-4 text-[12px] tabular-nums">
        {shown === total ? `${total}` : `${shown} of ${total}`}
      </span>

      {sort && colById(sort.columnId) ? (
        <BarChip onRemove={onClearSort}>
          {sort.direction === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {colById(sort.columnId)?.name}
        </BarChip>
      ) : null}

      {filters.map((f) => {
        const col = colById(f.columnId);
        if (!col) return null;
        return (
          <BarChip key={f.columnId} onRemove={() => onRemoveFilter(f.columnId)}>
            <Filter className="h-3 w-3" />
            {col.name}: {summarize(f, col)}
          </BarChip>
        );
      })}

      <button
        type="button"
        onClick={onClearAll}
        className="text-text-3 hover:text-text rounded-md px-1.5 py-1 text-[12px]"
      >
        Clear all
      </button>
    </div>
  );
}
