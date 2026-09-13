'use server';

import { createClient } from '@/lib/supabase/server';
import { readConsistency } from '@/lib/consistency-data';

export async function loadConsistency(days: number) {
  return readConsistency(await createClient(), days);
}
