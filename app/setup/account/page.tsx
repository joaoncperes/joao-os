import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { SetupProgress } from '../setup-progress';
import { AccountForm } from './account-form';

export const metadata = { title: 'Account — João OS' };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('email, name, time_zone, week_start_day')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <>
      <SetupProgress step="account" />
      <Card>
        <CardHeader>
          <CardTitle>Confirm your account</CardTitle>
          <CardDescription>Time zone and week start. Editable later in Settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm
            email={profile?.email ?? user.email ?? ''}
            name={profile?.name ?? 'João'}
            timeZone={profile?.time_zone ?? 'America/Sao_Paulo'}
            weekStartDay={profile?.week_start_day ?? 1}
          />
        </CardContent>
      </Card>
    </>
  );
}
