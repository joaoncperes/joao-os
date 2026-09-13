// Browser-side helpers for Web Push subscription.
//
// Flow:
//   1. Check support (serviceWorker + PushManager)
//   2. Request Notification permission (gesture-required on iOS)
//   3. Register /sw.js (idempotent)
//   4. Get or create a PushSubscription with the VAPID public key
//   5. POST the subscription to /api/push/subscribe so the cron worker
//      can fan out from there.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export interface SubscribeResult {
  ok: boolean;
  error?: string;
}

export async function subscribeUserToPush(): Promise<SubscribeResult> {
  try {
    if (!isPushSupported()) {
      return { ok: false, error: 'Push not supported on this device.' };
    }

    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return { ok: false, error: 'Server missing VAPID public key.' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: `Permission: ${permission}` };
    }

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid).buffer as ArrayBuffer,
      });
    }

    const json = subscription.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Server: ${text || res.status}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function unsubscribeFromPush(): Promise<SubscribeResult> {
  try {
    if (!isPushSupported()) return { ok: false, error: 'Push not supported.' };
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { ok: true };
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint }),
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function sendTestPush(): Promise<SubscribeResult> {
  try {
    const res = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
