'use client';

import { useCallback } from 'react';
import { saveArticleContent } from '@/app/(app)/blog/actions';
import type { TipTapDoc } from '@/lib/supabase/types';
import {
  NotesEditor,
  type NotesEditorSaveResult,
  type NotesEditorUploadResult,
} from '@/components/notes-editor';

interface Props {
  articleId: string;
  initialContent: TipTapDoc;
  initialMd: string;
}

export function ArticleContentEditor({ articleId, initialContent, initialMd }: Props) {
  const onSave = useCallback(
    async (json: TipTapDoc, md: string): Promise<NotesEditorSaveResult> => {
      // Stringify the doc — same wire-format gotcha as book notes (React Flight
      // can drop ProseMirror's null-proto attrs during transport).
      const res = await saveArticleContent({
        articleId,
        contentJsonString: JSON.stringify(json),
        contentMd: md,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    [articleId],
  );

  const onUploadImage = useCallback(
    async (file: File): Promise<NotesEditorUploadResult> => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('articleId', articleId);
      try {
        const res = await fetch('/api/blog/upload-image', {
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
    [articleId],
  );

  return (
    <NotesEditor
      markdownMode
      initialContent={initialContent}
      initialMarkdown={initialMd}
      placeholder="Write your article…"
      onSave={onSave}
      onUploadImage={onUploadImage}
    />
  );
}
