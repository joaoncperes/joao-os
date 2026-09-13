'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Archive as ArchiveIcon, Trash2 } from 'lucide-react';
import {
  NotesEditor,
  type NotesEditorSaveResult,
  type NotesEditorUploadResult,
} from '@/components/notes-editor';
import { FolderPicker } from '../../folder-picker';
import {
  archiveNote,
  deleteNote,
  moveNoteToFolder,
  saveNote,
  updateNoteTitle,
} from '../../actions';
import type { Folder, Note, TipTapDoc } from '@/lib/supabase/types';
import { TagChip } from '@/components/tag-chip';

interface Props {
  note: Note;
  initialContent: TipTapDoc;
  folders: Folder[];
}

const TITLE_DEBOUNCE_MS = 800;

export function NoteEditorClient({ note, initialContent, folders }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title ?? '');
  const [folderId, setFolderId] = useState<string | null>(note.folder_id);
  const [liveTags, setLiveTags] = useState<string[]>(note.tags ?? []);
  const [pending, startTransition] = useTransition();
  const titleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (title === (note.title ?? '')) return;
    if (titleTimer.current != null) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      void updateNoteTitle({ noteId: note.id, title: title.trim() || null });
    }, TITLE_DEBOUNCE_MS);
    return () => {
      if (titleTimer.current != null) window.clearTimeout(titleTimer.current);
    };
  }, [title, note.id, note.title]);

  const onSave = useCallback(
    async (json: TipTapDoc, md: string): Promise<NotesEditorSaveResult> => {
      const res = await saveNote({
        noteId: note.id,
        contentJsonString: JSON.stringify(json),
        contentMd: md,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [note.id],
  );

  const onUploadImage = useCallback(
    async (file: File): Promise<NotesEditorUploadResult> => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('noteId', note.id);
      try {
        const res = await fetch('/api/brain/upload-image', {
          method: 'POST',
          body: fd,
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          return { ok: false, error: json.error ?? 'Upload failed' };
        }
        return { ok: true, url: json.url };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
    [note.id],
  );

  function handleSetFolder(nextId: string | null) {
    setFolderId(nextId);
    startTransition(async () => {
      const res = await moveNoteToFolder(note.id, nextId);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      const target = nextId ? folders.find((f) => f.id === nextId) : null;
      toast.success(
        nextId
          ? `Movido para ${target?.title ?? 'pasta'}.`
          : 'Voltou para a Inbox.',
      );
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const res = await archiveNote(note.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      toast.success('Nota arquivada.');
      router.push('/second-brain');
    });
  }

  function handleDelete() {
    if (!confirm('Apagar essa nota? Não dá pra recuperar.')) return;
    startTransition(async () => {
      const res = await deleteNote(note.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      router.push('/second-brain');
    });
  }

  const { backHref, backLabel } = useMemo(() => {
    if (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        return {
          backHref: `/second-brain/folders/${folder.id}`,
          backLabel: folder.title,
        };
      }
    }
    return { backHref: '/second-brain/inbox', backLabel: 'Inbox' };
  }, [folderId, folders]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-text-3 hover:text-text flex items-center gap-1 text-[12.5px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleArchive}
            disabled={pending}
            className="text-text-3 hover:text-text hover:bg-surface-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
            title="Arquivar"
          >
            <ArchiveIcon className="h-3.5 w-3.5" />
            Arquivar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-text-3 hover:bg-surface-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors hover:text-red-500 disabled:opacity-40"
            title="Apagar"
            aria-label="Apagar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sem título"
          className="text-text placeholder:text-text-3 w-full bg-transparent text-[28px] font-semibold leading-tight tracking-[-0.018em] focus-visible:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FolderPicker
            folders={folders}
            value={folderId}
            onChange={handleSetFolder}
            disabled={pending}
            label="Pasta:"
          />
        </div>
        {liveTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {liveTags.map((t) => (
              <TagChip key={t} tag={t} size="sm" />
            ))}
          </div>
        ) : null}
      </div>

      <NotesEditor
        initialContent={initialContent}
        onSave={onSave}
        onUploadImage={onUploadImage}
        onTagsChange={setLiveTags}
        placeholder="Comece a escrever…"
      />
    </div>
  );
}
