'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * GitHub-contributions-style year grid.
 *
 * `days` MUST start on a Sunday and be contiguous — index i maps to
 * (row = i % 7, col = floor(i / 7)), which is what `grid-flow-col` + 7 rows gives us.
 *
 * Levels: -1 = out of range (before the habit existed), 0 = nothing, 1..4 = intensity.
 */

export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const;

const CELL = 11; // px
const GAP = 3; // px
const COL_W = CELL + GAP;

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
  4: 'bg-heat-4',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Rows are Sun..Sat; GitHub labels Mon / Wed / Fri.
const ROW_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

function monthOf(dateISO: string): number {
  return Number(dateISO.slice(5, 7)) - 1;
}

interface HeatmapGridProps {
  days: string[];
  levels: number[];
  tooltips: string[];
  today: string;
  /** 'scale' = Less→More ramp (all habits); 'binary' = Not done / Done (single habit). */
  legend?: 'scale' | 'binary';
  className?: string;
}

export function HeatmapGrid({
  days,
  levels,
  tooltips,
  today,
  legend = 'scale',
  className,
}: HeatmapGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Land on today: the newest weeks are on the right edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  const cols = Math.ceil(days.length / 7);

  // Label a column when its month differs from the previous column's.
  const monthLabels: { col: number; label: string }[] = [];
  for (let c = 0; c < cols; c++) {
    const m = monthOf(days[c * 7]);
    const prev = c === 0 ? -1 : monthOf(days[(c - 1) * 7]);
    // Skip the first column if it only shows a sliver — its label would collide.
    if (m !== prev && !(c === 0 && monthOf(days[Math.min(6, days.length - 1)]) !== m)) {
      monthLabels.push({ col: c, label: MONTHS[m] });
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="flex w-max gap-2">
          {/* Weekday labels */}
          <div className="flex flex-col pt-[18px]" style={{ gap: GAP }}>
            {Array.from({ length: 7 }, (_, r) => (
              <div
                key={r}
                className="text-text-3 text-right text-[9px] font-medium"
                style={{ height: CELL, lineHeight: `${CELL}px`, width: 22 }}
              >
                {ROW_LABELS[r] ?? ''}
              </div>
            ))}
          </div>

          <div>
            {/* Month labels */}
            <div className="relative h-[18px]" style={{ width: cols * COL_W }}>
              {monthLabels.map((m) => (
                <span
                  key={m.col}
                  className="text-text-3 absolute top-0 text-[10px] font-medium"
                  style={{ left: m.col * COL_W }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Cells */}
            <div
              className="grid grid-flow-col grid-rows-7"
              style={{ gap: GAP }}
              role="img"
              aria-label={`Habit activity heatmap, ${days.length} days ending ${today}`}
            >
              {days.map((d, i) => {
                const level = levels[i];
                return (
                  <div
                    key={d}
                    title={tooltips[i]}
                    className={cn(
                      'rounded-[3px] transition-transform duration-100 hover:scale-[1.25]',
                      level < 0 ? 'bg-heat-0 opacity-40' : LEVEL_CLASS[level],
                      d === today && 'ring-text-3 ring-1',
                    )}
                    style={{ width: CELL, height: CELL }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="text-text-3 mt-3 flex items-center justify-end gap-1.5 text-[11px]">
        {legend === 'binary' ? (
          <>
            <span>Not done</span>
            <span className="bg-heat-0 rounded-[3px]" style={{ width: CELL, height: CELL }} />
            <span className="bg-heat-4 rounded-[3px]" style={{ width: CELL, height: CELL }} />
            <span>Done</span>
          </>
        ) : (
          <>
            <span>Less</span>
            {HEAT_LEVELS.map((l) => (
              <span
                key={l}
                className={cn('rounded-[3px]', LEVEL_CLASS[l])}
                style={{ width: CELL, height: CELL }}
              />
            ))}
            <span>More</span>
          </>
        )}
      </div>
    </div>
  );
}
