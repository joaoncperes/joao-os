'use client';

import { NotesEditor } from '@/components/notes-editor';
import type { TipTapDoc } from '@/lib/supabase/types';

const cell = (text: string, width: number | null = null, type = 'tableCell') => ({
  type, attrs: { colspan: 1, rowspan: 1, colwidth: width ? [width] : null },
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
const table = (widths: (number | null)[]) => ({
  type: 'table', content: [
    { type: 'tableRow', content: widths.map((w, i) => cell(['', 'Good Habits', 'Bad Habits', 'Examples', 'Notes'][i], w, 'tableHeader')) },
    ...['Cue', 'Craving', 'Response', 'Reward'].map((label) => ({
      type: 'tableRow', content: widths.map((w, i) => cell(i === 0 ? label : 'Make it obvious. Build better habits every day.', w)),
    })),
  ],
});
const content = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The Habit Loop and 4 Steps to Build Better Habits' }] },
  table([300, null, null]),
  table([300, 25, 25]),
  table([null, null, null, null, null]),
  table([180]),
  { type: 'table', content: [
    { type: 'tableRow', content: [{ ...cell('Merged header'), attrs: { colspan: 2, rowspan: 1, colwidth: null } }] },
    { type: 'tableRow', content: [cell('https://example.test/' + 'longurl'.repeat(25)), cell('Regular text')] },
  ] },
  { type: 'databaseTable', attrs: {
    id: 'mobile-qa', columns: [{ id: 'name', name: 'Name', type: 'text', options: [] }, { id: 'notes', name: 'Notes', type: 'text', options: [] }],
    rows: [{ id: 'row', cells: { name: 'Fixture', notes: 'Database table' } }],
  } },
] } as TipTapDoc;

export default function TableMobileQA() {
  return <main className="mx-auto w-full max-w-[1100px] px-4 py-6 lg:px-14">
    <NotesEditor initialContent={content} onSave={async () => ({ ok: true })} onUploadImage={async () => ({ ok: false, error: 'Fixture' })} />
  </main>;
}
