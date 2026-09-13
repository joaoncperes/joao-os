'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Archive as ArchiveIcon,
  CheckCircle2,
  LayoutGrid,
  Library,
  MoreHorizontal,
  RotateCcw,
  Table2,
  Trash2,
} from 'lucide-react';
import { QuickCapture } from '../../quick-capture';
import { NoteCard } from '../../note-card';
import {
  archiveFolder,
  completeProject,
  deleteFolder,
  renameFolder,
  reopenProject,
  restoreFolder,
  setFolderView,
} from '../../actions';
import {
  LIFE_AREA_ICON,
  PARA_CATEGORY_LABEL,
} from '@/lib/second-brain/display';
import type { Folder, FolderColumn, FolderDefaultView } from '@/lib/supabase/types';
import { normalizeViewConfig } from '@/lib/second-brain/table-view';
import { FolderTable } from './table/folder-table';
import type { FolderRowData } from './table/types';
import { cn } from '@/lib/utils';

interface Props {
  folder: Folder;
  notes: FolderRowData[];
  columns: FolderColumn[];
  initialView: FolderDefaultView;
}

export function FolderDetailClient({ folder, notes, columns, initialView }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(folder.title);
  const [description, setDescription] = useState(folder.description ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<FolderDefaultView>(initialView);

  function toggleView(next: FolderDefaultView) {
    if (next === view) return;
    const prev = view;
    setView(next);
    startTransition(async () => {
      const res = await setFolderView(folder.id, next);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        setView(prev);
      }
    });
  }

  const Icon = folder.kind === 'books'
    ? Library
    : folder.life_area
      ? LIFE_AREA_ICON[folder.life_area]
      : null;

  const backHref = `/second-brain/${folder.para_category}`;
  const backLabel = PARA_CATEGORY_LABEL[folder.para_category];

  function handleRename() {
    const t = title.trim();
    if (!t) {
      toast.error('Título não pode ser vazio.');
      return;
    }
    startTransition(async () => {
      const res = await renameFolder({
        folderId: folder.id,
        title: t,
        description: description.trim() || null,
      });
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      setRenaming(false);
      router.refresh();
    });
  }

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await archiveFolder(folder.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      toast.success('Pasta movida para Archive.');
      router.push('/second-brain/archive');
    });
  }

  function handleRestore() {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await restoreFolder(folder.id, 'resources');
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      toast.success('Restaurada em Resources.');
      router.push('/second-brain/resources');
    });
  }

  function handleComplete() {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await completeProject(folder.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      toast.success('Projeto concluído ✅');
      router.push('/second-brain/archive');
    });
  }

  function handleReopen() {
    setMenuOpen(false);
    startTransition(async () => {
      const res = await reopenProject(folder.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      toast.success('Projeto reaberto.');
      router.push('/second-brain/projects');
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm('Apagar essa pasta? As notas dentro voltam para a Inbox.')) return;
    startTransition(async () => {
      const res = await deleteFolder(folder.id);
      if (!res.ok) {
        toast.error(`Falha: ${res.error}`);
        return;
      }
      router.push(backHref);
    });
  }

  // Special-case: Books folder deep-links to /books.
  if (folder.kind === 'books') {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href={backHref}
          className="text-text-3 hover:text-text flex w-fit items-center gap-1 text-[12px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <div className="bg-surface border-border flex flex-col items-start gap-4 rounded-2xl border p-6">
          <span className="bg-accent-soft text-accent flex h-12 w-12 items-center justify-center rounded-xl">
            <Library className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-text text-[22px] font-semibold tracking-[-0.015em]">
              Books
            </h1>
            <p className="text-text-2 mt-2 max-w-prose text-[13.5px] leading-relaxed">
              Sua biblioteca de leituras com prioridade, categorias, ratings e notas
              por livro tem uma área dedicada — abre lá pra ver tudo.
            </p>
          </div>
          <Link
            href="/books"
            className="bg-accent text-bg hover:bg-accent/90 flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors"
          >
            Abrir Books
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={backHref}
          className="text-text-3 hover:text-text flex items-center gap-1 text-[12px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={pending}
            className="text-text-3 hover:text-text hover:bg-surface-2 rounded-md p-1.5 transition-colors"
            aria-label="Mais ações"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="bg-surface border-border absolute right-0 z-10 mt-1 w-48 rounded-xl border p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setRenaming(true);
                  setMenuOpen(false);
                }}
                className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
              >
                Renomear
              </button>
              {folder.para_category === 'projects' ? (
                <>
                  <button
                    type="button"
                    onClick={handleComplete}
                    className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Concluir projeto
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
                  >
                    <ArchiveIcon className="h-3.5 w-3.5" />
                    Mover para Archive
                  </button>
                </>
              ) : folder.para_category === 'archive' && folder.status === 'completed' ? (
                <button
                  type="button"
                  onClick={handleReopen}
                  className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reabrir projeto (→ Projects)
                </button>
              ) : folder.para_category === 'archive' ? (
                <button
                  type="button"
                  onClick={handleRestore}
                  className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
                >
                  Restaurar (→ Resources)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="text-text hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]"
                >
                  <ArchiveIcon className="h-3.5 w-3.5" />
                  Mover para Archive
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          {renaming ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRename();
                }
                if (e.key === 'Escape') {
                  setTitle(folder.title);
                  setDescription(folder.description ?? '');
                  setRenaming(false);
                }
              }}
              autoFocus
              className="text-text w-full bg-transparent text-[24px] font-semibold tracking-[-0.015em] focus-visible:outline-none"
            />
          ) : (
            <h1 className="text-text text-[24px] font-semibold tracking-[-0.015em]">
              {folder.title}
            </h1>
          )}
        </div>
        {renaming ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              rows={2}
              className="bg-surface-2 text-text placeholder:text-text-3 resize-none rounded-md px-3 py-2 text-[13px] focus-visible:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTitle(folder.title);
                  setDescription(folder.description ?? '');
                  setRenaming(false);
                }}
                disabled={pending}
                className="text-text-3 hover:text-text rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={pending || !title.trim()}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                  pending || !title.trim()
                    ? 'bg-surface-2 text-text-3 cursor-not-allowed'
                    : 'bg-accent text-bg hover:bg-accent/90',
                )}
              >
                Salvar
              </button>
            </div>
          </div>
        ) : folder.description ? (
          <p className="text-text-2 text-[13.5px] leading-relaxed">{folder.description}</p>
        ) : null}
      </header>

      <QuickCapture
        placeholder={`Capture algo em ${folder.title.toLowerCase()}…`}
        folderId={folder.id}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-text text-[14px] font-semibold tracking-[-0.005em]">
            Notas {notes.length > 0 ? `· ${notes.length}` : ''}
          </h2>
          <div className="bg-surface border-border inline-flex gap-0.5 rounded-[10px] border p-0.5">
            <button
              type="button"
              onClick={() => toggleView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Visualização em grade"
              className={cn(
                'flex items-center justify-center rounded-md p-1.5 transition-colors',
                view === 'grid' ? 'bg-accent text-bg' : 'text-text-3 hover:bg-surface-2',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleView('table')}
              aria-pressed={view === 'table'}
              aria-label="Visualização em tabela"
              className={cn(
                'flex items-center justify-center rounded-md p-1.5 transition-colors',
                view === 'table' ? 'bg-accent text-bg' : 'text-text-3 hover:bg-surface-2',
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {view === 'table' ? (
          <FolderTable
            folderId={folder.id}
            columns={columns}
            rows={notes}
            initialView={normalizeViewConfig(folder.table_view)}
          />
        ) : notes.length === 0 ? (
          <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
            Sem notas nesta pasta ainda. Capture algo acima ⬆️
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
