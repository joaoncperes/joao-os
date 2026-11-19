import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listBrainTags } from '../actions';
import { SearchClient } from './search-client';

export const metadata = { title: 'Buscar — Second Brain — João OS' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tags?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const initialQ = sp.q ?? '';
  const initialActiveTags = (sp.tags ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const tagsRes = await listBrainTags();
  const allTags = tagsRes.ok ? tagsRes.data : [];

  return (
    <SearchClient
      initialQ={initialQ}
      initialActiveTags={initialActiveTags}
      allTags={allTags}
    />
  );
}
