'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CircleHelp, Flower2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { TabBar, type TabBarItem } from '@/components/ui/tab-bar';
import {
  createMeditationLogOnDate,
  deleteMeditationLog,
  updateMeditationLogDate,
  upsertMeditationLog,
} from './actions';

export interface DayTab {
  value: string;       // '0'..'6' (Sun..Sat dow)
  shortName: string;   // 'Sun', 'Mon', ...
  date: string;        // ISO 'YYYY-MM-DD' for this day in the current week
  dateNumber: number;  // day-of-month (1..31)
  isToday: boolean;
}

export interface MeditationLogRow {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  minutes: number;
}

interface Props {
  day: number;
  todayDow: number;
  today: string;
  dayTabs: DayTab[];
  fullDayName: string;
  logs: MeditationLogRow[];
  stats: {
    currentStreak: number;
    weekTotalMinutes: number;
    averageMinutes: number;
    totalSessions: number;
  };
}

export function MeditationClient(props: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // Default new-log date = the selected weekday's date in the current week
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

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="Meditation · Daily minutes"
        title={props.fullDayName}
        subtitle="Track how long you sat each day, by weekday."
      />

      <div className="mb-7">
        <TabBar
          items={tabItems}
          value={String(props.day)}
          onChange={(v) => router.push(`/meditation?day=${v}`)}
        />
      </div>

      <div className="bg-surface border-border mb-5 flex flex-wrap items-center justify-between gap-5 rounded-xl border px-5 py-5">
        <div className="flex min-w-[200px] flex-col gap-1">
          <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            {props.fullDayName}
          </div>
          <div className="text-text inline-flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em]">
            <Flower2 className="text-accent h-4 w-4" />
            Meditation
          </div>
          <div className="text-text-3 mt-1 text-[12.5px]">
            Log total minutes meditated per day. One entry per date.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            max={props.today}
            onChange={(e) => setNewDate(e.target.value)}
            aria-label="New log date"
            className="border-border bg-surface text-text focus:border-accent rounded-lg border px-2.5 py-2 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <button
            type="button"
            disabled={pending || !newDate}
            onClick={() =>
              start(async () => {
                const r = await createMeditationLogOnDate({ date: newDate });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success(`New log: ${formatBR(newDate)}`);
                const dow = new Date(`${newDate}T00:00:00Z`).getUTCDay();
                router.push(`/meditation?day=${dow}`);
                router.refresh();
              })
            }
            className="bg-accent inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-95 disabled:cursor-default disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New log
          </button>
        </div>
      </div>

      <StatsRow stats={props.stats} />

      <LogsCard logs={props.logs} today={props.today} />
    </div>
  );
}

function StatsRow({ stats }: { stats: Props['stats'] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Current streak"
        value={stats.currentStreak}
        unit={stats.currentStreak === 1 ? 'day' : 'days'}
        trend={{
          dir: stats.currentStreak > 0 ? 'up' : 'flat',
          text: stats.currentStreak > 0 ? 'Keep showing up' : 'Sit today',
        }}
      />
      <StatCard
        label="This week"
        value={stats.weekTotalMinutes}
        unit="min"
        trend={{
          dir: 'flat',
          text: 'Last 7 days',
        }}
      />
      <StatCard
        label="30-day average"
        value={stats.averageMinutes}
        unit="min / sit"
        trend={{
          dir: 'flat',
          text: 'Across days you sat',
        }}
      />
      <StatCard
        label="Total sessions"
        value={stats.totalSessions}
        unit={stats.totalSessions === 1 ? 'log' : 'logs'}
        trend={{ dir: 'flat', text: 'All time' }}
      />
    </div>
  );
}

function LogsCard({
  logs,
  today,
}: {
  logs: MeditationLogRow[];
  today: string;
}) {
  return (
    <div className="bg-surface border-border overflow-hidden rounded-xl border">
      <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
        <h3 className="text-text m-0 text-[14px] font-semibold">
          Sessions on this weekday
        </h3>
        <div className="text-text-3 text-xs font-medium">
          {logs.length} {logs.length === 1 ? 'log' : 'logs'} · most recent first
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="text-text-3 inline-flex flex-col items-center gap-2">
            <div className="bg-surface-2 text-text-3 grid h-10 w-10 place-items-center rounded-lg">
              <CircleHelp className="h-4 w-4" />
            </div>
            <div className="text-text text-sm font-semibold">No logs yet</div>
            <div className="text-text-3 text-[13px]">
              Tap <span className="text-text font-medium">+ New log</span> or
              type into today&apos;s row above.
            </div>
          </div>
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} isToday={log.date === today} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LogRow({ log, isToday }: { log: MeditationLogRow; isToday: boolean }) {
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-4 px-5 py-3',
        isToday && 'bg-accent-soft/30',
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="date"
          defaultValue={log.date}
          aria-label="Log date"
          className="border-border bg-surface text-text focus:border-accent w-[124px] rounded-md border px-2 py-1.5 text-[12.5px] tabular-nums outline-none focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          onBlur={(e) => {
            const v = e.target.value;
            if (!v || v === log.date) return;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
              e.target.value = log.date;
              return;
            }
            start(async () => {
              const r = await updateMeditationLogDate({
                logId: log.id,
                newDate: v,
              });
              if (!r.ok) {
                toast.error(r.error);
                e.target.value = log.date;
              } else {
                router.refresh();
              }
            });
          }}
        />
        {isToday ? (
          <span className="text-accent text-[10.5px] font-bold uppercase tracking-[0.06em]">
            Today
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <MinutesCell logId={log.id} logDate={log.date} initial={log.minutes} />
        <button
          type="button"
          aria-label="Delete log"
          onClick={() => {
            if (!confirm(`Delete meditation log from ${formatBR(log.date)}?`)) return;
            start(async () => {
              const r = await deleteMeditationLog(log.id);
              if (!r.ok) toast.error(r.error);
              else router.refresh();
            });
          }}
          className="text-text-4 hover:bg-danger-soft hover:text-danger grid h-[26px] w-[26px] place-items-center rounded-md transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}

function MinutesCell({
  logDate,
  initial,
}: {
  logId: string;
  logDate: string;
  initial: number;
}) {
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border p-0.5 transition-[background-color,border-color]',
        initial > 0 ? 'bg-surface border-border' : 'bg-surface-2 border-transparent',
        'focus-within:bg-surface focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]',
      )}
    >
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min="0"
        max="600"
        defaultValue={initial > 0 ? initial : ''}
        aria-label="Minutes meditated"
        placeholder="min"
        className="text-text placeholder:text-text-4 w-20 border-none bg-transparent px-2 py-1 text-center text-[13px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onBlur={(e) => {
          const raw = e.target.value;
          const v = raw === '' ? 0 : Math.max(0, Math.round(Number(raw)));
          if (!Number.isFinite(v)) return;
          if (v === initial) return;
          start(async () => {
            const res = await upsertMeditationLog({ logDate, minutes: v });
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          });
        }}
      />
      <span className="text-text-4 pr-2 text-[11px] font-medium uppercase tracking-[0.04em]">
        min
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
