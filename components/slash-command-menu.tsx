'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import type {
  SlashMenuProps,
  SlashCommandMenuRef,
} from '@/lib/tiptap-slash-command';

// The "/" menu popup. ReactRenderer mounts this and the SlashCommand extension
// forwards arrow/enter keys via the imperative handle below. Visuals reuse the
// app's surface/accent design tokens (same as command-palette / others-popover).
export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashMenuProps>(
  function SlashCommandMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Re-filtering resets the highlight to the top.
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Keep the highlighted row in view as you arrow through.
    useLayoutEffect(() => {
      const node = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
      node?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (items.length === 0) return false;
          if (event.key === 'ArrowUp') {
            setSelectedIndex((i) => (i + items.length - 1) % items.length);
            return true;
          }
          if (event.key === 'ArrowDown') {
            setSelectedIndex((i) => (i + 1) % items.length);
            return true;
          }
          if (event.key === 'Enter') {
            const item = items[selectedIndex];
            if (item) command(item);
            return true;
          }
          return false;
        },
      }),
      [items, selectedIndex, command],
    );

    if (items.length === 0) {
      return (
        <div className="bg-surface border-border w-72 rounded-xl border p-2 shadow-lg">
          <div className="text-text-3 px-2 py-1.5 text-[13px]">No matching blocks</div>
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        role="listbox"
        className="bg-surface border-border max-h-80 w-72 overflow-y-auto rounded-xl border p-1 shadow-lg"
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const active = index === selectedIndex;
          return (
            <button
              key={item.title}
              type="button"
              role="option"
              aria-selected={active}
              // mousedown + preventDefault keeps the editor focused/selected so
              // deleteRange(range) targets the right spot (click would blur first).
              onMouseDown={(e) => {
                e.preventDefault();
                command(item);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                active ? 'bg-accent-soft text-accent' : 'text-text hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                  active ? 'border-accent/30 bg-accent/10' : 'border-border bg-surface-2',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{item.title}</span>
                {item.description ? (
                  <span className="text-text-3 block truncate text-[12px]">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
