import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/date';

type GateResult = {
  userId: string;
  setupComplete: boolean;
  timeZone: string;
};

// Layouts and pages render in parallel. Verify the user and read their profile
// once per request, with no persistent caching of authentication or private data.
const readAccount = cache(async (): Promise<GateResult> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('setup_completed_at, time_zone')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    setupComplete: !!profile?.setup_completed_at,
    timeZone: profile?.time_zone ?? DEFAULT_TZ,
  };
});

// Server-side auth gate. Replaces the middleware/proxy auth checks since
// Next 16 edge middleware is unsupported on Cloudflare Workers via OpenNext
// and Node middleware is blocked by the adapter. Call from server components.
//
// `requireSetup`:
//   - 'complete'   → redirect to /setup/welcome if not set up
//   - 'incomplete' → redirect to /today if already set up
//   - 'any'        → don't gate on setup state
export async function requireAuth(
  requireSetup: 'complete' | 'incomplete' | 'any' = 'complete',
): Promise<GateResult> {
  const account = await readAccount();
  const { setupComplete } = account;

  if (requireSetup === 'complete' && !setupComplete) {
    redirect('/setup/welcome');
  }
  if (requireSetup === 'incomplete' && setupComplete) {
    redirect('/today');
  }

  return account;
}
