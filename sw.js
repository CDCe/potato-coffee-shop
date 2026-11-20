// Potato Coffee Shop: riceve gli avvisi del bancone anche ad app chiusa.
// Non mette nulla in cache: l'app si aggiorna sempre dal sito.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { title: 'Potato Coffee Shop', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Potato Coffee Shop', {
    body: d.body || '',
    icon: self.registration.scope + 'assets/icona-192.png',
    badge: self.registration.scope + 'assets/icona-192.png',
    tag: 'bancone',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
