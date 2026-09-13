import Link from 'next/link';
import { ChevronRight, ArrowRight } from 'lucide-react';

export interface WeekPriorityLite {
  id: string;
  position: number;
  text: string;
}

// Today's "remember me" card: surfaces the current week's priorities (set on
// /week). Tapping opens /week. When none are set yet, it nudges Pedro to set
// them rather than hiding.
export function WeekPrioritiesCard({ priorities }: { priorities: WeekPriorityLite[] }) {
  return (
    <Link
      href="/week"
      className="bg-surface border-border hover:border-border-strong group flex flex-col gap-3 rounded-xl border px-5 py-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
          This week&apos;s priorities
        </div>
        <ChevronRight className="text-text-4 group-hover:text-text-2 h-3.5 w-3.5 transition-colors" />
      </div>

      {priorities.length > 0 ? (
        <div className="flex flex-col gap-2">
          {priorities.map((p, i) => (
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
      ) : (
        <div className="text-text-3 group-hover:text-text-2 flex items-center gap-1.5 text-[13px] transition-colors">
          Set your priorities for this week
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      )}
    </Link>
  );
}
