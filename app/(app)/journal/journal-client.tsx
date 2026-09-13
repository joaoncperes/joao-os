'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { addDays } from '@/lib/date';
import { SaveBar, type SaveStatus } from '@/components/ui/save-bar';
import { SectionHeader } from '@/components/ui/section-header';
import { ScorePips } from '@/components/ui/score-pips';
import { saveJournal } from './actions';

export interface JournalRow {
  id?: string;
  journal_date: string;
  win: string | null;
  learned: string | null;
  would_do_differently: string | null;
  one_for_tomorrow: string | null;
  area_pro_score: number | null;
  area_health_score: number | null;
  area_family_score: number | null;
  area_marriage_score: number | null;
  gratitude: { lines?: string[] } | null;
  gabi_call_depth: number | null;
  gabi_call_topic: string | null;
  free_notes: string | null;
  is_partial?: boolean;
}

export interface PastRow {
  id: string;
  journal_date: string;
  win: string | null;
  area_pro_score: number | null;
  area_health_score: number | null;
  area_family_score: number | null;
  area_marriage_score: number | null;
  is_partial: boolean;
}

interface Props {
  viewDate: string;
  todayDate: string;
  isToday: boolean;
  entry: JournalRow | null;
  past: PastRow[];
  streak: number;
}

const TOTAL_FIELDS = 8;

export function JournalClient({ viewDate, todayDate, isToday, entry, past, streak }: Props) {
  const router = useRouter();
  const e = entry;
  const [win, setWin] = useState(e?.win ?? '');
  const [learned, setLearned] = useState(e?.learned ?? '');
  const [diff, setDiff] = useState(e?.would_do_differently ?? '');
  const [tom, setTom] = useState(e?.one_for_tomorrow ?? '');
  const [pro, setPro] = useState<number | null>(e?.area_pro_score ?? null);
  const [hea, setHea] = useState<number | null>(e?.area_health_score ?? null);
  const [fam, setFam] = useState<number | null>(e?.area_family_score ?? null);
  const [mar, setMar] = useState<number | null>(e?.area_marriage_score ?? null);
  const [gratitude, setGratitude] = useState((e?.gratitude?.lines ?? []).join('\n'));
  const [gabiDepth, setGabiDepth] = useState<number | null>(e?.gabi_call_depth ?? null);
  const [gabiTopic, setGabiTopic] = useState(e?.gabi_call_topic ?? '');
  const [freeNotes, setFreeNotes] = useState(e?.free_notes ?? '');
  const [entryDate, setEntryDate] = useState(viewDate);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const status: SaveStatus = pending ? 'saving' : dirty ? 'dirty' : saved ? 'saved' : 'idle';

  function dirtify<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
      setSaved(false);
    };
  }

  // Navigation discards an unsaved draft — confirm first (no autosave here).
  function guardedNavigate(href: string) {
    if (dirty && !confirm('Você tem alterações não salvas. Descartar?')) return;
    router.push(href);
  }

  function submit() {
    start(async () => {
      const r = await saveJournal(
        {
          win: win.trim() || null,
          learned: learned.trim() || null,
          would_do_differently: diff.trim() || null,
          one_for_tomorrow: tom.trim() || null,
          area_pro_score: pro,
          area_health_score: hea,
          area_family_score: fam,
          area_marriage_score: mar,
          gratitude: gratitude.trim() || null,
          gabi_call_depth: gabiDepth,
          gabi_call_topic: gabiTopic.trim() || null,
          free_notes: freeNotes.trim() || null,
        },
        entryDate,
        e?.journal_date ?? null,
      );
      if (r.ok) {
        setDirty(false);
        setSaved(true);
        toast.success('Journal saved');
        // If the entry landed on a different day, follow it there.
        if (entryDate !== viewDate) {
          router.replace(`/journal?date=${entryDate}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(r.error);
      }
    });
  }

  // Entry completion (X / 8) — count fields filled in.
  const filled = [
    win.trim(),
    learned.trim(),
    diff.trim(),
    tom.trim(),
    pro,
    hea,
    fam,
    mar,
  ].filter((v) => (typeof v === 'string' ? v.length > 0 : v != null)).length;

  // Header date strings
  const dateObj = parseISO(viewDate);
  const eyebrow = `${format(dateObj, 'd MMM yyyy')} · ${isToday ? 'End of day' : 'Editando'}`;
  const subtitle = format(dateObj, 'EEEE');

  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-md transition-colors';

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow={eyebrow}
        title="Journal"
        subtitle={subtitle}
        display
        action={
          <div className="bg-surface border-border flex items-center gap-3.5 rounded-lg border px-3.5 py-2.5">
            <div className="flex flex-col">
              <div className="text-text-3 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                Streak
              </div>
              <div className="text-text text-base font-semibold tabular-nums">{streak}</div>
            </div>
            <div className="bg-border h-7 w-px self-stretch" aria-hidden />
            <div className="flex flex-col">
              <div className="text-text-3 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                Entry
              </div>
              <div className="text-text text-base font-semibold tabular-nums">
                {filled}
                <span className="text-text-3 text-[12px] font-medium"> / {TOTAL_FIELDS}</span>
              </div>
            </div>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => guardedNavigate(`/journal?date=${addDays(viewDate, -1)}`)}
          aria-label="Dia anterior"
          className={cn(navBtn, 'text-text-3 hover:bg-surface-2 hover:text-text')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <label
            htmlFor="entry-date"
            className="text-text-3 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
          >
            Data da entrada
          </label>
          <input
            id="entry-date"
            type="date"
            value={entryDate}
            max={todayDate}
            onChange={(ev) => dirtify(setEntryDate)(ev.target.value)}
            aria-label="Data da entrada"
            className="border-border bg-surface text-text focus:border-accent rounded-lg border px-2.5 py-2 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
        </div>
        {isToday ? (
          <span
            aria-disabled="true"
            className={cn(navBtn, 'text-text-4 cursor-not-allowed opacity-40')}
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => guardedNavigate(`/journal?date=${addDays(viewDate, 1)}`)}
            aria-label="Próximo dia"
            className={cn(navBtn, 'text-text-3 hover:bg-surface-2 hover:text-text')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!isToday ? (
          <button
            type="button"
            onClick={() => guardedNavigate('/journal')}
            className="text-text-2 border-border hover:bg-surface-2 hover:text-text rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
          >
            Hoje
          </button>
        ) : null}
      </div>

      <PromptCard
        tag="Win"
        title="Win of the day"
        subtitle="One specific thing that went right."
        value={win}
        onChange={dirtify(setWin)}
      />
      <PromptCard
        tag="Learned"
        title="What I learned"
        subtitle="One sentence. &ldquo;Nothing today&rdquo; counts."
        value={learned}
        onChange={dirtify(setLearned)}
      />
      <PromptCard
        tag="Differently"
        title="What I would do differently"
        subtitle="A small course correction."
        value={diff}
        onChange={dirtify(setDiff)}
      />
      <PromptCard
        tag="Tomorrow"
        title="One thing for tomorrow"
        subtitle="The single most important. Becomes a task tomorrow."
        value={tom}
        onChange={dirtify(setTom)}
      />

      <div className="bg-surface border-border mb-3.5 rounded-xl border px-5 py-4">
        <div className="text-text mb-1 text-[14.5px] font-semibold">Area scores</div>
        <p className="text-text-3 mb-3 text-[13px]">How did each area feel today?</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <ScorePips label="Professional" value={pro} onChange={dirtify(setPro)} />
          <ScorePips label="Health" value={hea} onChange={dirtify(setHea)} />
          <ScorePips label="Family" value={fam} onChange={dirtify(setFam)} />
          <ScorePips label="Marriage" value={mar} onChange={dirtify(setMar)} />
        </div>
      </div>

      <details className="bg-surface border-border group/details mb-3.5 overflow-hidden rounded-xl border">
        <summary className="text-text-2 flex cursor-pointer select-none list-none items-center gap-2.5 px-5 py-3.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/details:rotate-90" />
          Optional: gratitude, Partner call, free notes
        </summary>
        <div className="border-border flex flex-col gap-4 border-t px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-2 text-[12.5px] font-semibold">
              Gratitude
              <span className="text-text-3 ml-2 font-normal">(one per line)</span>
            </label>
            <textarea
              value={gratitude}
              onChange={(ev) => dirtify(setGratitude)(ev.target.value)}
              rows={3}
              className="border-border focus:border-accent text-text placeholder:text-text-4 w-full resize-y rounded-lg border bg-transparent px-3.5 py-2.5 text-[14px] outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              placeholder="Three things you're grateful for…"
            />
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-[110px_1fr]">
            <div className="flex flex-col gap-1.5">
              <label className="text-text-2 text-[12.5px] font-semibold">Partner depth</label>
              <input
                type="number"
                min={1}
                max={3}
                value={gabiDepth ?? ''}
                onChange={(ev) =>
                  dirtify(setGabiDepth)(ev.target.value === '' ? null : Number(ev.target.value))
                }
                className="border-border focus:border-accent text-text placeholder:text-text-4 h-9 w-full rounded-lg border bg-transparent px-3 text-[14px] outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                placeholder="1–3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-text-2 text-[12.5px] font-semibold">Topic</label>
              <input
                value={gabiTopic}
                onChange={(ev) => dirtify(setGabiTopic)(ev.target.value)}
                className="border-border focus:border-accent text-text placeholder:text-text-4 h-9 w-full rounded-lg border bg-transparent px-3 text-[14px] outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                placeholder="What did you talk about?"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-2 text-[12.5px] font-semibold">Free notes</label>
            <textarea
              value={freeNotes}
              onChange={(ev) => dirtify(setFreeNotes)(ev.target.value)}
              rows={3}
              className="border-border focus:border-accent text-text placeholder:text-text-4 w-full resize-y rounded-lg border bg-transparent px-3.5 py-2.5 text-[14px] outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
              placeholder="Anything else on your mind…"
            />
          </div>
        </div>
      </details>

      <SaveBar status={status} onSave={submit} saveLabel="Save journal" />

      <section className="mt-11">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-text font-display m-0 text-[22px] font-medium tracking-[-0.01em]">
            Past 14 days
          </h2>
          <div className="text-text-3 text-xs font-medium">
            {past.length} {past.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
        {past.length === 0 ? (
          <div className="border-border-strong text-text-3 rounded-lg border border-dashed px-5 py-8 text-center text-[13px] italic">
            No entries yet. Today&apos;s save will appear here tomorrow.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {past.map((p) => (
              <PastRowItem
                key={p.id}
                entry={p}
                active={p.journal_date === viewDate}
                onOpen={() => guardedNavigate(`/journal?date=${p.journal_date}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PromptCard({
  tag,
  title,
  subtitle,
  value,
  onChange,
}: {
  tag: string;
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-surface border-border focus-within:border-border-strong mb-3.5 rounded-xl border px-5 py-4 transition-colors">
      <div className="text-accent bg-accent-soft mb-1.5 inline-block rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
        {tag}
      </div>
      <div className="text-text text-[14.5px] font-semibold">{title}</div>
      <p className="text-text-3 mb-2 mt-0.5 text-[13px]">{subtitle}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="border-border focus:border-accent text-text placeholder:text-text-4 w-full resize-y rounded-lg border bg-transparent px-3.5 py-2.5 text-[14px] leading-[1.55] outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        placeholder="Write here…"
      />
    </div>
  );
}

function PastRowItem({
  entry,
  active,
  onOpen,
}: {
  entry: PastRow;
  active: boolean;
  onOpen: () => void;
}) {
  const dateObj = parseISO(entry.journal_date);
  const day = format(dateObj, 'd');
  const month = format(dateObj, 'MMM');
  const summary = entry.win ?? '—';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'bg-surface border-border hover:border-border-strong grid w-full cursor-pointer items-center gap-3.5 rounded-lg border px-4 py-2.5 text-left transition-colors',
        active && 'border-accent ring-accent/30 ring-2',
      )}
      style={{ gridTemplateColumns: '88px 1fr auto' }}
    >
      <div className="flex flex-col items-start tabular-nums">
        <span className="text-text text-lg font-semibold leading-none">{day}</span>
        <span className="text-text-3 mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
          {month}
        </span>
      </div>
      <div className="text-text-2 line-clamp-1 text-[13.5px] leading-tight">
        {summary}
        {entry.is_partial ? (
          <span className="text-text-3 bg-surface-2 ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
            Partial
          </span>
        ) : null}
      </div>
      <div className="flex gap-1">
        <ScoreChip label="P" value={entry.area_pro_score} />
        <ScoreChip label="H" value={entry.area_health_score} />
        <ScoreChip label="F" value={entry.area_family_score} />
        <ScoreChip label="M" value={entry.area_marriage_score} />
      </div>
    </button>
  );
}

function ScoreChip({ label, value }: { label: string; value: number | null }) {
  const cls =
    value == null
      ? 'bg-surface-2 text-text-4 border-border'
      : value >= 5
        ? 'bg-success-soft text-success border-[oklch(85%_0.08_150)]'
        : value === 4
          ? 'bg-[oklch(97%_0.025_150)] text-[oklch(50%_0.08_150)] border-border'
          : value === 3
            ? 'bg-surface-2 text-text-2 border-border'
            : value === 2
              ? 'bg-[oklch(97%_0.02_60)] text-[oklch(55%_0.12_60)] border-border'
              : 'bg-danger-soft text-danger border-[oklch(88%_0.06_25)]';
  return (
    <div
      className={cn(
        'flex w-8 flex-col items-center rounded border py-1 text-[11px] font-semibold tabular-nums',
        cls,
      )}
    >
      <span className="text-text-3 text-[9px] font-medium">{label}</span>
      <span>{value ?? '—'}</span>
    </div>
  );
}
