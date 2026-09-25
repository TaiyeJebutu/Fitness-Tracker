// Caches the app so it opens with no signal. Bump VERSION when you change files.
const VERSION = 'v1.4.0';
const FILES = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/config.js', 'js/app.js', 'js/api.js', 'js/ui.js', 'js/store.js', 'js/workout.js', 'js/train.js', 'js/social.js', 'js/body.js', 'js/backup.js', 'js/theme.js', 'js/badges.js', 'js/avatar.js', 'js/avatar-art.js', 'js/feedback.js', 'js/guide.js', 'js/help.js', 'version.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// App files: network first (so updates arrive), falling back to the cache when offline.
// Supabase requests are on another domain and are left alone.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // update checks always go to the network
  e.respondWith(
    // 'no-cache' = always ask GitHub whether the file changed, so updates show up straight away
    fetch(url.href, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })
      .then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
