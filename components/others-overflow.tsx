'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { Compass, Flower2, Library, PenLine, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type OthersItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

// Secondary destinations. Second Brain is a primary nav tab (see sidebar / bottom-nav).
export const OTHERS_ITEMS: OthersItem[] = [
  {
    href: '/identity',
    label: 'Identity',
    description: 'Values, standards, vision — the long arc.',
    icon: Compass,
  },
  {
    href: '/insights',
    label: 'Insights',
    description: 'Weekly habit grid + year heatmap.',
    icon: Sparkles,
  },
  {
    href: '/books',
    label: 'Books',
    description: 'Reading queue + per-book notes.',
    icon: Library,
  },
  {
    href: '/blog',
    label: 'Blog',
    description: 'Write, draft, and publish posts to example.com.',
    icon: PenLine,
  },
  {
    href: '/meditation',
    label: 'Meditation',
    description: 'Daily minutes — track your practice by weekday.',
    icon: Flower2,
  },
  {
    href: '/settings/notifications',
    label: 'Settings',
    description: 'Notifications, devices, daily reminders.',
    icon: Settings,
  },
];

const SETTINGS_PREFIX = '/settings';

export function isOthersPath(pathname: string): boolean {
  if (pathname === SETTINGS_PREFIX || pathname.startsWith(`${SETTINGS_PREFIX}/`)) {
    return true;
  }
  return OTHERS_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

// Shared list body for both Sheet (mobile) and Popover (desktop) variants.
function OthersList({
  onNavigate,
  density = 'comfortable',
}: {
  onNavigate?: () => void;
  density?: 'comfortable' | 'compact';
}) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {OTHERS_ITEMS.map((item) => {
        const Icon = item.icon;
        // Settings is special: any /settings/* route should highlight it,
        // not only the exact /settings/notifications href it points to.
        const isSettings = item.href.startsWith(`${SETTINGS_PREFIX}/`);
        const active = isSettings
          ? pathname === SETTINGS_PREFIX ||
            pathname.startsWith(`${SETTINGS_PREFIX}/`)
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-start gap-3 rounded-xl transition-colors',
                density === 'comfortable' ? 'px-3 py-3' : 'px-2.5 py-2.5',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-text hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex shrink-0 items-center justify-center rounded-lg',
                  density === 'comfortable' ? 'h-9 w-9' : 'h-8 w-8',
                  active ? 'bg-accent/15' : 'bg-surface-2',
                )}
              >
                <Icon
                  className={density === 'comfortable' ? 'h-[18px] w-[18px]' : 'h-4 w-4'}
                  strokeWidth={2}
                />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-text text-[14px] font-semibold tracking-[-0.005em]">
                  {item.label}
                </span>
                <span className="text-text-3 mt-0.5 text-[12px]">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface Props {
  trigger: ReactElement;
}

// Mobile bottom sheet variant.
export function OthersSheet({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as ReactElement<Record<string, unknown>>} />
      <SheetContent
        side="bottom"
        className="bg-surface rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader>
          <SheetTitle className="text-text">Others</SheetTitle>
          <SheetDescription className="text-text-3">
            Identity, Insights, Books, Blog, Meditation, Settings.
          </SheetDescription>
        </SheetHeader>
        <div className="px-2 pb-2">
          <OthersList onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Desktop anchored popover variant — floats to the right of the sidebar row.
export function OthersPopover({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={trigger as ReactElement<Record<string, unknown>>} />
      <Popover.Portal>
        <Popover.Positioner side="right" align="start" sideOffset={8}>
          <Popover.Popup
            className={cn(
              'bg-surface border-border z-50 w-[280px] rounded-xl border p-2 shadow-lg',
              'data-ending-style:opacity-0 data-starting-style:opacity-0',
              'transition-opacity duration-150',
            )}
          >
            <div className="px-2 pt-1.5 pb-1">
              <div className="text-text-3 text-[10px] font-semibold uppercase tracking-[0.08em]">
                Others
              </div>
            </div>
            <OthersList
              density="compact"
              onNavigate={() => setOpen(false)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
