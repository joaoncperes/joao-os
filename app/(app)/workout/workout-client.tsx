'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Settings, Plus, Trash2, Moon, CircleHelp, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { parseDecimalInput } from '@/lib/number';
import type { CardioListRow } from '@/lib/supabase/types';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { TabBar, type TabBarItem } from '@/components/ui/tab-bar';
import { RestTimer } from './rest-timer';
import {
  createCardioSession,
  createSessionOnDate,
  deleteCardioSession,
  deleteSession,
  updateCardioSession,
  updateSessionDate,
  upsertSet,
} from './actions';

export interface DayTab {
  value: string;            // '0'..'6' (Sun..Sat dow)
  shortName: string;        // 'Dom', 'Seg', ...
  date: string;             // ISO 'YYYY-MM-DD' for this day in the current week
  dateNumber: number;       // day-of-month (1..31)
  isToday: boolean;
}

export interface ExerciseCol {
  exercise_id: string;
  name: string;
  muscle: string | null;
  sets: number;
}

export interface SessionRow {
  id: string;
  date: string;
  sets: Record<string, Record<number, { weight: number | null; reps: number | null; isPr: boolean }>>;
}

interface Props {
  day: number;
  todayDow: number;
  today: string;
  dayTabs: DayTab[];
  cardioTab: boolean;
  cardioRows: CardioListRow[];
  cardioStats: { thisWeekKcal: number; lastKcal: number | null; sessionCount: number };
  splitName: string;
  isRest: boolean;
  muscles: string[];
  fullDayName: string;
  exercises: ExerciseCol[];
  sessions: SessionRow[];
  todayLastCompletedAt: string | null;
  stats: {
    lastSessionDate: string | null;
    sessionCount: number;
    lastVolume: number;
    volumeDeltaPct: number;
    prCountThisSession: number;
    totalSets: number;
  };
}

export function WorkoutClient(props: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const totalSetCols = props.exercises.reduce((acc, e) => acc + e.sets, 0);

  // Default new-session date = the selected weekday's date in the current week
  // if it's today or in the past, else the most recent past occurrence.
  const selectedTab = props.dayTabs.find((t) => t.value === String(props.day));
  const defaultDate =
    selectedTab && selectedTab.date <= props.today
      ? selectedTab.date
      : selectedTab
        ? addDaysISO(selectedTab.date, -7)
        : props.today;
  const [newDate, setNewDate] = useState(defaultDate);

  const tabItems: TabBarItem[] = props.dayTabs.map((t) => ({
    value: t.value,
    label: String(t.dateNumber).padStart(2, '0'),
    sub: t.isToday ? `${t.shortName} · today` : t.shortName,
    highlighted: t.isToday,
  }));
  tabItems.push({
    value: 'cardio',
    label: <HeartPulse className="h-[15px] w-[15px]" aria-hidden />,
    sub: 'Cardio',
  });

  // Cardio is decoupled from the weekday split — its own tab, logged on any day.
  if (props.cardioTab) {
    return (
      <div className="flex flex-col">
        <SectionHeader
          eyebrow="Workout · Cardio"
          title="Cardio"
          subtitle="Log cardio on any day — calories are tracked weekly in Insights."
        />
        <div className="mb-7">
          <TabBar
            items={tabItems}
            value="cardio"
            onChange={(v) => router.push(`/workout?day=${v}`)}
          />
        </div>
        <CardioTab today={props.today} rows={props.cardioRows} stats={props.cardioStats} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <RestTimer lastCompletedAt={props.todayLastCompletedAt} />
      <SectionHeader
        eyebrow="Workout · Load progression"
        title={props.fullDayName}
        subtitle="Track your weekly progression by training split."
      />

      <div className="mb-7">
        <TabBar
          items={tabItems}
          value={String(props.day)}
          onChange={(v) => router.push(`/workout?day=${v}`)}
        />
      </div>

      <div className="bg-surface border-border mb-5 flex flex-wrap items-center justify-between gap-5 rounded-xl border px-5 py-5">
        <div className="flex min-w-[200px] flex-col gap-1">
          <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            {props.fullDayName}
          </div>
          <div className="text-text text-[19px] font-semibold tracking-[-0.01em]">
            {props.isRest ? 'Rest' : props.splitName}
          </div>
          {props.muscles.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {props.muscles.map((m) => (
                <span
                  key={m}
                  className="bg-surface-2 text-text-2 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium capitalize"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/setup/workout"
            className="bg-surface border-border text-text-2 hover:bg-surface-2 hover:border-border-strong hover:text-text inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Edit split
          </Link>
          <input
            type="date"
            value={newDate}
            max={props.today}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="New session date"
            className="border-border bg-surface text-text focus:border-accent rounded-lg border px-2.5 py-2 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <button
            type="button"
            disabled={pending || props.isRest || props.exercises.length === 0 || !newDate}
            onClick={() =>
              start(async () => {
                const r = await createSessionOnDate({ date: newDate });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success(`New session: ${formatBR(r.data.sessionDate)}`);
                // Jump to the weekday of the created session so the new row is visible.
                const dow = new Date(`${r.data.sessionDate}T00:00:00Z`).getUTCDay();
                router.push(`/workout?day=${dow}`);
                router.refresh();
              })
            }
            className="bg-accent inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New session
          </button>
        </div>
      </div>

      {props.isRest ? (
        <RestEmptyCard
          icon={<Moon className="h-6 w-6" />}
          title="Rest day"
          subtitle={`No split planned for ${props.fullDayName.toLowerCase()}. Enjoy the recovery.`}
        />
      ) : props.exercises.length === 0 ? (
        <RestEmptyCard
          icon={<Settings className="h-6 w-6" />}
          title="Split has no exercises"
          subtitle="Configure exercises in Settings to start logging sessions."
        />
      ) : (
        <>
          <StatsRow stats={props.stats} exerciseCount={props.exercises.length} />
          <SessionsCard
            exercises={props.exercises}
            sessions={props.sessions}
            totalSetCols={totalSetCols}
          />
        </>
      )}
    </div>
  );
}

function RestEmptyCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="bg-surface border-border mt-2 flex flex-col items-center gap-3 rounded-xl border px-6 py-16 text-center">
      <div className="bg-accent-tint text-accent inline-grid h-14 w-14 place-items-center rounded-2xl">
        {icon}
      </div>
      <div className="text-text text-lg font-semibold">{title}</div>
      <div className="text-text-3 max-w-md text-sm">{subtitle}</div>
    </div>
  );
}

function StatsRow({
  stats,
  exerciseCount,
}: {
  stats: Props['stats'];
  exerciseCount: number;
}) {
  const trendDir =
    stats.volumeDeltaPct > 0 ? 'up' : stats.volumeDeltaPct < 0 ? 'down' : 'flat';
  const trendArrow = trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→';

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Last session"
        value={stats.lastSessionDate ? formatBR(stats.lastSessionDate).slice(0, 5) : '—'}
        trend={{
          dir: 'flat',
          text: `${stats.sessionCount} ${stats.sessionCount === 1 ? 'session logged' : 'sessions logged'}`,
        }}
      />
      <StatCard
        label="Total volume"
        value={Math.round(stats.lastVolume).toLocaleString('en-US')}
        unit="kg"
        trend={{
          dir: trendDir,
          text: `${trendArrow} ${Math.abs(stats.volumeDeltaPct)}% vs previous`,
        }}
      />
      <StatCard
        label="Personal records"
        value={stats.prCountThisSession}
        unit="this session"
        trend={{
          dir: stats.prCountThisSession > 0 ? 'up' : 'flat',
          text: stats.prCountThisSession > 0 ? 'Keep the pace' : 'Next PR ahead',
        }}
      />
      <StatCard
        label="Planned volume"
        value={exerciseCount}
        unit={`exercises · ${stats.totalSets} sets`}
        trend={{ dir: 'flat', text: 'Per session' }}
      />
    </div>
  );
}

function SessionsCard({
  exercises,
  sessions,
  totalSetCols,
}: {
  exercises: ExerciseCol[];
  sessions: SessionRow[];
  totalSetCols: number;
}) {
  const totalSets = exercises.reduce((s, e) => s + e.sets, 0);

  return (
    <div className="bg-surface border-border overflow-hidden rounded-xl border">
      <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
        <h3 className="text-text m-0 text-[14px] font-semibold">Session history</h3>
        <div className="text-text-3 text-xs font-medium">
          {sessions.length}{' '}
          {sessions.length === 1 ? 'session' : 'sessions'} · {exercises.length} exercises ·{' '}
          {totalSets} sets per session
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ borderSpacing: 0, minWidth: 800, width: '100%' }}>
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="bg-surface-2 text-text border-border sticky left-0 z-30 border-b px-3 py-2.5 text-left text-[12px] font-semibold"
                style={{ minWidth: 180, boxShadow: '1px 0 0 var(--border)' }}
              >
                Date
              </th>
              {exercises.map((ex, i) => (
                <th
                  key={ex.exercise_id}
                  colSpan={ex.sets}
                  className={cn(
                    'bg-surface-2 text-text border-border border-b px-3 py-2.5 text-left',
                    i > 0 && 'border-l-2 border-l-border',
                  )}
                  style={{ verticalAlign: 'top' }}
                >
                  <div className="text-text text-[13.5px] font-semibold leading-tight">
                    {ex.name}
                  </div>
                  {ex.muscle ? (
                    <div className="text-text-3 mt-0.5 text-[11px] font-medium capitalize">
                      {ex.muscle}
                    </div>
                  ) : null}
                  <div className="text-text-4 mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
                    {ex.sets} sets · kg × reps
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              {exercises.flatMap((ex, ei) =>
                Array.from({ length: ex.sets }, (_, s) => (
                  <th
                    key={`${ex.exercise_id}-h-${s}`}
                    className={cn(
                      'bg-surface text-text-3 border-border border-b px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em]',
                      ei > 0 && s === 0 && 'border-l-2 border-l-border',
                    )}
                  >
                    S{s + 1}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={1 + totalSetCols} className="px-6 py-16 text-center">
                  <div className="text-text-3 inline-flex flex-col items-center gap-2">
                    <div className="bg-surface-2 text-text-3 grid h-10 w-10 place-items-center rounded-lg">
                      <CircleHelp className="h-4 w-4" />
                    </div>
                    <div className="text-text text-sm font-semibold">
                      No sessions logged
                    </div>
                    <div className="text-text-3 text-[13px]">
                      Tap <span className="text-text font-medium">+ New session</span> to get started.
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <SessionTableRow key={session.id} session={session} exercises={exercises} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionTableRow({
  session,
  exercises,
}: {
  session: SessionRow;
  exercises: ExerciseCol[];
}) {
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <tr>
      <td
        className="bg-surface border-border sticky left-0 z-10 border-b"
        style={{ boxShadow: '1px 0 0 var(--border)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <input
            type="date"
            defaultValue={session.date}
            aria-label="Session date"
            className="border-border bg-surface text-text focus:border-accent w-[124px] rounded-md border px-2 py-1.5 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            onBlur={(e) => {
              const v = e.target.value;
              if (!v || v === session.date) return;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                e.target.value = session.date;
                return;
              }
              start(async () => {
                const r = await updateSessionDate({ sessionId: session.id, newDate: v });
                if (!r.ok) {
                  toast.error(r.error);
                  e.target.value = session.date;
                } else {
                  router.refresh();
                }
              });
            }}
          />
          <button
            type="button"
            aria-label="Delete session"
            onClick={() => {
              if (!confirm(`Delete session from ${formatBR(session.date)}?`)) return;
              start(async () => {
                const r = await deleteSession(session.id);
                if (!r.ok) toast.error(r.error);
                else router.refresh();
              });
            }}
            className="text-text-4 hover:bg-danger-soft hover:text-danger grid h-[26px] w-[26px] place-items-center rounded-md transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
      {exercises.flatMap((ex, ei) =>
        Array.from({ length: ex.sets }, (_, s) => {
          const setNumber = s + 1;
          const cell = session.sets[ex.exercise_id]?.[setNumber];
          return (
            <td
              key={`${session.id}-${ex.exercise_id}-${setNumber}`}
              className={cn(
                'border-border bg-surface border-b p-1.5 text-center',
                ei > 0 && s === 0 && 'border-l-2 border-l-border',
              )}
            >
              <SetCell
                sessionId={session.id}
                exerciseId={ex.exercise_id}
                setNumber={setNumber}
                initial={cell}
              />
            </td>
          );
        }),
      )}
    </tr>
  );
}

function SetCell({
  sessionId,
  exerciseId,
  setNumber,
  initial,
}: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  initial?: { weight: number | null; reps: number | null; isPr: boolean };
}) {
  const [, start] = useTransition();
  const router = useRouter();
  const w = initial?.weight ?? null;
  const r = initial?.reps ?? null;
  const hasValue = w != null && r != null;
  const isPr = initial?.isPr ?? false;

  function save(next: { weight: number | null; reps: number | null }) {
    start(async () => {
      const res = await upsertSet({
        sessionId,
        exerciseId,
        setNumber,
        weightKg: next.weight,
        reps: next.reps,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        // Refresh so the new PR badge (if any) is reflected.
        router.refresh();
      }
    });
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border p-0.5 transition-[background-color,border-color]',
        isPr
          ? 'border-success bg-gradient-to-br from-[var(--success-soft)] to-[var(--surface)]'
          : hasValue
            ? 'bg-surface border-border'
            : 'bg-surface-2 border-transparent',
        'focus-within:bg-surface focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]',
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        defaultValue={w ?? ''}
        aria-label="kg"
        placeholder="kg"
        className="text-text placeholder:text-text-4 w-11 border-none bg-transparent px-1 py-1 text-center text-[12.5px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onBlur={(e) => {
          const v = parseDecimalInput(e.target.value);
          if (v !== w) save({ weight: v, reps: r });
        }}
      />
      <span className="text-text-4 text-[11px]">×</span>
      <input
        type="number"
        inputMode="numeric"
        step="any"
        defaultValue={r ?? ''}
        aria-label="reps"
        placeholder="reps"
        className="text-text placeholder:text-text-4 w-11 border-none bg-transparent px-1 py-1 text-center text-[12.5px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onBlur={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value);
          if (v !== r) save({ weight: w, reps: v });
        }}
      />
      {isPr ? (
        <span className="text-success ml-0.5 text-[9px] font-bold uppercase tracking-[0.06em]">
          PR
        </span>
      ) : null}
    </div>
  );
}

function CardioTab({
  today,
  rows,
  stats,
}: {
  today: string;
  rows: CardioListRow[];
  stats: { thisWeekKcal: number; lastKcal: number | null; sessionCount: number };
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [newDate, setNewDate] = useState(today);
  const [newKcal, setNewKcal] = useState('');

  function addCardio() {
    if (!newDate || pending) return;
    const kcal = newKcal === '' ? null : Math.round(Number(newKcal));
    start(async () => {
      const r = await createCardioSession({ date: newDate, kcal });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Cardio logged: ${formatBR(newDate)}`);
      setNewKcal('');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className="bg-surface border-border mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-5">
        <div className="flex min-w-[200px] flex-col gap-1">
          <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Cardio
          </div>
          <div className="text-text text-[19px] font-semibold tracking-[-0.01em]">
            Log on any day
          </div>
          <div className="text-text-3 mt-0.5 text-[12.5px]">
            Calories roll up weekly in Insights.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            max={today}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="Cardio date"
            className="border-border bg-surface text-text focus:border-accent rounded-lg border px-2.5 py-2 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <div className="border-border bg-surface focus-within:border-accent inline-flex items-center gap-1.5 rounded-lg border p-0.5 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={newKcal}
              onChange={(e) => setNewKcal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCardio();
              }}
              aria-label="Cardio kcal"
              placeholder="kcal"
              className="text-text placeholder:text-text-4 w-20 border-none bg-transparent px-2 py-1.5 text-center text-[13px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-text-4 pr-2 text-[11px] font-medium uppercase tracking-[0.04em]">
              kcal
            </span>
          </div>
          <button
            type="button"
            disabled={pending || !newDate}
            onClick={addCardio}
            className="bg-accent inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add cardio
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="This week"
          value={stats.thisWeekKcal > 0 ? stats.thisWeekKcal.toLocaleString('en-US') : '—'}
          unit="kcal"
          trend={{ dir: 'flat', text: 'Sun → Sat' }}
        />
        <StatCard
          label="Last session"
          value={stats.lastKcal != null ? stats.lastKcal.toLocaleString('en-US') : '—'}
          unit="kcal"
          trend={{ dir: 'flat', text: stats.lastKcal != null ? 'Most recent' : 'Log to start' }}
        />
        <StatCard
          label="Total sessions"
          value={stats.sessionCount}
          unit={stats.sessionCount === 1 ? 'session' : 'sessions'}
          trend={{ dir: 'flat', text: 'All time' }}
        />
      </div>

      <div className="bg-surface border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
          <h3 className="text-text m-0 text-[14px] font-semibold">Cardio history</h3>
          <div className="text-text-3 text-xs font-medium">
            {rows.length} {rows.length === 1 ? 'session' : 'sessions'} · kcal per session
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-text-3 inline-flex flex-col items-center gap-2">
              <div className="bg-surface-2 text-text-3 grid h-10 w-10 place-items-center rounded-lg">
                <CircleHelp className="h-4 w-4" />
              </div>
              <div className="text-text text-sm font-semibold">No cardio logged</div>
              <div className="text-text-3 text-[13px]">
                Pick a date, enter kcal, and tap{' '}
                <span className="text-text font-medium">+ Add cardio</span>.
              </div>
            </div>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((row) => (
              <CardioSessionRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CardioSessionRow({ row }: { row: CardioListRow }) {
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <input
        type="date"
        defaultValue={row.session_date}
        aria-label="Cardio date"
        className="border-border bg-surface text-text focus:border-accent w-[140px] rounded-md border px-2 py-1.5 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        onBlur={(e) => {
          const v = e.target.value;
          if (!v || v === row.session_date) return;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            e.target.value = row.session_date;
            return;
          }
          start(async () => {
            const r = await updateCardioSession({ id: row.id, date: v });
            if (!r.ok) {
              toast.error(r.error);
              e.target.value = row.session_date;
            } else {
              router.refresh();
            }
          });
        }}
      />
      <CardioKcalCell cardioId={row.id} initial={row.kcal} />
      <button
        type="button"
        aria-label="Delete cardio session"
        onClick={() => {
          if (!confirm(`Delete cardio from ${formatBR(row.session_date)}?`)) return;
          start(async () => {
            const r = await deleteCardioSession(row.id);
            if (!r.ok) toast.error(r.error);
            else router.refresh();
          });
        }}
        className="text-text-4 hover:bg-danger-soft hover:text-danger ml-auto grid h-[28px] w-[28px] place-items-center rounded-md transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function CardioKcalCell({
  cardioId,
  initial,
}: {
  cardioId: string;
  initial: number | null;
}) {
  const [, start] = useTransition();
  const router = useRouter();
  const hasValue = initial != null;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border p-0.5 transition-[background-color,border-color]',
        hasValue ? 'bg-surface border-border' : 'bg-surface-2 border-transparent',
        'focus-within:bg-surface focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]',
      )}
    >
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min="0"
        defaultValue={initial ?? ''}
        aria-label="kcal"
        placeholder="kcal"
        className="text-text placeholder:text-text-4 w-20 border-none bg-transparent px-2 py-1 text-center text-[13px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onBlur={(e) => {
          const raw = e.target.value;
          const v = raw === '' ? null : Math.round(Number(raw));
          if (v === initial) return;
          start(async () => {
            const res = await updateCardioSession({ id: cardioId, kcal: v });
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          });
        }}
      />
      <span className="text-text-4 pr-2 text-[11px] font-medium uppercase tracking-[0.04em]">
        kcal
      </span>
    </div>
  );
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatBR(dateISO: string): string {
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateISO;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
