'use client';

import { useCallback } from 'react';
import { saveBookNotes } from '@/app/(app)/books/actions';
import type { TipTapDoc } from '@/lib/supabase/types';
import {
  NotesEditor,
  type NotesEditorSaveResult,
  type NotesEditorUploadResult,
} from '@/components/notes-editor';

interface Props {
  bookId: string;
  initialContent: TipTapDoc;
  onTagsChange?: (tags: string[]) => void;
}

export function BookNotesEditor({ bookId, initialContent, onTagsChange }: Props) {
  const onSave = useCallback(
    async (json: TipTapDoc, md: string): Promise<NotesEditorSaveResult> => {
      // Stringify the doc so the server-action wire format is plain JSON text.
      // ProseMirror's attrs are Object.create(null) — React Flight can drop
      // non-enumerable / null-proto fields during structured-clone-ish encoding.
      const res = await saveBookNotes({
        bookId,
        contentJsonString: JSON.stringify(json),
        contentMd: md,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [bookId],
  );

  const onUploadImage = useCallback(
    async (file: File): Promise<NotesEditorUploadResult> => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bookId', bookId);
      try {
        const res = await fetch('/api/books/upload-image', {
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
    [bookId],
  );

  return (
    <NotesEditor
      initialContent={initialContent}
      onSave={onSave}
      onUploadImage={onUploadImage}
      onTagsChange={onTagsChange}
    />
  );
}
