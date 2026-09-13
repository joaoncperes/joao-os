'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { sendMagicLink, signInWithPassword } from './actions';

type Mode = 'password' | 'magic';

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'password') {
      start(async () => {
        const result = await signInWithPassword(email, password);
        // On success the action redirects; only an error returns here.
        if (result?.error) toast.error(result.error);
      });
    } else {
      start(async () => {
        const result = await sendMagicLink(email);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setSent(true);
      });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending || sent}
          placeholder="you@example.com"
        />
      </div>

      {mode === 'password' ? (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
          />
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={
          pending || sent || !email || (mode === 'password' && !password)
        }
        className="w-full"
      >
        {mode === 'password'
          ? pending
            ? 'Signing in…'
            : 'Sign in'
          : sent
            ? 'Magic link sent'
            : pending
              ? 'Sending…'
              : 'Send magic link'}
      </Button>

      {mode === 'magic' && sent ? (
        <p className="text-muted-foreground text-sm">
          Check your inbox at{' '}
          <span className="text-foreground font-medium">{email}</span>. The link signs you in.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'password' ? 'magic' : 'password');
          setSent(false);
        }}
        className="text-muted-foreground hover:text-foreground w-full text-center text-xs underline-offset-4 hover:underline"
      >
        {mode === 'password' ? 'Use magic link instead' : 'Use password instead'}
      </button>
    </form>
  );
}
