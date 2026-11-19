import type { ReactNode } from 'react';
import { BottomNav } from '@/components/bottom-nav';
import { Sidebar } from '@/components/sidebar';
import { requireAuth } from '@/lib/auth-gate';

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  await requireAuth('complete');

  return (
    <div className="bg-background flex min-h-screen flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-6 sm:pb-8 sm:pt-[calc(env(safe-area-inset-top)+2rem)] lg:px-14 lg:pb-20 lg:pt-[calc(env(safe-area-inset-top)+2.5rem)]">
          {children}
        </main>
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
