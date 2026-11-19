import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { CustomReminder } from '@/lib/supabase/types';
import { NotificationsClient } from './notifications-client';

export const metadata = { title: 'Notifications — João OS' };
export const dynamic = 'force-dynamic';

interface SubscriptionRow {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default async function NotificationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [subsResult, remindersResult] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('custom_reminders')
      .select('id, user_id, text, scheduled_time, enabled, created_at, updated_at')
      .eq('user_id', user.id)
      .order('scheduled_time', { ascending: true }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
          Settings
        </div>
        <h1 className="text-text text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Notifications
        </h1>
        <p className="text-text-2 mt-2 max-w-prose text-[14px] leading-relaxed">
          Push notifications are the app&apos;s external trigger layer. Enabled
          ones fire 10 minutes before each scheduled habit, on PR
          celebrations, and on standards-drift alerts. iOS requires the app
          to be added to the Home Screen first; desktop browsers work
          immediately.
        </p>
      </header>

      <NotificationsClient
        initialSubscriptions={(subsResult.data ?? []) as SubscriptionRow[]}
        initialReminders={(remindersResult.data ?? []) as CustomReminder[]}
      />
    </div>
  );
}
