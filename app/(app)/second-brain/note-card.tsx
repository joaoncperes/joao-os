import Link from 'next/link';
import { FileText, Mic } from 'lucide-react';
import type { NoteSource } from '@/lib/supabase/types';
import { TagChip } from '@/components/tag-chip';

export interface NoteCardData {
  id: string;
  title: string | null;
  content_md: string;
  source: NoteSource;
  tags: string[];
  updated_at: string;
}

export function NoteCard({ note }: { note: NoteCardData }) {
  const title =
    note.title?.trim() ||
    deriveTitleFromMd(note.content_md) ||
    '(sem título)';
  const preview = derivePreview(note.content_md);
  return (
    <li>
      <Link
        href={`/second-brain/notes/${note.id}`}
        className="bg-surface border-border hover:border-accent block rounded-2xl border p-4 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-text line-clamp-2 text-[14px] font-semibold leading-snug">
            {title}
          </h3>
          {note.source === 'voice' ? (
            <Mic className="text-text-3 h-3.5 w-3.5 shrink-0" />
          ) : (
            <FileText className="text-text-3 h-3.5 w-3.5 shrink-0" />
          )}
        </div>
        {preview ? (
          <p className="text-text-2 mt-2 line-clamp-3 text-[12.5px] leading-relaxed">
            {preview}
          </p>
        ) : null}
        {note.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {note.tags.map((t) => (
              <TagChip key={t} tag={t} size="sm" plain />
            ))}
          </div>
        ) : null}
      </Link>
    </li>
  );
}

export function deriveTitleFromMd(md: string): string | null {
  const trimmed = md.replace(/<[^>]+>/g, '').trim();
  if (!trimmed) return null;
  const headingMatch = trimmed.match(/^\s*#{1,6}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = trimmed.split('\n').find((l) => l.trim().length > 0) ?? '';
  return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine || null;
}

export function derivePreview(md: string): string {
  const trimmed = md.replace(/<[^>]+>/g, '').trim();
  if (!trimmed) return '';
  const headingMatch = trimmed.match(/^\s*#{1,6}\s+(.+)$/m);
  const body = headingMatch ? trimmed.replace(headingMatch[0], '').trim() : trimmed;
  return body.length > 180 ? `${body.slice(0, 180)}…` : body;
}
