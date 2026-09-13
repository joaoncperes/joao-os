'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { saveAccount } from '../actions';

interface Props {
  email: string;
  name: string;
  timeZone: string;
  weekStartDay: number;
}

export function AccountForm({ email, name: initName, timeZone: initTz, weekStartDay: initWsd }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initName);
  const [tz, setTz] = useState(initTz);
  const [wsd, setWsd] = useState<number>(initWsd);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveAccount({ name, timeZone: tz, weekStartDay: wsd });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          router.push('/setup/habits');
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Email (read-only)</Label>
        <Input value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tz">Time zone</Label>
        <Input
          id="tz"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          required
          placeholder="America/Sao_Paulo"
        />
        <p className="text-muted-foreground text-xs">
          IANA TZ name. Default for São Paulo is fine.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wsd">Week starts on</Label>
        <select
          id="wsd"
          value={wsd}
          onChange={(e) => setWsd(Number(e.target.value))}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </div>
      <div className="pt-4">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}
