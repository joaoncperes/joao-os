import type { NoteProperties } from '@/lib/supabase/types';
import type { NoteCardData } from '../../../note-card';

// A folder-as-database row: a note (the Grid card data) plus its typed-column
// cell values. Superset of NoteCardData, so it still renders in the Grid view.
// created_at gives the table a stable row order (editing a cell bumps
// updated_at, so we can't sort rows by that).
export interface FolderRowData extends NoteCardData {
  created_at: string;
  properties: NoteProperties;
}
