/* SCORM Editor in-app file server.
   Serves an imported SCORM package's files (cached by the app under
   /scorm-fs/<id>/<path>) so the original course can render in an iframe with its
   real relative asset paths, scripts, and styles — exactly as an LMS would. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/scorm-fs/')) return; // let everything else hit the network
  event.respondWith(
    (async () => {
      const cache = await caches.open('scorm-editor-fs');
      const hit = await cache.match(url.pathname, { ignoreSearch: true });
      return hit || new Response('Not found in package', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    })(),
  );
});
