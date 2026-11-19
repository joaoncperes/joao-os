import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CategoryShell } from '../category-shell';

export const metadata = { title: 'Projects — Second Brain — João OS' };
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <CategoryShell paraCategory="projects" />;
}
