import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  display?: boolean; // serif Fraunces
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  display,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        'mb-7 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-[240px]">
        {eyebrow ? (
          <div className="text-accent mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={cn(
            'text-text leading-[1.05] tracking-[-0.02em]',
            display
              ? 'font-display text-[36px] font-medium'
              : 'text-[30px] font-semibold',
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-text-3 mt-1.5 text-[13.5px]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
