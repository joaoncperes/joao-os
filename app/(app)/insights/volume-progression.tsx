'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { TabBar, type TabBarItem } from '@/components/ui/tab-bar';
import { cn } from '@/lib/utils';

type VolumePoint = { date: string; volume: number; sets: number };
type WeeklyPoint = { weekStart: string; volume: number; sessions: number };

interface VolumeProgressionProps {
  perDay: Record<number, VolumePoint[]>;
  weekly: WeeklyPoint[];
  todayDow: number;
}

// Pedro's 5 strength days. Tue/Thu (cardio) are excluded — 0 strength volume.
// Split names mirror lib/seed.ts (stored in English on workout_sessions).
const DAY_META = [
  { dow: 0, label: 'Dom', full: 'Domingo', split: 'Chest + Triceps + Shoulder' },
  { dow: 1, label: 'Seg', full: 'Segunda', split: 'Back + Biceps + Rear Shoulder' },
  { dow: 3, label: 'Qua', full: 'Quarta', split: 'Legs + Abs' },
  { dow: 5, label: 'Sex', full: 'Sexta', split: 'Push + Back + Shoulder' },
  { dow: 6, label: 'Sáb', full: 'Sábado', split: 'Legs + Abs' },
] as const;

const WD_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const BRL = new Intl.NumberFormat('pt-BR');

/** 'YYYY-MM-DD' → 'DD/MM'. */
export function fmtShort(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
/** 'YYYY-MM-DD' → 'Sáb, 24/05'. */
function fmtLong(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WD_PT[d.getUTCDay()]}, ${fmtShort(iso)}`;
}
/** Percent change curr vs prev, 1 decimal. null when prev is 0/absent. */
export function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

// recharts applies colors as SVG presentation attributes, where var() does not
// resolve. Read the design tokens once on mount and pass concrete values.
// Fallbacks mirror app/globals.css so SSR/first paint matches (no flash, no
// hydration mismatch); the effect refreshes them if the palette ever changes.
const FALLBACK = {
  accent: 'oklch(55% 0.09 250)',
  border: 'oklch(92% 0.006 240)',
  text3: 'oklch(62% 0.01 250)',
  surface2: 'oklch(97% 0.005 240)',
};
export type Palette = typeof FALLBACK;

// Read the palette once on the client. SSR returns the fallback (no document);
// recharts' ResponsiveContainer renders the chart client-side anyway, so the
// concrete token values land before the chart paints — no flash, no
// setState-in-effect cascade.
function readTokens(): Palette {
  if (typeof document === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    accent: read('--accent', FALLBACK.accent),
    border: read('--border', FALLBACK.border),
    text3: read('--text-3', FALLBACK.text3),
    surface2: read('--surface-2', FALLBACK.surface2),
  };
}

export function useTokens(): Palette {
  const [palette] = useState<Palette>(readTokens);
  return palette;
}

export function VolumeProgression({ perDay, weekly, todayDow }: VolumeProgressionProps) {
  const tokens = useTokens();
  const isTrainingDay = DAY_META.some((d) => d.dow === todayDow);
  const [dow, setDow] = useState<number>(isTrainingDay ? todayDow : 6);

  const hasAny = weekly.length > 0;
  const tabs: TabBarItem[] = DAY_META.map((d) => ({
    value: String(d.dow),
    label: d.label,
    highlighted: d.dow === todayDow,
  }));
  const meta = DAY_META.find((d) => d.dow === dow) ?? DAY_META[0];
  const series = perDay[dow] ?? [];

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-text m-0 text-[15px] font-semibold">Progressão de volume</h2>
        <span className="text-text-3 text-xs font-medium">carga · kg·reps</span>
      </div>

      {!hasAny ? (
        <EmptyAll />
      ) : (
        <>
          <div className="bg-surface border-border overflow-hidden rounded-xl border">
            <div className="border-border border-b px-4 py-3 sm:px-5 sm:py-4">
              <TabBar items={tabs} value={String(dow)} onChange={(v) => setDow(Number(v))} />
            </div>
            <div className="px-4 py-4 sm:px-5">
              <DayChart meta={meta} series={series} tokens={tokens} />
            </div>
          </div>

          <div className="bg-surface border-border overflow-hidden rounded-xl border">
            <div className="border-border flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5 sm:py-4">
              <h3 className="text-text m-0 text-[14px] font-semibold">Volume semanal</h3>
              <span className="text-text-3 text-xs font-medium">soma Dom → Sáb</span>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <WeeklyChart weekly={weekly} tokens={tokens} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function DayChart({
  meta,
  series,
  tokens,
}: {
  meta: (typeof DAY_META)[number];
  series: VolumePoint[];
  tokens: Palette;
}) {
  if (series.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <ChartHeading full={meta.full} split={meta.split} />
        <div className="text-text-3 py-10 text-center text-[13px]">
          Nenhuma sessão de {meta.full} registrada ainda.
          <br />
          Registre um treino na aba Workout para começar a acompanhar.
        </div>
      </div>
    );
  }

  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;
  const delta = prev ? pctDelta(last.volume, prev.volume) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <ChartHeading full={meta.full} split={meta.split} />
        <div className="shrink-0 text-right">
          <div className="text-text text-[22px] font-semibold leading-none tabular-nums">
            {BRL.format(Math.round(last.volume))}
          </div>
          {delta != null ? (
            <DeltaLabel delta={delta} suffix="vs. anterior" />
          ) : (
            <div className="text-text-3 mt-1 text-[11px] font-medium">1 sessão · registre mais</div>
          )}
        </div>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtShort}
              tick={{ fontSize: 11, fill: tokens.text3 }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tokens.text3 }}
              tickLine={false}
              axisLine={false}
              width={46}
              tickFormatter={(v) => BRL.format(Number(v))}
            />
            <Tooltip
              cursor={{ stroke: tokens.border, strokeWidth: 1 }}
              content={(p: TooltipProps<number, string>) => <PointTooltip {...p} kind="day" />}
            />
            <Line
              type="monotone"
              dataKey="volume"
              stroke={tokens.accent}
              strokeWidth={2}
              dot={{ r: series.length === 1 ? 5 : 3, fill: tokens.accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeeklyChart({ weekly, tokens }: { weekly: WeeklyPoint[]; tokens: Palette }) {
  const last = weekly[weekly.length - 1];
  const prev = weekly.length >= 2 ? weekly[weekly.length - 2] : null;
  const delta = prev ? pctDelta(last.volume, prev.volume) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Semana atual
          </div>
          <div className="text-text-2 mt-0.5 text-[12.5px] font-medium tabular-nums">
            desde {fmtShort(last.weekStart)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-text text-[22px] font-semibold leading-none tabular-nums">
            {BRL.format(Math.round(last.volume))}
          </div>
          {delta != null ? (
            <DeltaLabel delta={delta} suffix="vs. semana anterior" />
          ) : (
            <div className="text-text-3 mt-1 text-[11px] font-medium">1ª semana</div>
          )}
        </div>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={fmtShort}
              tick={{ fontSize: 11, fill: tokens.text3 }}
              tickLine={false}
              axisLine={false}
              minTickGap={12}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tokens.text3 }}
              tickLine={false}
              axisLine={false}
              width={46}
              tickFormatter={(v) => BRL.format(Number(v))}
            />
            <Tooltip
              cursor={{ fill: tokens.surface2 }}
              content={(p: TooltipProps<number, string>) => <PointTooltip {...p} kind="week" />}
            />
            <Bar dataKey="volume" fill={tokens.accent} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartHeading({ full, split }: { full: string; split: string }) {
  return (
    <div className="min-w-0">
      <div className="text-text text-[13.5px] font-semibold">{full}</div>
      <div className="text-text-3 truncate text-[11.5px] font-medium">{split}</div>
    </div>
  );
}

export function DeltaLabel({ delta, suffix }: { delta: number; suffix: string }) {
  const up = delta > 0;
  const down = delta < 0;
  return (
    <div
      className={cn(
        'mt-1 text-[11.5px] font-semibold tabular-nums',
        up && 'text-success',
        down && 'text-danger',
        !up && !down && 'text-text-3',
      )}
    >
      {up ? '+' : ''}
      {delta.toLocaleString('pt-BR')}% <span className="text-text-3 font-medium">{suffix}</span>
    </div>
  );
}

function PointTooltip({
  active,
  payload,
  kind,
}: TooltipProps<number, string> & { kind: 'day' | 'week' }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as VolumePoint & WeeklyPoint;
  const heading = kind === 'day' ? fmtLong(row.date) : `Semana de ${fmtShort(row.weekStart)}`;
  const count = kind === 'day' ? row.sets : row.sessions;
  const countLabel =
    kind === 'day'
      ? `${count} ${count === 1 ? 'série' : 'séries'}`
      : `${count} ${count === 1 ? 'sessão' : 'sessões'}`;
  return (
    <div className="bg-surface border-border rounded-lg border px-3 py-2 shadow-[var(--shadow-lg)]">
      <div className="text-text-2 text-[11px] font-medium">{heading}</div>
      <div className="text-text text-[15px] font-semibold tabular-nums">
        {BRL.format(Math.round(row.volume))}{' '}
        <span className="text-text-3 text-[11px] font-medium">kg·reps</span>
      </div>
      <div className="text-text-3 text-[11px] font-medium tabular-nums">{countLabel}</div>
    </div>
  );
}

function EmptyAll() {
  return (
    <div className="bg-surface border-border rounded-xl border px-6 py-12 text-center">
      <div className="text-text mb-1 text-base font-semibold">Sem treinos registrados ainda</div>
      <div className="text-text-3 mx-auto max-w-sm text-[13px]">
        Registre seus treinos na aba Workout para acompanhar a progressão de carga aqui.
      </div>
    </div>
  );
}
