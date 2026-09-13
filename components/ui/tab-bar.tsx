'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabBarItem {
  value: string;
  label: ReactNode;
  sub?: ReactNode;
  highlighted?: boolean; // e.g., today's day
}

interface TabBarProps {
  items: TabBarItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

export function TabBar({ items, value, onChange, className }: TabBarProps) {
  return (
    <div
      className={cn(
        'bg-surface border-border flex gap-0.5 rounded-[10px] border p-1',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2.5 text-center transition-colors',
              active
                ? 'bg-accent text-white shadow-[0_1px_2px_oklch(20%_0.02_250_/_0.06)]'
                : 'hover:bg-surface-2',
            )}
          >
            <span
              className={cn(
                'text-[14.5px] font-semibold tabular-nums leading-none',
                active ? 'text-white' : 'text-text',
              )}
            >
              {item.label}
            </span>
            {item.sub ? (
              <span
                className={cn(
                  'text-[10.5px] font-medium uppercase leading-none tracking-[0.06em]',
                  active
                    ? 'text-white/85'
                    : item.highlighted
                      ? 'text-accent'
                      : 'text-text-3',
                )}
              >
                {item.sub}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
