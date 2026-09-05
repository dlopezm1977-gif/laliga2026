const CACHE = 'quiniela-v36';
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
