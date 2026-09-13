import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Props {
  tag: string;
  size?: 'sm' | 'md';
  /** Explicit destination. Defaults to the search page filtered by this tag. */
  href?: string;
  /** When provided, renders a toggle button instead of a link (filter row). */
  onClick?: () => void;
  /** Selected state for the button variant. */
  selected?: boolean;
  /** Display-only: render a non-interactive span (avoids nested anchors). */
  plain?: boolean;
  className?: string;
}

/**
 * A `#tag` chip. By default a link to the unified search filtered by the tag;
 * pass `onClick` to make it a toggle button (used in the search filter row),
 * or `plain` to render a non-interactive span (used inside result rows that
 * are themselves links). Mirrors the sizing of components/category-chip.tsx.
 */
export function TagChip({ tag, size = 'md', href, onClick, selected, plain, className }: Props) {
  const base = cn(
    'inline-flex items-center rounded-md font-medium tracking-tight whitespace-nowrap transition-colors',
    size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[12px]',
  );
  const label = `#${tag}`;

  if (plain) {
    return (
      <span className={cn(base, 'bg-surface-2 text-text-2', className)}>{label}</span>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          base,
          'cursor-pointer',
          selected
            ? 'bg-accent-soft text-accent'
            : 'bg-surface-2 text-text-2 hover:text-text',
          className,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href ?? `/second-brain/search?tags=${encodeURIComponent(tag)}`}
      className={cn(
        base,
        'bg-surface-2 text-text-2 hover:bg-accent-soft hover:text-accent',
        className,
      )}
    >
      {label}
    </Link>
  );
}
