// ResizableImage — extends the default @tiptap/extension-image with a
// `width` attribute (percent of container, 1-100) and a React NodeView
// that renders a drag handle on the right edge. Width is persisted in the
// TipTap JSON and rendered as inline style so it survives page reloads
// and the Cloudflare Worker's HTML hydration.

import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageView } from '@/components/resizable-image-view';

export const ResizableImage = Image.extend({
  addAttributes() {
    // Explicit attrs — declared inline rather than spread from this.parent?.()
    // because the parent-inheritance path silently drops src/alt under this
    // Next 16 + Turbopack + ReactNodeViewRenderer combo, so the schema
    // ends up with only `width` and the saved JSON loses image URLs.
    return {
      src: { default: null as string | null },
      alt: { default: null as string | null },
      title: { default: null as string | null },
      width: {
        default: null as number | null,
        parseHTML: (el) => {
          // Prefer inline width: 50% style; fall back to the HTML width attr.
          const style = el.getAttribute('style') ?? '';
          const styleMatch = style.match(/width\s*:\s*(\d+(?:\.\d+)?)%/i);
          if (styleMatch) return parseFloat(styleMatch[1]);
          const attr = el.getAttribute('width');
          if (attr && /^\d+(?:\.\d+)?$/.test(attr)) {
            const n = parseFloat(attr);
            return n <= 100 ? n : null;
          }
          return null;
        },
        renderHTML: (attrs) => {
          const w = (attrs as { width?: number | null }).width;
          if (w == null) return {};
          const clamped = Math.max(10, Math.min(100, w));
          return { style: `width: ${clamped}%` };
        },
      },
      height: { default: null as number | null },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
