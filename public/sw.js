// Pedro OS service worker — push triggers + notification action callbacks.
// No offline caching here (V1). The PWA install path uses Next/manifest.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push handler: render the notification using the payload sent by the cron
// worker. Falls back to safe defaults if the payload is missing/malformed.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Pedro OS', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Pedro OS';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'pedro-os',
    renotify: Boolean(payload.renotify),
    silent: payload.silent === true,
    requireInteraction: payload.requireInteraction === true,
    data: payload.data || {},
    actions: Array.isArray(payload.actions) ? payload.actions : [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click handler: route based on the action button. Default click → /today.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'mark-done' && data.habitId && data.date) {
    event.waitUntil(
      fetch('/api/push/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'mark_done',
          habitId: data.habitId,
          date: data.date,
        }),
      }),
    );
    return;
  }

  if (action === 'snooze' && data.habitId) {
    event.waitUntil(
      fetch('/api/push/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'snooze_habit',
          habitId: data.habitId,
          minutes: 10,
        }),
      }),
    );
    return;
  }

  const target = data.url || '/today';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(target) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
        return undefined;
      }),
  );
});
