'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { createFolder } from './actions';
import type { ParaCategory } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export function CreateFolderInline({ paraCategory }: { paraCategory: ParaCategory }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    startTransition(async () => {
      const res = await createFolder({
        paraCategory,
        title: t,
        description: description.trim() || null,
      });
      if (!res.ok) {
        toast.error(`Não consegui criar: ${res.error}`);
        return;
      }
      setTitle('');
      setDescription('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border hover:border-accent hover:text-accent text-text-2 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-3.5 text-[13px] font-medium transition-colors"
      >
        <Plus className="h-4 w-4" />
        Nova pasta
      </button>
    );
  }

  return (
    <div className="bg-surface border-border flex flex-col gap-2 rounded-2xl border p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-text text-[13px] font-semibold">Nova pasta</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-text-3 hover:text-text"
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Título da pasta"
        autoFocus
        className="text-text placeholder:text-text-3 bg-surface-2 rounded-md px-3 py-2 text-[14px] focus-visible:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="text-text placeholder:text-text-3 bg-surface-2 resize-none rounded-md px-3 py-2 text-[13px] focus-visible:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || pending}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            !title.trim() || pending
              ? 'bg-surface-2 text-text-3 cursor-not-allowed'
              : 'bg-accent text-bg hover:bg-accent/90',
          )}
        >
          Criar
        </button>
      </div>
    </div>
  );
}
