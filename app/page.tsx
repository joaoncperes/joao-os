import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('setup_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  redirect(profile?.setup_completed_at ? '/today' : '/setup/welcome');
}
