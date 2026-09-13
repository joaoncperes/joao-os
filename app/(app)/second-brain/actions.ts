'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { extractHashtags } from '@/lib/hashtags';
import type {
  BrainSearchHit,
  ChipColor,
  ColumnType,
  FolderDefaultView,
  LifeArea,
  MultiSelectOption,
  NoteProperties,
  NoteSource,
  ParaCategory,
  ParaProjectStatus,
  PropertyValue,
  TipTapDoc,
} from '@/lib/supabase/types';
import {
  coerceValue,
  isEmptyValue,
  normalizeViewConfig,
  type TableViewConfig,
} from '@/lib/second-brain/table-view';

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const VALID_PARA: ParaCategory[] = ['projects', 'areas', 'resources', 'archive'];
const VALID_STATUS: ParaProjectStatus[] = ['active', 'on_hold', 'completed'];
const VALID_LIFE_AREAS: LifeArea[] = ['professional', 'health', 'personal'];
const VALID_SOURCES: NoteSource[] = ['manual', 'voice', 'quick_capture', 'import'];

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, userId: user.id };
}

function docFromText(text: string): TipTapDoc {
  const trimmed = text.trim();
  if (!trimmed) return { type: 'doc', content: [] };
  const paragraphs = trimmed.split(/\n\s*\n+/);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p.trim() }],
    })),
  };
}

function revalidateRoots() {
  revalidatePath('/second-brain');
  revalidatePath('/second-brain/inbox');
  revalidatePath('/second-brain/projects');
  revalidatePath('/second-brain/areas');
  revalidatePath('/second-brain/resources');
  revalidatePath('/second-brain/archive');
}

// =============================================================
// Folders
// =============================================================

export interface CreateFolderInput {
  paraCategory: ParaCategory;
  title: string;
  description?: string | null;
  parentFolderId?: string | null;
  lifeArea?: LifeArea | null;
  status?: ParaProjectStatus | null;
  dueDate?: string | null;
}

export async function createFolder(
  input: CreateFolderInput,
): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    if (!VALID_PARA.includes(input.paraCategory)) {
      return { ok: false, error: 'Invalid PARA category.' };
    }
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };

    const lifeArea = input.lifeArea && VALID_LIFE_AREAS.includes(input.lifeArea)
      ? input.lifeArea
      : null;
    const status = input.status && VALID_STATUS.includes(input.status)
      ? input.status
      : null;

    const { data: posRow } = await supabase
      .from('folders')
      .select('position')
      .eq('user_id', userId)
      .eq('para_category', input.paraCategory)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = ((posRow?.position ?? -1) as number) + 1;

    const { data, error } = await supabase
      .from('folders')
      .insert({
        user_id: userId,
        para_category: input.paraCategory,
        title,
        description: input.description?.trim() || null,
        parent_folder_id: input.parentFolderId ?? null,
        life_area: lifeArea,
        status,
        due_date: input.dueDate ?? null,
        position,
      })
      .select('id')
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'create failed' };
    }

    revalidateRoots();
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface RenameFolderInput {
  folderId: string;
  title?: string;
  description?: string | null;
}

export async function renameFolder(input: RenameFolderInput): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const update: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (!t) return { ok: false, error: 'Title cannot be empty.' };
      update.title = t;
    }
    if (input.description !== undefined) {
      update.description = input.description?.trim() || null;
    }
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from('folders')
      .update(update)
      .eq('id', input.folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${input.folderId}`);
    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface UpdateFolderMetaInput {
  folderId: string;
  status?: ParaProjectStatus | null;
  dueDate?: string | null;
  lifeArea?: LifeArea | null;
}

export async function updateFolderMeta(input: UpdateFolderMetaInput): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const update: Record<string, unknown> = {};
    if (input.status !== undefined) {
      update.status = input.status && VALID_STATUS.includes(input.status)
        ? input.status
        : null;
    }
    if (input.dueDate !== undefined) update.due_date = input.dueDate;
    if (input.lifeArea !== undefined) {
      update.life_area = input.lifeArea && VALID_LIFE_AREAS.includes(input.lifeArea)
        ? input.lifeArea
        : null;
    }
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase
      .from('folders')
      .update(update)
      .eq('id', input.folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${input.folderId}`);
    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moveFolder(
  folderId: string,
  paraCategory: ParaCategory,
): Promise<Result> {
  try {
    if (!VALID_PARA.includes(paraCategory)) {
      return { ok: false, error: 'Invalid PARA category.' };
    }
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('folders')
      .update({ para_category: paraCategory })
      .eq('id', folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${folderId}`);
    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function archiveFolder(folderId: string): Promise<Result> {
  return moveFolder(folderId, 'archive');
}

export async function restoreFolder(
  folderId: string,
  toCategory: ParaCategory = 'resources',
): Promise<Result> {
  return moveFolder(folderId, toCategory);
}

// Concluir um projeto: marca status='completed', carimba completed_at e move
// para o Archive global do PARA — tudo num único UPDATE atômico. O status
// persiste na row no Archive, então o filtro "Projetos concluídos" lá consegue
// distinguir projetos concluídos de pastas só arquivadas manualmente.
export async function completeProject(folderId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('folders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        para_category: 'archive',
      })
      .eq('id', folderId)
      .eq('user_id', userId)
      .eq('para_category', 'projects'); // guarda: só conclui projeto ativo
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${folderId}`);
    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Reabrir um projeto concluído: volta para Projects, limpa o carimbo e marca ativo.
export async function reopenProject(folderId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('folders')
      .update({
        status: 'active',
        completed_at: null,
        para_category: 'projects',
      })
      .eq('id', folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${folderId}`);
    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteFolder(folderId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    // Move any notes inside back to Inbox before deleting (defensive: ON DELETE SET NULL
    // would do this too, but being explicit keeps the revalidate accurate).
    await supabase
      .from('notes')
      .update({ folder_id: null })
      .eq('folder_id', folderId)
      .eq('user_id', userId);

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidateRoots();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reorderFolders(
  paraCategory: ParaCategory,
  orderedIds: string[],
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    // Sequential updates — small N (per-category folders); no transaction primitive in supabase-js.
    for (let i = 0; i < orderedIds.length; i += 1) {
      const { error } = await supabase
        .from('folders')
        .update({ position: i })
        .eq('id', orderedIds[i])
        .eq('user_id', userId)
        .eq('para_category', paraCategory);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(`/second-brain/${paraCategory}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================
// Notes
// =============================================================

export interface CreateNoteInput {
  folderId?: string | null;
  title?: string | null;
  content_md?: string;
  source?: NoteSource;
}

export async function createNote(
  input: CreateNoteInput = {},
): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    const source = input.source && VALID_SOURCES.includes(input.source)
      ? input.source
      : 'manual';
    const content_md = (input.content_md ?? '').trim();
    const content_json = docFromText(content_md);

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        folder_id: input.folderId ?? null,
        title: input.title?.trim() || null,
        content_json,
        content_md,
        tags: extractHashtags(content_md),
        source,
      })
      .select('id')
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'create failed' };
    }

    revalidatePath('/second-brain');
    revalidatePath('/second-brain/inbox');
    if (input.folderId) {
      revalidatePath(`/second-brain/folders/${input.folderId}`);
    }
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Duplicate a note (a folder table row): copies title/content/tags/properties
// into a new note in the same folder. Returns the new id.
export async function duplicateNote(noteId: string): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    const { data: src } = await supabase
      .from('notes')
      .select('folder_id, title, content_json, content_md, tags, source, properties')
      .eq('id', noteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!src) return { ok: false, error: 'Note not found.' };

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        folder_id: src.folder_id,
        title: src.title ? `${src.title} (copy)` : null,
        content_json: src.content_json,
        content_md: src.content_md,
        tags: src.tags ?? [],
        source: src.source,
        properties: src.properties ?? {},
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'duplicate failed' };

    revalidatePath('/second-brain');
    if (src.folder_id) revalidatePath(`/second-brain/folders/${src.folder_id}`);
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface SaveNoteInput {
  noteId: string;
  // Wire format: JSON-stringified TipTapDoc. Sending text avoids React Flight
  // edge cases with ProseMirror's null-proto attrs objects (which were
  // stripping image src/alt during transport on the Cloudflare Worker).
  contentJsonString: string;
  contentMd: string;
  title?: string | null;
}

export async function saveNote(input: SaveNoteInput): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    let contentJson: TipTapDoc;
    try {
      contentJson = JSON.parse(input.contentJsonString) as TipTapDoc;
    } catch (e) {
      return { ok: false, error: `Invalid contentJson: ${(e as Error).message}` };
    }

    const update: Record<string, unknown> = {
      content_json: contentJson,
      content_md: input.contentMd,
      tags: extractHashtags(input.contentMd),
    };
    if (input.title !== undefined) {
      update.title = input.title?.trim() || null;
    }

    const { error } = await supabase
      .from('notes')
      .update(update)
      .eq('id', input.noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/notes/${input.noteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface UpdateNoteTitleInput {
  noteId: string;
  title: string | null;
}

export async function updateNoteTitle(input: UpdateNoteTitleInput): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('notes')
      .update({ title: input.title?.trim() || null })
      .eq('id', input.noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/second-brain/notes/${input.noteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function moveNoteToFolder(
  noteId: string,
  folderId: string | null,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('notes')
      .update({ folder_id: folderId })
      .eq('id', noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/second-brain');
    revalidatePath('/second-brain/inbox');
    revalidatePath(`/second-brain/notes/${noteId}`);
    if (folderId) revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function archiveNote(noteId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/second-brain');
    revalidatePath('/second-brain/archive');
    revalidatePath(`/second-brain/notes/${noteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function restoreNote(noteId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('notes')
      .update({ archived_at: null })
      .eq('id', noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/second-brain');
    revalidatePath('/second-brain/archive');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteNote(noteId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/second-brain');
    revalidatePath('/second-brain/inbox');
    revalidatePath('/second-brain/archive');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================
// Folder-as-database — typed columns (migration 068). A folder = a database,
// each note = a row, note.title = the implicit "Name" column. folder_columns
// holds the per-folder schema; notes.properties holds per-note cell values.
// =============================================================

const VALID_COLUMN_TYPES: ColumnType[] = ['text', 'multi_select', 'date', 'url', 'checkbox'];
const VALID_VIEWS: FolderDefaultView[] = ['grid', 'table'];
const VALID_CHIP_COLORS: ChipColor[] = [
  'gray', 'red', 'orange', 'amber', 'yellow',
  'emerald', 'sky', 'violet', 'fuchsia', 'rose',
];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface AddColumnInput {
  folderId: string;
  name: string;
  type: ColumnType;
}

export async function addColumn(input: AddColumnInput): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    if (!VALID_COLUMN_TYPES.includes(input.type)) {
      return { ok: false, error: 'Invalid column type.' };
    }
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'Column name is required.' };

    // Verify the folder belongs to the user before attaching a column to it.
    const { data: folder } = await supabase
      .from('folders')
      .select('id')
      .eq('id', input.folderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!folder) return { ok: false, error: 'Folder not found.' };

    const { data: posRow } = await supabase
      .from('folder_columns')
      .select('position')
      .eq('folder_id', input.folderId)
      .eq('user_id', userId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = ((posRow?.position ?? -1) as number) + 1;

    const { data, error } = await supabase
      .from('folder_columns')
      .insert({
        user_id: userId,
        folder_id: input.folderId,
        name,
        type: input.type,
        options: [],
        position,
      })
      .select('id')
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'create failed' };
    }

    revalidatePath(`/second-brain/folders/${input.folderId}`);
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function renameColumn(
  folderId: string,
  columnId: string,
  name: string,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const t = name.trim();
    if (!t) return { ok: false, error: 'Column name cannot be empty.' };
    const { error } = await supabase
      .from('folder_columns')
      .update({ name: t })
      .eq('id', columnId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteColumn(folderId: string, columnId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('folder_columns')
      .delete()
      .eq('id', columnId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    // Strip the now-dead key from every note's properties in this folder.
    // Best-effort: the column is already gone and the renderer ignores stray keys.
    await supabase.rpc('note_strip_property', {
      p_folder_id: folderId,
      p_column_id: columnId,
    });

    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reorderColumns(
  folderId: string,
  orderedIds: string[],
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    // Sequential updates — small N; mirrors reorderFolders. The folder_id guard
    // stops a stray id from touching another folder's column.
    for (let i = 0; i < orderedIds.length; i += 1) {
      const { error } = await supabase
        .from('folder_columns')
        .update({ position: i })
        .eq('id', orderedIds[i])
        .eq('user_id', userId)
        .eq('folder_id', folderId);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Change a column's type and coerce each note's stored value to fit (mirrors the
// client + in-editor coercion via the shared coerceValue, so they always agree).
// Writes the whole `properties` object per note since the RPCs can't clear a
// single note's key.
export async function retypeColumn(
  folderId: string,
  columnId: string,
  toType: ColumnType,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    if (!VALID_COLUMN_TYPES.includes(toType)) {
      return { ok: false, error: 'Invalid column type.' };
    }

    const { data: col } = await supabase
      .from('folder_columns')
      .select('type, options')
      .eq('id', columnId)
      .eq('folder_id', folderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!col) return { ok: false, error: 'Column not found.' };
    const fromType = col.type as ColumnType;
    if (fromType === toType) return { ok: true };

    const { error: typeErr } = await supabase
      .from('folder_columns')
      .update({ type: toType })
      .eq('id', columnId)
      .eq('user_id', userId);
    if (typeErr) return { ok: false, error: typeErr.message };

    // Coerce every note's value for this column to the new type.
    const options = (col.options ?? []) as MultiSelectOption[];
    const { data: notes } = await supabase
      .from('notes')
      .select('id, properties')
      .eq('folder_id', folderId)
      .eq('user_id', userId);
    for (const n of notes ?? []) {
      const props = (n.properties ?? {}) as NoteProperties;
      if (!(columnId in props)) continue;
      const coerced = coerceValue(props[columnId], fromType, toType, options);
      const next: NoteProperties = { ...props };
      if (isEmptyValue(coerced ?? null)) delete next[columnId];
      else next[columnId] = coerced as PropertyValue;
      const { error } = await supabase
        .from('notes')
        .update({ properties: next })
        .eq('id', n.id)
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Replace the whole options array (read-modify-write happens client-side; the
// caller sends the desired final array). Used to add/rename/recolor/remove a
// multi_select option. Each option needs a stable id so rows keep referencing it.
export async function updateColumnOptions(
  folderId: string,
  columnId: string,
  options: MultiSelectOption[],
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    const { data: col } = await supabase
      .from('folder_columns')
      .select('type')
      .eq('id', columnId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!col) return { ok: false, error: 'Column not found.' };
    if (col.type !== 'multi_select') {
      return { ok: false, error: 'Column is not multi-select.' };
    }

    const seen = new Set<string>();
    const clean: MultiSelectOption[] = [];
    for (const o of options ?? []) {
      const id = typeof o?.id === 'string' ? o.id : '';
      const name = typeof o?.name === 'string' ? o.name.trim() : '';
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      const color: ChipColor = VALID_CHIP_COLORS.includes(o.color) ? o.color : 'gray';
      clean.push({ id, name, color });
    }

    const { error } = await supabase
      .from('folder_columns')
      .update({ options: clean })
      .eq('id', columnId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface SetNotePropertyInput {
  noteId: string;
  columnId: string;
  // null / '' / [] clears the cell (removes the key).
  value: PropertyValue | null;
}

export async function setNoteProperty(input: SetNotePropertyInput): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    const { data: note } = await supabase
      .from('notes')
      .select('folder_id')
      .eq('id', input.noteId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!note) return { ok: false, error: 'Note not found.' };
    if (!note.folder_id) return { ok: false, error: 'Note is not in a folder.' };

    // The column must belong to the note's folder (stops cross-folder writes).
    const { data: col } = await supabase
      .from('folder_columns')
      .select('type, options')
      .eq('id', input.columnId)
      .eq('folder_id', note.folder_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!col) return { ok: false, error: 'Column does not belong to this folder.' };

    // Coerce + validate by type. `cleared` removes the key entirely.
    let value: PropertyValue | null = null;
    let cleared = false;
    if (col.type === 'multi_select') {
      const optionIds = new Set(
        ((col.options ?? []) as MultiSelectOption[]).map((o) => o.id),
      );
      const arr = Array.isArray(input.value) ? input.value : [];
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const v of arr) {
        if (typeof v === 'string' && optionIds.has(v) && !seen.has(v)) {
          seen.add(v);
          ids.push(v);
        }
      }
      if (ids.length === 0) cleared = true;
      else value = ids;
    } else {
      const raw = typeof input.value === 'string' ? input.value.trim() : '';
      if (!raw) {
        cleared = true;
      } else if (col.type === 'checkbox') {
        if (raw === 'true') value = 'true';
        else cleared = true;
      } else if (col.type === 'date') {
        if (!ISO_DATE_RE.test(raw)) return { ok: false, error: 'Invalid date.' };
        value = raw;
      } else if (col.type === 'url') {
        value = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      } else {
        value = raw; // text
      }
    }

    const { error } = await (cleared
      ? supabase.rpc('note_strip_property', {
          p_folder_id: note.folder_id,
          p_column_id: input.columnId,
        })
      : supabase.rpc('note_set_property', {
          p_note_id: input.noteId,
          p_column_id: input.columnId,
          p_value: value,
        }));
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/second-brain/folders/${note.folder_id}`);
    revalidatePath(`/second-brain/notes/${input.noteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setFolderView(
  folderId: string,
  view: FolderDefaultView,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    if (!VALID_VIEWS.includes(view)) return { ok: false, error: 'Invalid view.' };
    const { error } = await supabase
      .from('folders')
      .update({ default_view: view })
      .eq('id', folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/second-brain/folders/${folderId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Persist the folder table's "remember current view" config (sort/filters/widths/
// hidden) to folders.table_view. The client debounces calls. NOTE: intentionally
// NO revalidatePath — a refetch would remount the table and fight the optimistic
// local view state.
export async function saveFolderTableView(
  folderId: string,
  view: TableViewConfig,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('folders')
      .update({ table_view: normalizeViewConfig(view) })
      .eq('id', folderId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =============================================================
// Unified search (notes + book_notes) — migration 061 RPCs.
// Both RPCs read auth.uid() server-side; no user_id from the client.
// =============================================================

export async function searchBrain(
  q: string,
  tags: string[] = [],
  includeArchived = true,
): Promise<Result<BrainSearchHit[]>> {
  try {
    const { supabase } = await ctx();
    const { data, error } = await supabase.rpc('search_brain', {
      q,
      filter_tags: tags,
      include_archived: includeArchived,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as BrainSearchHit[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listBrainTags(): Promise<
  Result<{ tag: string; count: number }[]>
> {
  try {
    const { supabase } = await ctx();
    const { data, error } = await supabase.rpc('brain_tags');
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as { tag: string; count: number }[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
