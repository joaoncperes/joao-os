'use client';

import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';

const MIN_WIDTH_PCT = 10;
const MAX_WIDTH_PCT = 100;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ResizableImageView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? '';
  const attrWidth = (node.attrs.width as number | null) ?? 100;

  const [liveWidth, setLiveWidth] = useState<number>(attrWidth);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startPct: number; startPx: number } | null>(null);

  useEffect(() => {
    if (!dragRef.current) setLiveWidth(attrWidth);
  }, [attrWidth]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const startPx = wrapper.getBoundingClientRect().width;
    if (startPx <= 0) return;
    dragRef.current = { startX: e.clientX, startPct: liveWidth, startPx };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaPx = e.clientX - drag.startX;
    const next = clamp(
      ((drag.startPx + deltaPx) * drag.startPct) / drag.startPx,
      MIN_WIDTH_PCT,
      MAX_WIDTH_PCT,
    );
    setLiveWidth(next);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture may have already been released
    }
    updateAttributes({ width: Math.round(liveWidth) });
  }

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapperRef}
      className={cn(
        'relative',
        selected && 'rounded-lg ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
      style={{ width: `${liveWidth}%`, maxWidth: '100%' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- live percent-resize doesn't fit next/image's fixed-dimension model */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block w-full"
        style={{ height: 'auto' }}
      />
      {selected ? (
        <div
          role="separator"
          aria-label="Resize image"
          aria-orientation="vertical"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="absolute top-1/2 -right-1.5 z-20 h-10 w-2.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-accent shadow-lg ring-2 ring-surface"
        />
      ) : null}
    </NodeViewWrapper>
  );
}
