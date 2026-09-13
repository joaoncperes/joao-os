'use client';

import { useId, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { CircleAlert } from 'lucide-react';

export function HabitRecoveryIndicator({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <Popover.Root open={open} onOpenChange={(next, details) => {
      // Focus already opens the explanation; the following click keeps it open.
      if (!next && details.reason === 'trigger-press') return;
      setOpen(next);
    }}>
      <Popover.Trigger
        aria-label={`Never miss twice: ${title}`}
        aria-describedby={descriptionId}
        onFocus={() => setOpen(true)}
        className="text-danger grid h-6 w-6 shrink-0 place-items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        <CircleAlert className="h-4 w-4" aria-hidden="true" />
      </Popover.Trigger>
      <span id={descriptionId} className="sr-only">Ontem ficou pendente. Retome hoje.</span>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={6} className="z-50">
          <Popover.Popup initialFocus={false} finalFocus={false} className="bg-surface text-text border-border max-w-[min(260px,calc(100vw-24px))] rounded-lg border p-3 text-sm shadow-lg">
            <Popover.Title className="font-semibold">Never miss twice</Popover.Title>
            <Popover.Description className="text-text-2 mt-1">Ontem ficou pendente. Retome hoje.</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
