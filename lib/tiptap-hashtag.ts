// HashtagHighlight — a decoration-only TipTap extension that visually marks
// inline #hashtags as you type. It adds NO node/mark to the schema and does
// NOT touch serialization, so `tipTapToMarkdown` and the stored `content_md`
// are unchanged; the `#tag` stays literal text (which lib/hashtags.ts reads).
//
// Tags are letter-led (so `# Heading` and `#123` are skipped), and matches
// inside inline code or code blocks are ignored.
//
// `Extension` comes from @tiptap/react (which re-exports @tiptap/core) so we
// only need @tiptap/pm as a direct dependency for the ProseMirror primitives.

import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const INLINE_HASHTAG_RE =
  /(^|[^\p{L}\p{N}_/#])#(\p{L}[\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_][\p{L}\p{N}_-]*)*)/gu;

export const HashtagHighlight = Extension.create({
  name: 'hashtagHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hashtagHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos, parent) => {
              if (!node.isText || !node.text) return;
              if (parent?.type.name === 'codeBlock') return;
              if (node.marks.some((m) => m.type.name === 'code')) return;
              for (const m of node.text.matchAll(INLINE_HASHTAG_RE)) {
                const lead = m[1] ? m[1].length : 0;
                const start = pos + (m.index ?? 0) + lead;
                const end = start + 1 + m[2].length; // '#' + tag body
                decorations.push(
                  Decoration.inline(start, end, { class: 'brain-hashtag' }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
