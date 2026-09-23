const CACHE = 'quiniela-v40';
const PRECACHE = ['/laliga2026/', '/laliga2026/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Push notifications ───────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload = {};
  try { payload = e.data.json(); } catch { return; }
  // FCM Admin SDK v1 wraps data fields under payload.data
  const d = payload.data ?? payload;
  const { title = 'LaLiga 26/27', body = '', icon, url } = d;
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/laliga2026/app-icon.png',
      badge: '/laliga2026/app-icon.png',
      data: { url: url ?? '/laliga2026/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/laliga2026/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('/laliga2026/'));
      if (existing) return existing.navigate(url).then(() => existing.focus());
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  // Solo cachea GET de recursos propios; deja pasar APIs externas
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith('http')) return;                   // chrome-extension y otros esquemas
  if (url.includes('firestore') || url.includes('firebase')) return;
  if (url.includes('bzzoiro.com')) return;               // API externa, no cachear

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone).catch(() => {}));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
