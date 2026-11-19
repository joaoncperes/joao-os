'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Target, Dumbbell, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/workout', label: 'Treino', icon: Dumbbell },
  { href: '/books', label: 'Livros', icon: BookOpen },
] as const;

interface Props {
  pendingWorkout?: boolean;
}

export function BottomNav({ pendingWorkout }: Props = {}) {
  const pathname = usePathname();

  return (
    <nav
      className="bg-surface/95 supports-[backdrop-filter]:bg-surface/80 fixed bottom-0 left-0 right-0 z-30 backdrop-blur shadow-[0_-1px_0_0_var(--border)] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-3 px-2 pt-2 pb-1">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const Icon = t.icon;
          const pending = t.href === '/workout' && pendingWorkout;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'mx-auto flex h-14 w-full max-w-[88px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors',
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-3 hover:text-text active:bg-surface-2',
                )}
              >
                <span className="relative flex">
                  <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.25 : 2} />
                  {pending && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span
                        aria-hidden
                        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-75"
                      />
                      <span
                        aria-label="pending"
                        className="relative inline-flex h-3 w-3 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]"
                      />
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold tracking-[0.06em] uppercase">
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
