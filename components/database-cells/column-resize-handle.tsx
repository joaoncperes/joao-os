'use client';

import { useRef } from 'react';

const MIN_WIDTH = 80;

// A drag grip on a column's right edge that reports the new width live during the
// drag (the caller persists it). Desktop only — hidden on small screens where a
// 6px grip is a poor touch target and the column menu covers the need. Pointer
// capture keeps the drag tracking even when the cursor leaves the grip.
export function ColumnResizeHandle({
  width,
  onResize,
}: {
  width: number | undefined;
  onResize: (px: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = e.currentTarget.closest('th') as HTMLElement | null;
        const w = width ?? (th ? Math.round(th.getBoundingClientRect().width) : MIN_WIDTH);
        start.current = { x: e.clientX, w };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const next = Math.max(MIN_WIDTH, start.current.w + (e.clientX - start.current.x));
        onResize(Math.round(next));
      }}
      onPointerUp={(e) => {
        start.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // pointer already released
        }
      }}
      className="hover:bg-accent/40 absolute top-0 right-0 z-20 hidden h-full w-1.5 cursor-col-resize touch-none select-none sm:block"
    />
  );
}
