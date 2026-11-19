'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDatePt } from '@/lib/goals';
import { deleteReading, logReading } from '@/app/(app)/books/reading-actions';

export interface ReadingSessionRow {
  id: string;
  session_date: string;
  minutes: number;
  book_title: string | null;
}

interface Props {
  today: string;
  books: { id: string; title: string }[];
  recent: ReadingSessionRow[];
  weekMinutes: number;
  weekTarget: number | null;
}

const QUICK = [15, 30, 45, 60];

export function ReadingLogCard({ today, books, recent, weekMinutes, weekTarget }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState('');
  const [bookId, setBookId] = useState(books[0]?.id ?? '');

  function submit(value?: number) {
    const m = value ?? Number(minutes);
    if (!Number.isFinite(m) || m <= 0) {
      toast.error('Quantos minutos você leu?');
      return;
    }
    start(async () => {
      const r = await logReading({ date, minutes: m, bookId: bookId || null });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${Math.round(m)} min de leitura registrados`);
      setMinutes('');
      router.refresh();
    });
  }

  const pct = weekTarget ? Math.min(100, Math.round((weekMinutes / weekTarget) * 100)) : null;

  return (
    <section id="leitura" className="bg-surface border-border flex flex-col gap-4 rounded-xl border px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-accent-soft text-accent grid h-9 w-9 place-items-center rounded-lg">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <div className="text-text text-[15px] font-semibold">Registrar leitura</div>
            <div className="text-text-3 text-[12.5px]">
              Nesta semana: <span className="text-text font-semibold tabular-nums">{weekMinutes} min</span>
              {weekTarget ? ` de ${weekTarget} min` : ''}
            </div>
          </div>
        </div>
        {pct != null ? (
          <div className="bg-surface-2 mt-2 h-2 w-full overflow-hidden rounded-full sm:mt-3 sm:w-40">
            <div
              className={cn('h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-accent')}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <select
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          aria-label="Livro"
          className="border-border bg-surface text-text h-9 max-w-full rounded-lg border px-2.5 text-[13px] sm:max-w-[240px]"
        >
          <option value="">Sem livro específico</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data"
          className="border-border bg-surface text-text h-9 rounded-lg border px-2.5 text-[13px] tabular-nums"
        />
        <div className="border-border bg-surface inline-flex h-9 items-center rounded-lg border pr-2">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="1440"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="min"
            aria-label="Minutos"
            className="text-text w-16 border-none bg-transparent px-2 text-center text-[13px] font-semibold tabular-nums outline-none"
          />
          <span className="text-text-4 text-[11px] font-medium">min</span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-accent inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar
        </button>
        <div className="flex gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={pending}
              onClick={() => submit(q)}
              className="bg-surface-2 text-text-2 hover:text-text h-9 rounded-lg px-2.5 text-[12px] font-semibold disabled:opacity-50"
            >
              +{q}
            </button>
          ))}
        </div>
      </form>

      {recent.length > 0 ? (
        <ul className="divide-border border-border divide-y border-t">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-[13px]">
              <span className="text-text-3 w-24 shrink-0 tabular-nums">{formatDatePt(r.session_date)}</span>
              <span className="text-text min-w-0 flex-1 truncate">{r.book_title ?? 'Leitura'}</span>
              <span className="text-text font-semibold tabular-nums">{r.minutes} min</span>
              <button
                type="button"
                aria-label="Apagar registro"
                onClick={() => {
                  if (!confirm('Apagar este registro de leitura?')) return;
                  start(async () => {
                    const res = await deleteReading(r.id);
                    if (!res.ok) toast.error(res.error);
                    else router.refresh();
                  });
                }}
                className="text-text-4 hover:text-danger hover:bg-danger-soft grid h-7 w-7 place-items-center rounded-md"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
