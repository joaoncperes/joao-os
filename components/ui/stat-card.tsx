import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  bar?: { pct: number; tone?: 'accent' | 'success' | 'danger' };
  className?: string;
}

export function StatCard({ label, value, unit, trend, bar, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-surface border-border rounded-xl border px-4 py-3.5',
        className,
      )}
    >
      <div className="text-text-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="text-text text-[22px] font-semibold tabular-nums leading-none">
        {value}
        {unit ? <span className="text-text-3 ml-1 text-xs font-medium">{unit}</span> : null}
      </div>
      {trend ? (
        <div
          className={cn(
            'mt-1.5 text-[11.5px] font-medium',
            trend.dir === 'up' && 'text-success',
            trend.dir === 'down' && 'text-danger',
            trend.dir === 'flat' && 'text-text-3',
          )}
        >
          {trend.text}
        </div>
      ) : null}
      {bar ? (
        <div className="bg-surface-2 mt-2 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              bar.tone === 'success' && 'bg-success',
              bar.tone === 'danger' && 'bg-danger',
              (!bar.tone || bar.tone === 'accent') && 'bg-accent',
            )}
            style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
