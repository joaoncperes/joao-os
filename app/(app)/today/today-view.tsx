'use client';

import dynamic from 'next/dynamic';
import type { TodayClientProps } from './today-client';

// These controls need JavaScript to work. Avoid running their drag-and-drop,
// query and dialog render trees on the resource-constrained Worker as well.
const TodayClient = dynamic(() => import('./today-client').then((mod) => mod.TodayClient), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Loading Today" className="flex flex-col gap-7">
      <span className="text-text-3 text-sm">Loading Today…</span>
      <div aria-hidden="true" className="bg-surface-2 h-20 animate-pulse rounded-xl" />
      <div aria-hidden="true" className="bg-surface-2 h-64 animate-pulse rounded-xl" />
    </div>
  ),
});

export function TodayView(props: TodayClientProps) {
  return <TodayClient {...props} />;
}
