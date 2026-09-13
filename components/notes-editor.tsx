'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Markdown } from 'tiptap-markdown';
import { toast } from 'sonner';
import {
  Bold,
  Highlighter,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  Type,
  ListTodo,
  Undo,
  Redo,
  Minus,
  Database,
  Table as TableIcon,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';
import { tipTapToMarkdown } from '@/lib/tiptap-markdown';
import { ResizableImage } from '@/lib/tiptap-resizable-image';
import { DatabaseTable, createDatabaseTableContent } from '@/lib/tiptap-database-table';
import { HashtagHighlight } from '@/lib/tiptap-hashtag';
import { SlashCommand, type SlashItem } from '@/lib/tiptap-slash-command';
import { extractHashtags } from '@/lib/hashtags';
import type { TipTapDoc } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export type NotesEditorSaveResult = { ok: true } | { ok: false; error: string };
export type NotesEditorUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

interface Props {
  initialContent: TipTapDoc;
  placeholder?: string;
  onSave: (json: TipTapDoc, md: string) => Promise<NotesEditorSaveResult>;
  onUploadImage: (file: File) => Promise<NotesEditorUploadResult>;
  // Fired with the inline #hashtags found in the doc on every edit, so the
  // parent can show a live tag chip row. Optional — display only.
  onTagsChange?: (tags: string[]) => void;
  autosaveMs?: number;
  minHeight?: string;
  // Article/blog mode: parse `initialMarkdown` on load when there's no JSON
  // yet (the imported-from-markdown case), and drop the highlight/#hashtag
  // affordances since the public blog renders neither. Notes (Brain/Books)
  // keep the full feature set by leaving this off.
  markdownMode?: boolean;
  initialMarkdown?: string;
}

const DEFAULT_AUTOSAVE_MS = 1500;

function imageFilesFrom(list: FileList | null | undefined): File[] {
  if (!list || list.length === 0) return [];
  return Array.from(list).filter((f) => f.type.startsWith('image/'));
}

// Diagnostic: log every image node's attrs at save time so we can see
// from the browser console exactly what editor.getJSON() returned —
// helps narrow down whether a still-missing-src is a Tiptap state issue
// or a transport issue. Safe to leave in; not noisy unless you paste lots.
function logImagesOnSave(doc: TipTapDoc): void {
  const found: Array<{ type?: string; attrs?: Record<string, unknown> }> = [];
  const visit = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }): void => {
    if (node?.type === 'image') found.push({ type: node.type, attrs: node.attrs });
    const children = Array.isArray(node?.content) ? node.content : null;
    if (children) for (const c of children) visit(c as Parameters<typeof visit>[0]);
  };
  visit(doc as unknown as Parameters<typeof visit>[0]);
  if (found.length > 0) {
    console.log('[notes-editor] saving image nodes:', found);
  }
}

export function NotesEditor({
  initialContent,
  placeholder = 'Start writing your notes…',
  onSave,
  onUploadImage,
  onTagsChange,
  autosaveMs = DEFAULT_AUTOSAVE_MS,
  minHeight = '60vh',
  markdownMode = false,
  initialMarkdown,
}: Props) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const latest = useRef<{ json: TipTapDoc; md: string } | null>(null);
  // editorProps captures references at mount time, so route the upload
  // helper through a ref we keep synced as deps change.
  const uploadRef = useRef<((file: File) => void) | null>(null);
  // Keep the latest onTagsChange so the editor's onUpdate (captured at mount)
  // always calls the current callback.
  const tagsCbRef = useRef(onTagsChange);
  useEffect(() => {
    tagsCbRef.current = onTagsChange;
  }, [onTagsChange]);
  // The slash menu's "Image" item opens the same file picker as the toolbar.
  // That opener (onImageUpload) is defined after useEditor, so route it through
  // a ref kept in sync — same pattern as uploadRef / tagsCbRef above.
  const imagePickerRef = useRef<(() => void) | null>(null);

  const persist = useCallback(
    async (json: TipTapDoc, md: string) => {
      setSaving(true);
      const res = await onSave(json, md);
      setSaving(false);
      if (res.ok) {
        setSavedAt(new Date());
        setDirty(false);
      } else {
        toast.error(`Save failed: ${res.error}`);
      }
    },
    [onSave],
  );

  const scheduleSave = useCallback(
    (json: TipTapDoc, md: string) => {
      latest.current = { json, md };
      setDirty(true);
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        if (latest.current) {
          void persist(latest.current.json, latest.current.md);
        }
      }, autosaveMs);
    },
    [persist, autosaveMs],
  );

  // Slash-menu blocks. Each command deletes the typed "/query" first, then runs
  // a built-in chain (no custom commands — see lib/tiptap-slash-command). Mirrors
  // the toolbar's block actions; Database + To-do are notes-only (same gating as
  // the toolbar's database/highlight affordances).
  const slashItems = useMemo<SlashItem[]>(() => {
    const base: SlashItem[] = [
      {
        title: 'Text',
        description: 'Plain paragraph',
        icon: Type,
        keywords: ['paragraph', 'body', 'p'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setParagraph().run(),
      },
      {
        title: 'Heading 1',
        icon: Heading1,
        keywords: ['h1', 'title', 'big'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
      },
      {
        title: 'Heading 2',
        icon: Heading2,
        keywords: ['h2', 'subtitle'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
      },
      {
        title: 'Heading 3',
        icon: Heading3,
        keywords: ['h3'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
      },
      {
        title: 'Bullet List',
        icon: List,
        keywords: ['ul', 'unordered', 'bullets'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: 'Numbered List',
        icon: ListOrdered,
        keywords: ['ol', 'ordered', 'numbered'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: 'Quote',
        icon: Quote,
        keywords: ['blockquote', 'citation'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
      },
      {
        title: 'Code Block',
        icon: Code,
        keywords: ['codeblock', 'pre', 'snippet'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      },
      {
        title: 'Divider',
        icon: Minus,
        keywords: ['hr', 'horizontal', 'rule', 'separator'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
      },
      {
        title: 'Table',
        icon: TableIcon,
        keywords: ['grid', 'rows', 'columns'],
        command: ({ editor, range }) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        title: 'Image',
        icon: ImageIcon,
        keywords: ['photo', 'picture', 'upload'],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          imagePickerRef.current?.();
        },
      },
    ];

    if (markdownMode) return base;

    return [
      ...base,
      {
        title: 'To-do List',
        description: 'Track tasks with checkboxes',
        icon: ListTodo,
        keywords: ['task', 'todo', 'checkbox', 'checklist'],
        command: ({ editor, range }) =>
          editor.chain().focus().deleteRange(range).toggleTaskList().run(),
      },
      {
        title: 'Database',
        description: 'Notion-style typed table',
        icon: Database,
        keywords: ['table', 'notion', 'grid', 'typed'],
        command: ({ editor, range }) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(createDatabaseTableContent())
            .run(),
      },
    ];
  }, [markdownMode]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
      Typography,
      // Tables — available in both notes and blog mode. The custom serializer
      // (lib/tiptap-markdown.ts) emits GFM pipe tables for content_md.
      Table.configure({ resizable: true, cellMinWidth: 160 }),
      TableRow,
      TableHeader,
      TableCell,
      // Typed Notion-style database block (lib/tiptap-database-table). Stores
      // its columns/rows in the node's attrs → rides the content_json round-trip.
      DatabaseTable,
      // Notion-style "/" block menu. Items mirror the toolbar's block actions
      // and are gated by markdownMode (no Database/To-do on the blog).
      // eslint-disable-next-line react-hooks/refs -- item commands are deferred event handlers (run on click/Enter), never invoked during render; configure() only stores the array.
      SlashCommand.configure({ items: slashItems }),
      // Markdown mode loads/serializes markdown and drops highlight + the
      // #hashtag styling (neither renders on the blog). Notes mode keeps both,
      // plus checkbox task lists.
      ...(markdownMode
        ? [Markdown.configure({ html: false, transformPastedText: true, breaks: false })]
        : [Highlight, HashtagHighlight, TaskList, TaskItem.configure({ nested: true })]),
    ],
    // In markdown mode, hydrate from the raw markdown when there's no TipTap
    // JSON yet (the imported article). After the first save, content_json
    // exists and is used directly. The Markdown extension parses string content.
    content:
      markdownMode && !initialContent?.content?.length && initialMarkdown
        ? initialMarkdown
        : initialContent,
    immediatelyRender: false,
    editorProps: {
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => uploadRef.current?.(file));
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const dt = (event as DragEvent).dataTransfer;
        const files = imageFilesFrom(dt?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => uploadRef.current?.(file));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TipTapDoc;
      logImagesOnSave(json);
      const md = tipTapToMarkdown(json);
      scheduleSave(json, md);
      tagsCbRef.current?.(extractHashtags(md));
    },
  });

  // Flush on unmount or page hide.
  useEffect(() => {
    function flush() {
      if (saveTimer.current != null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (latest.current) {
        void persist(latest.current.json, latest.current.md);
        latest.current = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [persist]);

  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      const label = file.name || 'image';
      const toastId = toast.loading(`Uploading ${label}…`);
      try {
        const res = await onUploadImage(file);
        if (!res.ok) throw new Error(res.error);
        // Direct ProseMirror dispatch instead of editor.chain().setImage(...).
        // setImage routes through commands.insertContent → createNodeFromContent
        // → schema.nodeFromJSON, a path that has been observed to drop attrs
        // here. schema.nodes.image.create(...) builds the node straight from
        // the schema so src/alt land in node.attrs verifiably.
        const { schema, state, view } = editor;
        const imageType = schema.nodes.image;
        if (!imageType) throw new Error('Editor schema is missing the image node');
        const node = imageType.create({ src: res.url, alt: label });
        view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
        editor.commands.focus();
        toast.success('Image inserted', { id: toastId });
      } catch (e) {
        toast.error((e as Error).message, { id: toastId });
      }
    },
    [editor, onUploadImage],
  );

  // Keep the ref synced so paste/drop handlers always call the latest helper.
  useEffect(() => {
    uploadRef.current = (file) => {
      void uploadAndInsertImage(file);
    };
  }, [uploadAndInsertImage]);

  const onImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void uploadAndInsertImage(file);
    };
    input.click();
  }, [uploadAndInsertImage]);

  // Point the slash-menu image bridge at the latest picker opener.
  useEffect(() => {
    imagePickerRef.current = onImageUpload;
  }, [onImageUpload]);

  const onLinkPrompt = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const next = window.prompt('URL', previous ?? 'https://');
    if (next === null) return;
    if (next === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
  }, [editor]);

  if (!editor) {
    return <div className="bg-surface-2 h-64 animate-pulse rounded-xl" />;
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      <Toolbar
        editor={editor}
        onImageUpload={onImageUpload}
        onLinkPrompt={onLinkPrompt}
        showHighlight={!markdownMode}
        showDatabase={!markdownMode}
        showTaskList={!markdownMode}
      />
      <div className="bg-surface border-border min-w-0 rounded-xl border">
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className={cn(
            'tiptap-editor px-5 py-5 sm:px-7 sm:py-6 focus-visible:outline-none',
            '[&_h1]:text-text [&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-[26px] [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:leading-[1.15]',
            '[&_h2]:text-text [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.015em]',
            '[&_h3]:text-text [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-[16.5px] [&_h3]:font-semibold [&_h3]:tracking-[-0.01em]',
            '[&_p]:text-text [&_p]:my-2 [&_p]:text-[14.5px] [&_p]:leading-relaxed',
            '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7',
            '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7',
            '[&_li]:my-1 [&_li_p]:my-0',
            '[&_li>p]:my-0',
            '[&_blockquote]:text-text-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4',
            '[&_code]:bg-surface-2 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
            '[&_pre]:bg-surface-2 [&_pre]:my-4 [&_pre]:rounded-lg [&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:overflow-x-auto',
            '[&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0',
            '[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border',
            '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2',
            '[&_.brain-hashtag]:text-accent [&_.brain-hashtag]:font-medium',
            '[&_mark]:rounded-[3px] [&_mark]:bg-[#fde047] [&_mark]:px-1 [&_mark]:py-px [&_mark]:text-[#1c1917] [&_mark]:box-decoration-clone',
            '[&_hr]:border-border [&_hr]:my-6',
            '[&_table]:border-collapse [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:text-[14px]',
            '[&_th]:relative [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_th]:align-top',
            '[&_td]:relative [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-text [&_td]:align-top',
            '[&_th_p]:my-0 [&_td_p]:my-0',
            '[&_.selectedCell]:bg-accent-soft',
            '[&_.column-resize-handle]:absolute [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:-right-px [&_.column-resize-handle]:w-1 [&_.column-resize-handle]:bg-accent',
            '[&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_.is-editor-empty]:before:text-text-3 [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:h-0',
            '[&_.ProseMirror]:focus-visible:outline-none',
          )}
        />
      </div>
      <div className="text-text-3 px-1 text-[11.5px]" aria-live="polite">
        {saving
          ? 'Saving…'
          : dirty
          ? 'Unsaved changes…'
          : savedAt
          ? `Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Auto-saves as you type.'}
      </div>
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
  onImageUpload: () => void;
  onLinkPrompt: () => void;
  showHighlight: boolean;
  showDatabase: boolean;
  showTaskList: boolean;
}

function Toolbar({
  editor,
  onImageUpload,
  onLinkPrompt,
  showHighlight,
  showDatabase,
  showTaskList,
}: ToolbarProps) {
  return (
    <div className="bg-surface border-border sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 flex flex-wrap items-center gap-0.5 rounded-xl border px-1.5 py-1.5 shadow-sm">
      <ToolGroup>
        <ToolButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          icon={Heading1}
          label="Heading 1"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          label="Heading 2"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          icon={Heading3}
          label="Heading 3"
        />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={Bold}
          label="Bold"
        />
        {showHighlight ? (
          <ToolButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive('highlight')}
            icon={Highlighter}
            label="Highlight"
          />
        ) : null}
        <ToolButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={Italic}
          label="Italic"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          icon={Strikethrough}
          label="Strikethrough"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          icon={Code}
          label="Inline code"
        />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={List}
          label="Bullet list"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={ListOrdered}
          label="Numbered list"
        />
        {showTaskList ? (
          <ToolButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            icon={ListTodo}
            label="To-do list"
          />
        ) : null}
        <ToolButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon={Quote}
          label="Quote"
        />
        <ToolButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          label="Divider"
        />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          onClick={onLinkPrompt}
          active={editor.isActive('link')}
          icon={LinkIcon}
          label="Link"
        />
        <ToolButton onClick={onImageUpload} icon={ImageIcon} label="Image" />
        <ToolButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          active={editor.isActive('table')}
          icon={TableIcon}
          label="Insert table"
        />
        {showDatabase ? (
          <ToolButton
            onClick={() => editor.chain().focus().insertContent(createDatabaseTableContent()).run()}
            active={editor.isActive('databaseTable')}
            icon={Database}
            label="Insert database"
          />
        ) : null}
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          label="Undo"
          disabled={!editor.can().undo()}
        />
        <ToolButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          label="Redo"
          disabled={!editor.can().redo()}
        />
      </ToolGroup>

      {/* Contextual table controls — only while the caret is inside a table. */}
      {editor.isActive('table') ? (
        <>
          <Divider />
          <ToolGroup>
            <ToolButton
              onClick={() => editor.chain().focus().addRowBefore().run()}
              icon={ArrowUpToLine}
              label="Add row above"
            />
            <ToolButton
              onClick={() => editor.chain().focus().addRowAfter().run()}
              icon={ArrowDownToLine}
              label="Add row below"
            />
            <ToolButton
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              icon={ArrowLeftToLine}
              label="Add column left"
            />
            <ToolButton
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              icon={ArrowRightToLine}
              label="Add column right"
            />
            <ToolButton
              onClick={() => editor.chain().focus().deleteRow().run()}
              icon={Rows3}
              label="Delete row"
            />
            <ToolButton
              onClick={() => editor.chain().focus().deleteColumn().run()}
              icon={Columns3}
              label="Delete column"
            />
            <ToolButton
              onClick={() => editor.chain().focus().deleteTable().run()}
              icon={Trash2}
              label="Delete table"
            />
          </ToolGroup>
        </>
      ) : null}
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="bg-border mx-1 h-5 w-px" aria-hidden="true" />;
}

function ToolButton({
  onClick,
  active,
  icon: Icon,
  label,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-text-2 hover:bg-surface-2 hover:text-text',
        disabled && 'opacity-40 hover:bg-transparent',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
