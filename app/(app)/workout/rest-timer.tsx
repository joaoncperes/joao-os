'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

export function RestTimer({ lastCompletedAt }: { lastCompletedAt: string | null }) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!lastCompletedAt) return;
    const startMs = new Date(lastCompletedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastCompletedAt]);

  if (!lastCompletedAt) return null;

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const formatted = `${mm}:${ss.toString().padStart(2, '0')}`;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="bg-surface border-border text-text flex items-center gap-2 rounded-full border px-4 py-2 shadow-lg">
        <Timer className="text-text-3 h-4 w-4" />
        <span className="text-text-3 text-[11px] font-medium uppercase tracking-wide">
          Descanso
        </span>
        <span className="text-[14px] font-semibold tabular-nums">{formatted}</span>
      </div>
    </div>
  );
}
