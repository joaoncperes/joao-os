'use client';

import { useState } from 'react';
import { formatReadingDate } from '@/lib/books-display';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Display = PT-formatted date; edit = inline native date input (opens the
// browser/iOS picker). A bare 'YYYY-MM-DD' calendar value, never run through
// timezone math. Prop-driven and shared by both table surfaces.
export function DbDateCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        type="date"
        defaultValue={value}
        autoFocus
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || ISO_DATE_RE.test(v)) onChange(v);
        }}
        onBlur={() => setEditing(false)}
        className="text-text w-full bg-transparent px-2.5 py-1.5 text-[13px] tabular-nums outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block min-h-[34px] w-full px-2.5 py-1.5 text-left text-[13px]"
    >
      {value ? (
        <span className="text-text tabular-nums">{formatReadingDate(value)}</span>
      ) : (
        <span className="text-text-4">—</span>
      )}
    </button>
  );
}
