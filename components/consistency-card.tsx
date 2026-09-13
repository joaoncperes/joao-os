'use client';

import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { loadConsistency } from '@/app/(app)/today/consistency-actions';
import { consistencyGrade, type ConsistencyScore } from '@/lib/consistency';
import { formatConsistencyPercent } from '@/lib/consistency-display';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const ConsistencyChart = lazy(() => import('./consistency-chart'));
const grades = {
  darkGreen: { className: 'text-green-50 bg-green-900 dark:bg-green-950', label: 'Excelente' },
  green: { className: 'text-green-700 bg-green-500/10 dark:text-green-400', label: 'Bom' },
  yellow: { className: 'text-yellow-700 bg-yellow-500/10 dark:text-yellow-400', label: 'Regular' },
  orange: { className: 'text-orange-700 bg-orange-500/10 dark:text-orange-400', label: 'Atenção' },
  red: { className: 'text-red-700 bg-red-500/10 dark:text-red-400', label: 'Precisa melhorar' },
  empty: { className: 'text-text-3 bg-surface-2', label: 'Sem hábitos no período' },
};

function Score({ score, days }: { score: ConsistencyScore; days: number }) {
  const grade = grades[consistencyGrade(score.index)];
  return (
    <DialogTrigger className="border-border hover:bg-surface-2 focus-visible:ring-accent flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 sm:p-4" aria-label={`Ver evolução do índice dos últimos ${days} dias: ${formatConsistencyPercent(score.index)}`}>
      <span className="text-text-3 text-xs font-medium">Últimos {days} dias</span>
      <span className={cn('whitespace-nowrap rounded-lg px-2 py-1 text-2xl font-semibold tabular-nums sm:px-2.5 sm:text-3xl', grade.className)}>{formatConsistencyPercent(score.index)}</span>
      <span className="text-text-2 text-xs">{grade.label}</span>
      <span className="text-text-3 text-xs tabular-nums">{score.completed} / {score.opportunities} conclusões possíveis</span>
    </DialogTrigger>
  );
}

function LoadError({ retry }: { retry: () => void }) {
  return <div role="alert" className="text-text-2 py-4 text-sm">Não foi possível carregar o índice. <button type="button" onClick={retry} className="text-accent underline">Tentar novamente</button></div>;
}

export function ConsistencyCard({ userId, today }: { userId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(90);
  const fetchData = async (period: number) => {
    const result = await loadConsistency(period);
    if (result.userId !== userId) throw new Error('A conta mudou. Atualize a página.');
    return result.points;
  };
  const summary = useQuery({
    queryKey: ['consistency', userId, today, 1],
    queryFn: () => fetchData(1),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const history = useQuery({
    queryKey: ['consistency', userId, today, days],
    queryFn: () => fetchData(days),
    enabled: open,
    refetchOnWindowFocus: true,
  });
  const current = summary.data?.[0];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <section aria-label="Consistency Index" className="bg-surface border-border rounded-xl border p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-text text-base font-semibold">Consistency Index</h2>
            <p className="text-text-3 mt-1 text-xs">Hábitos concluídos ÷ oportunidades no período, em % · inclui hoje</p>
          </div>
          <TrendingUp aria-hidden="true" className="text-text-3 h-5 w-5 shrink-0" />
        </div>
        {summary.isError ? <LoadError retry={() => void summary.refetch()} /> : current ? (
          <div className="grid grid-cols-2 gap-3" aria-live="polite" aria-busy={summary.isFetching}>
            <Score score={current.seven} days={7} />
            <Score score={current.thirty} days={30} />
          </div>
        ) : <p role="status" className="text-text-3 py-6 text-sm">Carregando índices…</p>}
        <p className="text-text-3 mt-3 text-xs">Verde escuro &gt;90% · Verde &gt;80–90% · Amarelo &gt;70–80% · Laranja &gt;60–70% · Vermelho ≤60%</p>
        <p className="text-text-3 mt-1 text-xs">Toque em um índice para ver a evolução.</p>
      </section>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-7">
          <DialogTitle>Consistency Index · Evolução</DialogTitle>
          <DialogDescription>Cada ponto mostra o percentual de conclusões sobre as oportunidades nos 7 ou 30 dias terminados naquela data. Apenas hábitos atualmente ativos, desde seu início.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2" aria-label="Período do gráfico">
          {[30, 90, 365].map((period) => <button key={period} type="button" aria-pressed={days === period} onClick={() => setDays(period)} className={cn('rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', days === period ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-2')}>{period} dias</button>)}
        </div>
        {open && (history.isError ? <LoadError retry={() => void history.refetch()} /> : history.data ? (
          <Suspense fallback={<p role="status">Carregando gráfico…</p>}>
            <ConsistencyChart points={history.data} />
          </Suspense>
        ) : <p role="status" className="text-text-3 py-20 text-center">Carregando histórico…</p>)}
      </DialogContent>
    </Dialog>
  );
}
