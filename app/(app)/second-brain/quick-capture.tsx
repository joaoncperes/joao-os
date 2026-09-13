'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createNote } from './actions';

interface Props {
  placeholder?: string;
  autoFocus?: boolean;
  rows?: number;
  onSaved?: 'open' | 'stay';
  folderId?: string | null;
}

export function QuickCapture({
  placeholder = 'Capture uma ideia, insight, citação… ⌘+Enter para salvar.',
  autoFocus = false,
  rows = 3,
  onSaved = 'stay',
  folderId = null,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    startTransition(async () => {
      const res = await createNote({
        folderId,
        content_md: trimmed,
        source: 'quick_capture',
      });
      if (!res.ok) {
        toast.error(`Não consegui salvar: ${res.error}`);
        return;
      }
      setText('');
      if (onSaved === 'open') {
        router.push(`/second-brain/notes/${res.data.id}`);
      } else {
        toast.success(folderId ? 'Salvo na pasta.' : 'Salvo na Inbox.');
        router.refresh();
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const disabled = pending || text.trim().length === 0;

  return (
    <div className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-3 shadow-sm">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          'text-text placeholder:text-text-3 w-full resize-none bg-transparent px-2 py-1.5 text-[14.5px] leading-relaxed focus-visible:outline-none',
        )}
      />
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-text-3 text-[11.5px]">
          {folderId
            ? 'Vai para a pasta atual.'
            : 'Vai para a Inbox e fica esperando classificação.'}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            disabled
              ? 'bg-surface-2 text-text-3 cursor-not-allowed'
              : 'bg-accent text-bg hover:bg-accent/90',
          )}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          Capturar
        </button>
      </div>
    </div>
  );
}
