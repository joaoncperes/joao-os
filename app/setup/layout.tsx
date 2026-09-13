import type { ReactNode } from 'react';
import { requireAuth } from '@/lib/auth-gate';

export default async function SetupLayout({ children }: { children: ReactNode }) {
  await requireAuth('incomplete');
  return (
    <div className="min-h-screen flex flex-col px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl flex-1">{children}</div>
    </div>
  );
}
