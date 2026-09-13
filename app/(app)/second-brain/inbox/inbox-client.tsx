'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Inbox as InboxIcon,
  Mic,
  Trash2,
} from 'lucide-react';
import { QuickCapture } from '../quick-capture';
import { FolderPicker } from '../folder-picker';
import { archiveNote, deleteNote, moveNoteToFolder } from '../actions';
import type { Folder, NoteSource } from '@/lib/supabase/types';
import { TagChip } from '@/components/tag-chip';
import { cn } from '@/lib/utils';

export interface InboxNote {
  id: string;
  title: string | null;
  content_md: string;
  source: NoteSource;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  initialNotes: InboxNote[];
  folders: Folder[];
  loadError: string | null;
}

export function InboxClient({ initialNotes, folders, loadError }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState<InboxNote[]>(initialNotes);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleMove(noteId: string, folderId: string | null) {
    setPendingId(noteId);
    startTransition(async () => {
      const res = await moveNoteToFolder(noteId, folderId);
      setPendingId(null);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      if (folderId) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        const target = folders.find((f) => f.id === folderId);
        toast.success(`Movido para ${target?.title ?? 'pasta'}.`);
      }
    });
  }

  function handleArchive(noteId: string) {
    setPendingId(noteId);
    startTransition(async () => {
      const res = await archiveNote(noteId);
      setPendingId(null);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success('Arquivado.');
    });
  }

  function handleDelete(noteId: string) {
    if (!confirm('Apagar essa nota? Não dá pra recuperar.')) return;
    setPendingId(noteId);
    startTransition(async () => {
      const res = await deleteNote(noteId);
      setPendingId(null);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    });
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <Link
          href="/second-brain"
          className="text-text-3 hover:text-text flex w-fit items-center gap-1 text-[12px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Second Brain
        </Link>
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft text-accent flex h-10 w-10 items-center justify-center rounded-xl">
            <InboxIcon className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="text-text text-[24px] font-semibold tracking-[-0.015em]">
              Inbox
            </h1>
            <span className="text-text-3 text-[12.5px]">
              {notes.length === 0
                ? 'Sem notas pendentes.'
                : `${notes.length} nota${notes.length === 1 ? '' : 's'} para classificar`}
            </span>
          </div>
        </div>
      </header>

      <QuickCapture autoFocus />

      {loadError ? (
        <div className="border-border bg-surface text-text-2 rounded-xl border px-4 py-3 text-[13px]">
          Não consegui carregar notas: {loadError}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <InboxCard
              key={note.id}
              note={note}
              folders={folders}
              pending={pendingId === note.id}
              onMove={(folderId) => handleMove(note.id, folderId)}
              onArchive={() => handleArchive(note.id)}
              onDelete={() => handleDelete(note.id)}
              onOpen={() => router.push(`/second-brain/notes/${note.id}`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxCard({
  note,
  folders,
  pending,
  onMove,
  onArchive,
  onDelete,
  onOpen,
}: {
  note: InboxNote;
  folders: Folder[];
  pending: boolean;
  onMove: (folderId: string | null) => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const title = derivedTitle(note);
  const preview = derivePreview(note);
  return (
    <li
      className={cn(
        'bg-surface border-border flex flex-col gap-3 rounded-2xl border p-4 transition-opacity',
        pending && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="text-left"
        aria-label="Abrir nota no editor"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-text text-[14.5px] font-semibold">{title}</span>
            {preview ? (
              <span className="text-text-2 mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed">
                {preview}
              </span>
            ) : null}
          </div>
          {note.source === 'voice' ? (
            <span
              className="bg-surface-2 text-text-3 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]"
              title="Capturada por voz"
            >
              <Mic className="h-3 w-3" />
              voz
            </span>
          ) : null}
        </div>
      </button>

      {note.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((t) => (
            <TagChip key={t} tag={t} size="sm" plain />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <FolderPicker
          folders={folders}
          value={null}
          onChange={onMove}
          disabled={pending}
          label="Classificar:"
          allowInbox={false}
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onOpen}
          disabled={pending}
          className="text-text-2 hover:text-text flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40"
        >
          Abrir
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          className="text-text-3 hover:text-text px-2 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40"
          title="Arquivar"
        >
          Arquivar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-text-3 hover:text-red-500 px-1.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40"
          title="Apagar"
          aria-label="Apagar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
      Tudo classificado. Capture algo novo acima ⬆️
    </div>
  );
}

function derivedTitle(note: InboxNote): string {
  if (note.title?.trim()) return note.title.trim();
  const md = note.content_md.replace(/<[^>]+>/g, '').trim();
  if (!md) return '(sem conteúdo)';
  const headingMatch = md.match(/^\s*#{1,6}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = md.split('\n').find((l) => l.trim().length > 0) ?? '';
  return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
}

function derivePreview(note: InboxNote): string {
  const md = note.content_md.replace(/<[^>]+>/g, '').trim();
  if (!md) return '';
  const headingMatch = md.match(/^\s*#{1,6}\s+(.+)$/m);
  const body = headingMatch
    ? md.replace(headingMatch[0], '').trim()
    : md;
  return body.length > 240 ? `${body.slice(0, 240)}…` : body;
}
