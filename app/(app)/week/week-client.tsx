'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SaveBar, type SaveStatus } from '@/components/ui/save-bar';
import { SectionHeader } from '@/components/ui/section-header';
import type { Area } from '@/lib/supabase/types';
import { saveWeeklyPlan } from './actions';

export interface HabitContextRow {
  id: string;
  name: string;
  area: Area;
  completed: number;
}

export interface PriorityRow {
  id: string;
  position: number;
  text: string;
}

interface PriorityDraft {
  key: string;
  text: string;
}

const DAYS_PER_WEEK = 7;

const RESET_STEPS = [
  { key: 'inbox', label: 'Clear your email inbox' },
  { key: 'calendar', label: 'Check your calendar' },
  { key: 'desktop', label: 'Clear your computer desktop' },
  { key: 'second_brain', label: 'Tidy your Second Brain notes' },
  { key: 'tasks', label: "Choose this week's tasks" },
] as const;
const RESET_KEYS = RESET_STEPS.map((s) => s.key) as readonly string[];

interface Props {
  weekStart: string;
  weekEnd: string;
  prevWeek: string;
  nextWeek: string;
  reflection: string;
  prepDone: string[];
  currentPriorities: PriorityRow[];
  lastPriorities: PriorityRow[];
  habitContext: HabitContextRow[];
}

export function WeekClient({
  weekStart,
  weekEnd,
  prevWeek,
  nextWeek,
  reflection: initialReflection,
  prepDone: initialPrepDone,
  currentPriorities,
  lastPriorities,
  habitContext,
}: Props) {
  const router = useRouter();
  const [reflection, setReflection] = useState(initialReflection);
  const [priorities, setPriorities] = useState<PriorityDraft[]>(() => {
    const seeded = currentPriorities.map((p) => ({ key: p.id, text: p.text }));
    while (seeded.length < 3) seeded.push({ key: `new-${seeded.length}`, text: '' });
    return seeded;
  });
  const [prepDone, setPrepDone] = useState<Set<string>>(
    () => new Set(initialPrepDone.filter((k) => RESET_KEYS.includes(k))),
  );
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const status: SaveStatus = pending ? 'saving' : dirty ? 'dirty' : saved ? 'saved' : 'idle';

  function markDirty() {
    setDirty(true);
    setSaved(false);
  }
  function updatePriority(key: string, text: string) {
    setPriorities((rows) => rows.map((r) => (r.key === key ? { ...r, text } : r)));
    markDirty();
  }
  function removePriority(key: string) {
    setPriorities((rows) => rows.filter((r) => r.key !== key));
    markDirty();
  }
  function addPriority() {
    setPriorities((rows) => [...rows, { key: `new-${Date.now()}`, text: '' }]);
    markDirty();
  }

  function toggleStep(key: string) {
    setPrepDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    markDirty();
  }

  function save() {
    start(async () => {
      const r = await saveWeeklyPlan({
        weekDate: weekStart,
        reflection: reflection.trim() || null,
        prepChecklist: RESET_STEPS.filter((s) => prepDone.has(s.key)).map((s) => s.key),
        priorities: priorities.map((p) => ({ text: p.text })),
      });
      if (r.ok) {
        setDirty(false);
        setSaved(true);
        toast.success('Saved');
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  // Stats
  const habitTotal = habitContext.length;
  const totalCompletions = habitContext.reduce((s, h) => s + h.completed, 0);
  const totalPossible = habitTotal * DAYS_PER_WEEK;
  const overallPct = totalPossible === 0 ? 0 : Math.round((totalCompletions / totalPossible) * 100);
  const habitsHit = habitContext.filter((h) => h.completed >= 6).length;
  const habitsMissed = habitContext.filter((h) => h.completed <= 2).length;

  const filledPriorities = priorities.filter((p) => p.text.trim()).length;
  const prepCount = RESET_STEPS.filter((s) => prepDone.has(s.key)).length;

  // Header strings
  const startLabel = format(parseISO(weekStart), 'MMM d');
  const endLabel = format(parseISO(weekEnd), 'MMM d');
  const startShort = format(parseISO(weekStart), 'dd/MM');
  const endShort = format(parseISO(weekEnd), 'dd/MM');

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow={`${startLabel} – ${endLabel}`}
        title="Weekly Planning"
        subtitle="Reflect on the week that was. Set the week ahead."
        action={
          <div className="bg-surface border-border flex items-center gap-1.5 rounded-lg border p-1">
            <Link
              href={`/week?week=${prevWeek}`}
              className="text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Link>
            <span className="border-border text-text border-l border-r px-2.5 py-1.5 text-[13px] font-semibold tabular-nums">
              {startShort} – {endShort}
            </span>
            <Link
              href={`/week?week=${nextWeek}`}
              className="text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium transition-colors"
              aria-label="Next week"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />

      {/* Weekly Reset */}
      <section className="mb-9">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-text-3 m-0 text-[11.5px] font-semibold uppercase tracking-[0.1em]">
            Weekly Reset
          </h2>
          <div className="text-text-4 text-xs tabular-nums">
            {prepCount} / {RESET_STEPS.length} done
          </div>
        </div>
        <div className="bg-surface border-border rounded-xl border px-5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-text m-0 text-[14px] font-semibold">Before you plan</h3>
            <div className="text-text-3 text-xs font-medium">Quick chores to clear the decks.</div>
          </div>
          <div className="flex flex-col">
            {RESET_STEPS.map((step) => {
              const done = prepDone.has(step.key);
              return (
                <button
                  key={step.key}
                  type="button"
                  aria-pressed={done}
                  onClick={() => toggleStep(step.key)}
                  className="group border-border hover:bg-surface-2 flex items-center gap-2.5 border-t px-1 py-2.5 text-left transition-colors first:border-t-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-4 w-4 shrink-0 place-items-center rounded border-[1.5px] transition-[background-color,border-color,color] duration-150',
                      done
                        ? 'bg-accent border-accent text-white'
                        : 'border-border-strong bg-surface text-transparent group-hover:border-accent',
                    )}
                  >
                    {done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-[14px] font-medium',
                      done ? 'text-text-4 line-through' : 'text-text',
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Last Week Context */}
      <section className="mb-9">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-text-3 m-0 text-[11.5px] font-semibold uppercase tracking-[0.1em]">
            Last Week Context
          </h2>
          <div className="text-text-4 text-xs tabular-nums">
            {overallPct}% overall completion
          </div>
        </div>

        <div className="bg-surface border-border rounded-xl border px-5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-text m-0 text-[14px] font-semibold">Habit performance</h3>
            <div className="text-text-3 text-xs font-medium tabular-nums">
              <strong className="text-text font-semibold">{habitsHit}</strong> on track ·{' '}
              <strong className="text-text font-semibold">{habitsMissed}</strong> missed ·{' '}
              <strong className="text-text font-semibold">{totalCompletions}</strong> /{' '}
              {totalPossible} total
            </div>
          </div>
          {habitContext.length === 0 ? (
            <p className="text-text-3 italic">No active habits.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-0.5 md:grid-cols-2">
              {habitContext.map((h, i) => (
                <HabitContextItem key={h.id} habit={h} isLastInColumn={i === habitContext.length - 1 || i === habitContext.length - 2} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border-border mt-4 rounded-xl border px-5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-text m-0 text-[14px] font-semibold">Last week&apos;s priorities</h3>
            <div className="text-text-3 text-xs font-medium tabular-nums">
              <strong className="text-text font-semibold">{lastPriorities.length}</strong> recorded
            </div>
          </div>
          {lastPriorities.length === 0 ? (
            <div className="text-text-3 py-2 italic">No priorities recorded.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {lastPriorities.map((p, i) => (
                <div
                  key={p.id}
                  className="bg-surface-2 border-border flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="bg-surface border-border text-text-2 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11.5px] font-semibold tabular-nums">
                    {i + 1}
                  </div>
                  <div className="text-text flex-1 text-[13.5px] font-medium">{p.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reflection */}
      <section className="mb-9">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-text-3 m-0 text-[11.5px] font-semibold uppercase tracking-[0.1em]">
            Reflection
          </h2>
          <div className="text-text-4 text-xs tabular-nums">{reflection.length} chars</div>
        </div>
        <div className="bg-surface border-border overflow-hidden rounded-xl border">
          <div className="bg-surface-2 border-border border-b px-5 py-4">
            <h3 className="text-text m-0 text-[14px] font-semibold">How was your week?</h3>
            <p className="text-text-3 m-0 text-[13px]">
              What worked, what didn&apos;t, what do you want to change?
            </p>
          </div>
          <textarea
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value);
              markDirty();
            }}
            rows={6}
            placeholder="Write freely. There's no wrong way to reflect."
            className="text-text placeholder:text-text-4 block w-full resize-y border-none bg-transparent px-5 py-4 text-[14px] leading-[1.6] outline-none"
            style={{ minHeight: 140 }}
          />
          <div className="bg-surface-2 border-border text-text-3 flex justify-between border-t px-5 py-2 text-[11.5px]">
            <span>Markdown supported</span>
            <span>Auto-saved drafts</span>
          </div>
        </div>
      </section>

      {/* Next Week Priorities */}
      <section className="mb-9">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-text-3 m-0 text-[11.5px] font-semibold uppercase tracking-[0.1em]">
            Next Week Priorities
          </h2>
          <div className="text-text-4 text-xs tabular-nums">
            {filledPriorities} / {priorities.length} filled
          </div>
        </div>
        <div className="bg-surface border-border rounded-xl border px-5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-text m-0 text-[14px] font-semibold">Set 3–5 priorities</h3>
            <div className="text-text-3 text-xs font-medium">
              Keep the list short. Focus is the goal.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {priorities.map((p, i) => (
              <div
                key={p.key}
                className="bg-surface border-border focus-within:border-accent flex items-center gap-2.5 rounded-lg border pl-2.5 pr-2.5 transition-colors focus-within:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <div className="bg-surface border-border text-text-2 my-2 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11.5px] font-semibold tabular-nums">
                  {i + 1}
                </div>
                <input
                  value={p.text}
                  onChange={(e) => updatePriority(p.key, e.target.value)}
                  placeholder={`Priority ${i + 1}…`}
                  className="text-text placeholder:text-text-4 flex-1 border-none bg-transparent px-1 py-3 text-[14px] font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => removePriority(p.key)}
                  aria-label="Remove priority"
                  className="text-text-4 hover:bg-danger-soft hover:text-danger grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPriority}
              className="border-border-strong text-text-2 hover:border-accent hover:text-accent hover:bg-accent-tint mt-1 inline-flex items-center gap-2 self-start rounded-lg border border-dashed bg-transparent px-3.5 py-2.5 text-[13px] font-medium transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add priority
            </button>
          </div>
        </div>
      </section>

      <SaveBar status={status} onSave={save} saveLabel="Save plan" />
    </div>
  );
}

function HabitContextItem({
  habit,
  isLastInColumn,
}: {
  habit: HabitContextRow;
  isLastInColumn: boolean;
}) {
  const pct = Math.round((habit.completed / DAYS_PER_WEEK) * 100);
  const status: 'success' | 'fail' | 'partial' =
    habit.completed >= 6 ? 'success' : habit.completed <= 2 ? 'fail' : 'partial';
  const isFull = habit.completed === DAYS_PER_WEEK;
  const isZero = habit.completed === 0;

  return (
    <div
      className={cn(
        'border-border grid items-center gap-2.5 border-b border-dashed py-2',
        isLastInColumn && 'border-b-0',
      )}
      style={{ gridTemplateColumns: '18px 1fr auto auto' }}
    >
      <div
        className={cn(
          'grid h-[18px] w-[18px] place-items-center rounded-full',
          status === 'success' && 'bg-success-soft text-success',
          status === 'fail' && 'bg-danger-soft text-danger',
          status === 'partial' && 'bg-accent-tint text-accent',
        )}
      >
        {status === 'fail' ? (
          <X className="h-2.5 w-2.5" strokeWidth={3.5} />
        ) : (
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        )}
      </div>
      <div className="text-text text-[13.5px] font-medium">{habit.name}</div>
      <div className="bg-surface-2 h-1 w-[60px] overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full',
            isZero ? 'bg-border-strong' : isFull ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-text-3 min-w-[24px] text-right text-xs font-medium tabular-nums">
        <strong className="text-text font-semibold">{habit.completed}</strong>/{DAYS_PER_WEEK}
      </div>
    </div>
  );
}
