import Image from 'next/image';
import type { QuoteWithAuthor } from '@/lib/supabase/types';

interface Props {
  quote: QuoteWithAuthor | null;
}

export function QuoteOfDay({ quote }: Props) {
  if (!quote) return null;

  return (
    <div className="bg-surface border-border flex items-center gap-4 rounded-xl border px-5 py-4">
      <div className="bg-accent/70 self-stretch w-[3px] rounded-sm" aria-hidden />
      {quote.author.photo_url ? (
        <Image
          src={quote.author.photo_url}
          alt={quote.author.name}
          width={48}
          height={48}
          className="rounded-full object-cover shrink-0"
          style={{ width: 48, height: 48 }}
        />
      ) : (
        <div
          className="bg-surface-2 text-text-2 grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-semibold"
          aria-hidden
        >
          {quote.author.name.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-text-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
          Quote of the day
        </div>
        <div className="text-text text-[15px] font-medium italic leading-snug whitespace-pre-line">
          &ldquo;{quote.text}&rdquo;
        </div>
        <div className="text-text-3 mt-1 text-[13px]">— {quote.author.name}</div>
      </div>
    </div>
  );
}
