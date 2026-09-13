// Shared className tokens so header + body cells line up and the Name column
// stays sticky across the horizontal scroll. A real <table> handles the rest.
export const COL_MIN = 'min-w-[150px]';
export const NAME_MIN = 'min-w-[180px]';

// Body + header cell chrome (1px grid lines, compact padding).
export const CELL_BASE =
  'border-border border-b border-r align-top text-[13px] text-text';
export const HEAD_BASE =
  'border-border border-b border-r bg-surface text-left';

// Sticky first (Name) column. bg covers cells scrolling underneath; the right
// border separates it from the scroll area.
export const NAME_STICKY = 'sticky left-0 z-10 bg-surface';
export const NAME_HEAD_STICKY = 'sticky left-0 z-20 bg-surface';
