import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Inbox, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { QuickCapture } from './quick-capture';
import {
  PARA_CATEGORY_DESCRIPTION,
  PARA_CATEGORY_ICON,
  PARA_CATEGORY_LABEL,
  PARA_CATEGORY_ORDER,
} from '@/lib/second-brain/display';
import type { ParaCategory } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Second Brain — Pedro OS' };
export const dynamic = 'force-dynamic';

export default async function SecondBrainPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [foldersRes, inboxCountRes] = await Promise.all([
    supabase
      .from('folders')
      .select('para_category')
      .eq('user_id', user.id)
      .is('archived_at', null),
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('folder_id', null)
      .is('archived_at', null),
  ]);

  const folderCounts: Record<ParaCategory, number> = {
    projects: 0,
    areas: 0,
    resources: 0,
    archive: 0,
  };
  for (const row of (foldersRes.data ?? []) as { para_category: ParaCategory }[]) {
    folderCounts[row.para_category] += 1;
  }
  const inboxCount = inboxCountRes.count ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
          PARA
        </div>
        <h1 className="text-text text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Second Brain
        </h1>
        <p className="text-text-2 mt-2 max-w-prose text-[14px] leading-relaxed">
          Projects, Areas, Resources, Archive. Capture o que ressoa, organize por
          acionabilidade, retorne quando precisar agir.
        </p>
      </header>

      <Link
        href="/second-brain/search"
        className="group bg-surface border-border hover:border-accent flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors"
      >
        <Search className="text-text-3 group-hover:text-text h-4 w-4 transition-colors" />
        <span className="text-text-3 group-hover:text-text-2 flex-1 text-[13.5px] transition-colors">
          Buscar anotações, livros, tags…
        </span>
        <kbd className="text-text-3 border-border bg-surface-2 hidden rounded border px-1.5 py-0.5 text-[10px] font-medium lg:inline">
          ⌘K
        </kbd>
      </Link>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-text text-[14px] font-semibold tracking-[-0.005em]">
            Captura rápida
          </h2>
          <span className="text-text-3 text-[11px]">⌘+Enter para salvar</span>
        </div>
        <QuickCapture />
      </section>

      <Link
        href="/second-brain/inbox"
        className={cn(
          'group bg-surface border-border flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors',
          inboxCount > 0 ? 'hover:border-accent' : 'hover:bg-surface-2',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            inboxCount > 0 ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-2',
          )}
        >
          <Inbox className="h-5 w-5" />
        </span>
        <div className="flex flex-1 flex-col leading-tight">
          <div className="text-text text-[14.5px] font-semibold">Inbox</div>
          <div className="text-text-3 mt-0.5 text-[12px]">
            {inboxCount === 0
              ? 'Vazia. Capture algo acima.'
              : `${inboxCount} nota${inboxCount === 1 ? '' : 's'} esperando classificação`}
          </div>
        </div>
        <ArrowRight className="text-text-3 group-hover:text-text h-4 w-4 transition-colors" />
      </Link>

      <section>
        <h2 className="text-text mb-3 text-[14px] font-semibold tracking-[-0.005em]">
          PARA
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PARA_CATEGORY_ORDER.map((c) => {
            const Icon = PARA_CATEGORY_ICON[c];
            const count = folderCounts[c];
            return (
              <Link
                key={c}
                href={`/second-brain/${c}`}
                className="group bg-surface border-border hover:border-accent flex items-start gap-4 rounded-2xl border px-5 py-4 transition-colors"
              >
                <span className="bg-surface-2 text-text-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex flex-1 flex-col leading-tight">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-text text-[15px] font-semibold tracking-[-0.005em]">
                      {PARA_CATEGORY_LABEL[c]}
                    </span>
                    <span className="text-text-3 text-[11.5px]">
                      {count} pasta{count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-text-3 mt-1 text-[12.5px] leading-relaxed">
                    {PARA_CATEGORY_DESCRIPTION[c]}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
