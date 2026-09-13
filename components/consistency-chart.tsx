'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { ConsistencyPoint } from '@/lib/consistency';
import { formatConsistencyPercent } from '@/lib/consistency-display';

const formatDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

function PointTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = payload?.[0]?.payload as ConsistencyPoint | undefined;
  if (!active || !point) return null;
  return <div className="bg-surface border-border text-text rounded-lg border p-3 text-xs shadow-md">
    <p className="mb-2 font-semibold">{formatDate(point.date)}</p>
    {([['seven', 7], ['thirty', 30]] as const).map(([key, days]) => <p key={key}>{days} dias: {formatConsistencyPercent(point[key].index)} · {point[key].completed} / {point[key].opportunities}</p>)}
  </div>;
}

export default function ConsistencyChart({ points }: { points: ConsistencyPoint[] }) {
  if (!points.some((point) => point.thirty.index !== null)) {
    return <p className="text-text-3 py-20 text-center">Sem hábitos no período.</p>;
  }
  return <>
    <div className="h-[280px] min-w-0 w-full sm:h-[340px]" aria-label="Evolução dos índices móveis de 7 e 30 dias, em porcentagem">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} accessibilityLayer margin={{ top: 12, right: 12, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`} minTickGap={35} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={formatConsistencyPercent} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip content={<PointTooltip />} />
          <Legend />
          <Line type="linear" dataKey="seven.index" name="7 dias" stroke="#16a34a" strokeWidth={2.5} dot={points.length <= 30 ? { r: 2 } : { r: 1 }} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey="thirty.index" name="30 dias" stroke="#ca8a04" strokeDasharray="6 3" strokeWidth={2.5} dot={points.length <= 30 ? { r: 2 } : { r: 1 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="text-text-3 text-xs">As cores das linhas identificam os períodos. Dias sem oportunidades ficam sem ponto no gráfico.</p>
    <details className="text-text-2 text-xs">
      <summary className="cursor-pointer py-2">Ver dados em tabela</summary>
      <div className="max-h-52 overflow-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">Índices em porcentagem e conclusões sobre oportunidades em cada data</caption>
          <thead><tr><th scope="col" className="py-2">Data</th><th scope="col">7 dias</th><th scope="col">30 dias</th></tr></thead>
          <tbody>{[...points].reverse().map((point) => <tr key={point.date} className="border-border border-t"><th scope="row" className="py-2 font-normal">{formatDate(point.date)}</th>{(['seven', 'thirty'] as const).map((key) => <td key={key}>{formatConsistencyPercent(point[key].index)} ({point[key].completed}/{point[key].opportunities})</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </>;
}
