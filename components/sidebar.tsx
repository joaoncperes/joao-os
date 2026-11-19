'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  Dumbbell,
  BookOpen,
  Brain,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OthersPopover, isOthersPath } from '@/components/others-overflow';

const TABS = [
  { href: '/today', label: 'Today', icon: Home },
  { href: '/week', label: 'Week', icon: Calendar },
  { href: '/workout', label: 'Workout', icon: Dumbbell },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/second-brain', label: 'Second Brain', icon: Brain },
] as const;

interface Props {
  pendingJournal?: boolean;
  pendingWorkout?: boolean;
  pendingWeek?: boolean;
}

export function Sidebar({ pendingJournal, pendingWorkout, pendingWeek }: Props = {}) {
  const pathname = usePathname();
  const othersActive = isOthersPath(pathname);

  return (
    <aside className="bg-surface border-border hidden h-screen w-60 shrink-0 flex-col gap-7 border-r px-4 py-6 lg:sticky lg:top-0 lg:flex">
      <div className="px-2">
        <div className="text-text text-[15px] font-semibold tracking-[-0.01em]">João OS</div>
        <div className="text-text-3 mt-0.5 text-xs">Personal operating system</div>
      </div>
      <nav>
        <ul className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
            const Icon = t.icon;
            const pending =
              (t.href === '/journal' && pendingJournal) ||
              (t.href === '/workout' && pendingWorkout) ||
              (t.href === '/week' && pendingWeek);
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-2 hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <span className="relative flex shrink-0">
                    <Icon className="h-4 w-4" />
                    {pending && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span
                          aria-hidden
                          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-75"
                        />
                        <span
                          aria-label="pending"
                          className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--surface)]"
                        />
                      </span>
                    )}
                  </span>
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <OthersPopover
              trigger={
                <button
                  type="button"
                  aria-current={othersActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                    othersActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-2 hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <span className="relative flex shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left">Others</span>
                  <ChevronRight className="text-text-3 h-3.5 w-3.5" aria-hidden="true" />
                </button>
              }
            />
          </li>
        </ul>
      </nav>
      <Link
        href="/settings/notifications"
        className="border-border hover:bg-surface-2 mt-auto flex items-center gap-2.5 rounded-md border-t px-2.5 pt-3 pb-2 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="João"
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />

        <div className="leading-tight">
          <div className="text-text text-[13px] font-medium">João</div>
          <div className="text-text-3 text-[11.5px]">São Paulo, BR</div>
        </div>
      </Link>
    </aside>
  );
}
