'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Send, Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import {
  getNotificationPermission,
  isPushSupported,
  sendTestPush,
  subscribeUserToPush,
  unsubscribeFromPush,
} from '@/lib/push/client';
import type { CustomReminder } from '@/lib/supabase/types';
import {
  createCustomReminder,
  deleteCustomReminder,
  updateCustomReminder,
} from './actions';

interface SubscriptionRow {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

type PermissionState = NotificationPermission | 'unsupported' | 'unknown';

interface Props {
  initialSubscriptions: SubscriptionRow[];
  initialReminders: CustomReminder[];
}

export function NotificationsClient({ initialSubscriptions, initialReminders }: Props) {
  // Lazy initialisers: the browser APIs only exist client-side. On SSR they
  // resolve to safe defaults; on hydration they read the real values once.
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined') return 'unknown';
    return getNotificationPermission();
  });
  const [supported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isPushSupported();
  });
  const [busy, setBusy] = useState(false);
  const [subs, setSubs] = useState<SubscriptionRow[]>(initialSubscriptions);

  // Listen for permission changes (e.g., user changes browser setting in
  // another tab). Permissions API isn't on every engine — guard.
  useEffect(() => {
    if (typeof window === 'undefined' || !('permissions' in navigator)) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!cancelled) setPermission(getNotificationPermission());
    };
    navigator.permissions
      .query({ name: 'notifications' as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        s.addEventListener('change', onChange);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      status?.removeEventListener('change', onChange);
    };
  }, []);

  async function onEnable() {
    setBusy(true);
    const result = await subscribeUserToPush();
    setBusy(false);
    setPermission(getNotificationPermission());
    if (!result.ok) {
      toast.error(result.error ?? 'Could not enable notifications.');
      return;
    }
    toast.success('Notifications enabled on this device.');
    // Optimistic — full list refresh on next page load.
  }

  async function onDisable() {
    setBusy(true);
    const result = await unsubscribeFromPush();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Could not disable.');
      return;
    }
    toast.success('Disabled on this device.');
    setSubs([]);
  }

  async function onSendTest() {
    setBusy(true);
    const result = await sendTestPush();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? 'Test failed.');
      return;
    }
    toast.success('Queued. The cron worker will deliver within ~5 min.');
  }

  async function onDelete(endpoint: string) {
    setBusy(true);
    const res = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error('Failed to remove device.');
      return;
    }
    setSubs((prev) => prev.filter((s) => s.endpoint !== endpoint));
    toast.success('Device removed.');
  }

  const isEnabled = permission === 'granted';
  const canEnable =
    supported && (permission === 'default' || permission === 'granted');

  return (
    <div className="flex flex-col gap-8">
      <section className="bg-surface border-border flex flex-col gap-4 rounded-xl border px-5 py-5">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-full ${
              isEnabled ? 'bg-[var(--success-soft)]' : 'bg-surface-2'
            }`}
            aria-hidden
          >
            {isEnabled ? (
              <Bell className="text-[var(--success)] h-4 w-4" />
            ) : (
              <BellOff className="text-text-3 h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-text text-[14px] font-semibold">
              {!supported
                ? 'Not supported on this device'
                : permission === 'denied'
                  ? 'Blocked at the system level'
                  : isEnabled
                    ? 'Enabled on this device'
                    : 'Not yet enabled on this device'}
            </div>
            <div className="text-text-3 mt-1 text-[12.5px] leading-snug">
              {!supported ? (
                <>
                  Service Workers + Push API are required. iOS Safari only
                  supports push when the app is added to the Home Screen.
                </>
              ) : permission === 'denied' ? (
                <>
                  Re-enable from your browser/system settings, then refresh.
                </>
              ) : isEnabled ? (
                <>Tap &ldquo;Send test&rdquo; to verify the pipeline.</>
              ) : (
                <>One tap below requests system permission.</>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isEnabled ? (
            <button
              type="button"
              disabled={!canEnable || busy}
              onClick={onEnable}
              className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              Enable on this device
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSendTest}
                className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Send test
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDisable}
                className="border-border text-text-2 hover:bg-surface-2 disabled:opacity-50 inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              >
                <BellOff className="h-3.5 w-3.5" />
                Disable on this device
              </button>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-text text-[14px] font-semibold">Subscribed devices</h2>
          <span className="text-text-3 text-[11px]">{subs.length} device{subs.length === 1 ? '' : 's'}</span>
        </div>

        {subs.length === 0 ? (
          <div className="bg-surface border-border text-text-3 rounded-xl border px-5 py-8 text-center text-[13px]">
            No devices yet. Enable above to register this one.
          </div>
        ) : (
          <ul className="bg-surface border-border flex flex-col rounded-xl border">
            {subs.map((s) => (
              <li
                key={s.id}
                className="border-border flex items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-text truncate text-[13.5px] font-medium">
                    {prettyAgent(s.user_agent)}
                  </div>
                  <div className="text-text-3 mt-0.5 text-[11.5px] tabular-nums">
                    Added {format(new Date(s.created_at), 'MMM d, yyyy')} ·{' '}
                    {s.last_used_at
                      ? `last used ${format(new Date(s.last_used_at), 'MMM d')}`
                      : 'never used'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(s.endpoint)}
                  className="text-text-3 hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] grid h-8 w-8 place-items-center rounded transition-colors disabled:opacity-50"
                  aria-label="Remove device"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DailyRemindersSection initialReminders={initialReminders} />
    </div>
  );
}

function prettyAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return ua.slice(0, 60);
}

// ---------------------------------------------------------------
// Daily reminders
// ---------------------------------------------------------------

type EditingState = { id: string } | { id: 'new' } | null;

function DailyRemindersSection({ initialReminders }: { initialReminders: CustomReminder[] }) {
  const [reminders, setReminders] = useState<CustomReminder[]>(initialReminders);
  const [editing, setEditing] = useState<EditingState>(null);
  const [pending, start] = useTransition();

  function sortReminders(rows: CustomReminder[]): CustomReminder[] {
    return [...rows].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  }

  function onToggle(r: CustomReminder, enabled: boolean) {
    // Optimistic
    setReminders((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, enabled } : x)),
    );
    start(async () => {
      const res = await updateCustomReminder({ id: r.id, enabled });
      if (res.error) {
        toast.error(res.error);
        setReminders((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, enabled: !enabled } : x)),
        );
      }
    });
  }

  function onDelete(r: CustomReminder) {
    const prev = reminders;
    setReminders((rs) => rs.filter((x) => x.id !== r.id));
    start(async () => {
      const res = await deleteCustomReminder({ id: r.id });
      if (res.error) {
        toast.error(res.error);
        setReminders(prev);
        return;
      }
      toast.success('Reminder deleted.');
    });
  }

  function onSaveNew(values: { text: string; scheduled_time: string }) {
    start(async () => {
      const res = await createCustomReminder(values);
      if (res.error || !res.id) {
        toast.error(res.error ?? 'Could not save reminder.');
        return;
      }
      const fresh: CustomReminder = {
        id: res.id,
        user_id: '',
        text: values.text.trim(),
        scheduled_time: values.scheduled_time.length === 5
          ? `${values.scheduled_time}:00`
          : values.scheduled_time,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setReminders((prev) => sortReminders([...prev, fresh]));
      setEditing(null);
      toast.success('Reminder created.');
    });
  }

  function onSaveEdit(id: string, values: { text: string; scheduled_time: string }) {
    start(async () => {
      const res = await updateCustomReminder({
        id,
        text: values.text,
        scheduled_time: values.scheduled_time,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setReminders((prev) =>
        sortReminders(
          prev.map((x) =>
            x.id === id
              ? {
                  ...x,
                  text: values.text.trim(),
                  scheduled_time:
                    values.scheduled_time.length === 5
                      ? `${values.scheduled_time}:00`
                      : values.scheduled_time,
                }
              : x,
          ),
        ),
      );
      setEditing(null);
      toast.success('Reminder updated.');
    });
  }

  const isCreating = editing?.id === 'new';

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-text text-[14px] font-semibold">Daily reminders</h2>
        <span className="text-text-3 text-[11px]">
          {reminders.length} reminder{reminders.length === 1 ? '' : 's'}
        </span>
      </div>

      {reminders.length === 0 && !isCreating ? (
        <div className="bg-surface border-border text-text-3 rounded-xl border px-5 py-8 text-center text-[13px]">
          No daily reminders yet. Add one below.
        </div>
      ) : (
        <ul className="bg-surface border-border flex flex-col rounded-xl border">
          {reminders.map((r) =>
            editing?.id === r.id ? (
              <li
                key={r.id}
                className="border-border border-t px-5 py-4 first:border-t-0"
              >
                <ReminderForm
                  initial={{ text: r.text, scheduled_time: r.scheduled_time.slice(0, 5) }}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(vals) => onSaveEdit(r.id, vals)}
                  submitLabel="Save"
                />
              </li>
            ) : (
              <li
                key={r.id}
                className="border-border flex items-center gap-3 border-t px-5 py-3 first:border-t-0"
              >
                <div className="text-text w-14 shrink-0 text-[14px] font-semibold tabular-nums">
                  {r.scheduled_time.slice(0, 5)}
                </div>
                <div
                  className={`min-w-0 flex-1 truncate text-[13.5px] ${
                    r.enabled ? 'text-text' : 'text-text-3 line-through'
                  }`}
                >
                  {r.text}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.enabled}
                  aria-label={r.enabled ? 'Disable reminder' : 'Enable reminder'}
                  disabled={pending}
                  onClick={() => onToggle(r, !r.enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    r.enabled ? 'bg-accent' : 'bg-surface-2 border-border border'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      r.enabled ? 'translate-x-[19px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing({ id: r.id })}
                  className="text-text-3 hover:text-text hover:bg-surface-2 grid h-8 w-8 place-items-center rounded transition-colors disabled:opacity-50"
                  aria-label="Edit reminder"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(r)}
                  className="text-text-3 hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] grid h-8 w-8 place-items-center rounded transition-colors disabled:opacity-50"
                  aria-label="Delete reminder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ),
          )}

          {isCreating && (
            <li
              key="__new"
              className="border-border border-t px-5 py-4 first:border-t-0"
            >
              <ReminderForm
                initial={{ text: '', scheduled_time: '08:00' }}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={onSaveNew}
                submitLabel="Add"
              />
            </li>
          )}
        </ul>
      )}

      {!isCreating && (
        <div className="mt-3">
          <button
            type="button"
            disabled={pending || editing !== null}
            onClick={() => setEditing({ id: 'new' })}
            className="border-border text-text-2 hover:bg-surface-2 disabled:opacity-50 inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New reminder
          </button>
        </div>
      )}
    </section>
  );
}

function ReminderForm({
  initial,
  pending,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: { text: string; scheduled_time: string };
  pending: boolean;
  onSubmit: (values: { text: string; scheduled_time: string }) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [text, setText] = useState(initial.text);
  const [time, setTime] = useState(initial.scheduled_time);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) {
          toast.error('Text is required.');
          return;
        }
        onSubmit({ text, scheduled_time: time });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <input
        type="time"
        required
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="border-border bg-surface-2 text-text h-9 w-28 rounded-md border px-2 text-[14px] tabular-nums"
      />
      <input
        type="text"
        required
        maxLength={140}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What to remind?"
        className="border-border bg-surface-2 text-text placeholder:text-text-3 h-9 flex-1 rounded-md border px-3 text-[14px]"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          {submitLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="border-border text-text-2 hover:bg-surface-2 disabled:opacity-50 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}
