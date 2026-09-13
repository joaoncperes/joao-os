'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  if (!email || !email.includes('@')) {
    return { error: 'Enter a valid email.' };
  }

  const supabase = await createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${(await headers()).get('host')}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return {};
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  if (!email || !email.includes('@')) return { error: 'Enter a valid email.' };
  if (!password) return { error: 'Enter your password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect('/today');
}
