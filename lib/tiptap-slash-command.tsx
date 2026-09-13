// SlashCommand — a Notion-style "/" block menu for the notes editor. Built on
// @tiptap/suggestion: typing "/" at a block start (or after whitespace) opens a
// filterable popup of block types; selecting one deletes the typed "/query" and
// runs a built-in editor chain.
//
// We keep every item action as a plain editor.chain() call (never a custom
// command) because pnpm's nested @tiptap/core layout can't resolve a Commands
// type augmentation — same constraint documented in lib/tiptap-database-table.ts.
//
// The popup is rendered with ReactRenderer and positioned by hand from the caret
// rect: this repo has neither tippy nor @floating-ui hoisted, so we own a single
// absolutely-positioned wrapper appended to <body> and flip it above the caret
// when it would overflow the viewport bottom.

'use client';

import { Extension, ReactRenderer } from '@tiptap/react';
import type { Editor, Range } from '@tiptap/react';
import { Suggestion } from '@tiptap/suggestion';
import type {
  SuggestionOptions,
  SuggestionProps,
  SuggestionKeyDownProps,
} from '@tiptap/suggestion';
import type { LucideIcon } from 'lucide-react';
import { SlashCommandMenu } from '@/components/slash-command-menu';

// One block option in the menu. `command` performs the mutation and MUST start
// by deleting the typed "/query" range (the `range` it receives).
export type SlashItem = {
  title: string;
  description?: string;
  icon: LucideIcon;
  keywords?: string[];
  command: (args: { editor: Editor; range: Range }) => void;
};

// Props ReactRenderer forwards into the menu component — items / command /
// clientRect / query are injected by the suggestion plugin on every keystroke.
export interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  clientRect?: (() => DOMRect | null) | null;
  query: string;
}

// Imperative handle the menu exposes so the extension can forward arrow/enter
// keys into it (return true = handled → the keystroke is swallowed).
export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface SlashCommandOptions {
  items: SlashItem[];
}

function filterItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    [item.title, item.description ?? '', ...(item.keywords ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

// --- Manual popup positioning (no tippy / no floating-ui) ----------------
const FALLBACK_MENU_H = 320;
const FALLBACK_MENU_W = 288;
const GAP = 6;

function createWrapper(): HTMLElement {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.top = '0';
  el.style.left = '0';
  el.style.zIndex = '50';
  document.body.appendChild(el);
  return el;
}

function positionWrapper(el: HTMLElement, rect: DOMRect | null | undefined): void {
  if (!rect) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  const menuH = el.offsetHeight || FALLBACK_MENU_H;
  const menuW = el.offsetWidth || FALLBACK_MENU_W;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer below the caret; flip above when it would run off the bottom.
  const below = rect.bottom + GAP;
  const flipAbove = below + menuH > vh && rect.top - GAP - menuH > 0;
  const top = flipAbove ? rect.top - GAP - menuH : below;

  // Clamp horizontally so it never leaves the viewport.
  let left = rect.left;
  if (left + menuW > vw - 8) left = Math.max(8, vw - 8 - menuW);

  // position:absolute is document-relative → add scroll offsets.
  el.style.top = `${top + window.scrollY}px`;
  el.style.left = `${left + window.scrollX}px`;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { items: [] };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    const suggestion: Omit<SuggestionOptions<SlashItem, SlashItem>, 'editor'> = {
      char: '/',
      allowSpaces: false,
      // Default findSuggestionMatch only fires at block start or after
      // whitespace, so this never triggers inside "https://".
      startOfLine: false,
      items: ({ query }) => filterItems(options.items, query),
      // `props` here is the SlashItem the menu selected.
      command: ({ editor, range, props }) => {
        props.command({ editor, range });
      },
      render: () => {
        let renderer: ReactRenderer<SlashCommandMenuRef, SlashMenuProps> | null = null;
        let wrapper: HTMLElement | null = null;
        // Escape closes the menu but leaves the literal "/query" in the doc
        // (Notion behavior). The flag keeps it closed through the following
        // keystrokes until the match exits (onExit).
        let dismissed = false;

        const teardown = () => {
          renderer?.destroy();
          wrapper?.remove();
          renderer = null;
          wrapper = null;
        };

        return {
          onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
            dismissed = false;
            wrapper = createWrapper();
            renderer = new ReactRenderer<SlashCommandMenuRef, SlashMenuProps>(
              SlashCommandMenu,
              {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: props.command,
                  clientRect: props.clientRect,
                  query: props.query,
                },
              },
            );
            wrapper.appendChild(renderer.element);
            positionWrapper(wrapper, props.clientRect?.());
          },
          onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
            if (dismissed || !renderer || !wrapper) return;
            renderer.updateProps({
              items: props.items,
              command: props.command,
              clientRect: props.clientRect,
              query: props.query,
            });
            positionWrapper(wrapper, props.clientRect?.());
          },
          onKeyDown: (props: SuggestionKeyDownProps): boolean => {
            if (props.event.key === 'Escape') {
              dismissed = true;
              teardown();
              return true;
            }
            if (dismissed) return false;
            return renderer?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            dismissed = false;
            teardown();
          },
        };
      },
    };

    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        ...suggestion,
      }),
    ];
  },
});
