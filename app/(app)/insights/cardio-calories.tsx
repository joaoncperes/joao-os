'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import type { CardioWeeklyRow } from '@/lib/supabase/types';
import {
  BRL,
  DeltaLabel,
  fmtShort,
  pctDelta,
  useTokens,
  type Palette,
} from './volume-progression';

interface CardioCaloriesProps {
  weekly: CardioWeeklyRow[];
}

export function CardioCalories({ weekly }: CardioCaloriesProps) {
  const tokens = useTokens();

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-text m-0 text-[15px] font-semibold">Cardio · calorias</h2>
        <span className="text-text-3 text-xs font-medium">soma semanal · kcal</span>
      </div>

      {weekly.length === 0 ? (
        <div className="bg-surface border-border rounded-xl border px-6 py-12 text-center">
          <div className="text-text mb-1 text-base font-semibold">
            Nenhum cardio registrado ainda
          </div>
          <div className="text-text-3 mx-auto max-w-sm text-[13px]">
            Registre cardio em qualquer dia na aba Cardio (Workout) para acompanhar as
            calorias por semana aqui.
          </div>
        </div>
      ) : (
        <div className="bg-surface border-border overflow-hidden rounded-xl border">
          <div className="border-border flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5 sm:py-4">
            <h3 className="text-text m-0 text-[14px] font-semibold">Calorias semanais</h3>
            <span className="text-text-3 text-xs font-medium">soma Dom → Sáb · kcal</span>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <CardioWeeklyChart weekly={weekly} tokens={tokens} />
          </div>
        </div>
      )}
    </section>
  );
}

function CardioWeeklyChart({ weekly, tokens }: { weekly: CardioWeeklyRow[]; tokens: Palette }) {
  const last = weekly[weekly.length - 1];
  const prev = weekly.length >= 2 ? weekly[weekly.length - 2] : null;
  const delta = prev ? pctDelta(last.kcal, prev.kcal) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Semana mais recente
          </div>
          <div className="text-text-2 mt-0.5 text-[12.5px] font-medium tabular-nums">
            desde {fmtShort(last.weekStart)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-text text-[22px] font-semibold leading-none tabular-nums">
            {BRL.format(Math.round(last.kcal))}{' '}
            <span className="text-text-3 text-[12px] font-medium">kcal</span>
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
              content={(p: TooltipProps<number, string>) => <CardioTooltip {...p} />}
            />
            <Bar dataKey="kcal" fill={tokens.accent} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CardioTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload as CardioWeeklyRow;
  return (
    <div className="bg-surface border-border rounded-lg border px-3 py-2 shadow-[var(--shadow-lg)]">
      <div className="text-text-2 text-[11px] font-medium">
        Semana de {fmtShort(row.weekStart)}
      </div>
      <div className="text-text text-[15px] font-semibold tabular-nums">
        {BRL.format(Math.round(row.kcal))}{' '}
        <span className="text-text-3 text-[11px] font-medium">kcal</span>
      </div>
      <div className="text-text-3 text-[11px] font-medium tabular-nums">
        {row.sessions} {row.sessions === 1 ? 'sessão' : 'sessões'}
      </div>
    </div>
  );
}
