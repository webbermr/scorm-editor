/* SCORM Editor in-app file server.
   Serves an imported SCORM package's files (cached by the app under
   /scorm-fs/<id>/<path>) so the original course can render in an iframe with its
   real relative asset paths, scripts, and styles — exactly as an LMS would. */

const CACHE = 'scorm-editor-fs';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/scorm-fs/')) return; // let everything else hit the network
  event.respondWith(serve(event.request, url));
});

async function serve(request, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(url.pathname, { ignoreSearch: true });
  if (!hit) return new Response('Not found in package', { status: 404, headers: { 'Content-Type': 'text/plain' } });

  const buf = await hit.arrayBuffer();
  const total = buf.byteLength;
  const baseHeaders = new Headers(hit.headers);
  baseHeaders.set('Accept-Ranges', 'bytes'); // tell <audio>/<video> they can seek

  const range = request.headers.get('range');
  if (!range) {
    baseHeaders.set('Content-Length', String(total));
    return new Response(buf, { status: 200, headers: baseHeaders });
  }

  // Honor "Range: bytes=start-end" so media elements get duration + seeking
  // (without it the player shows NaN:NaN and the scrubber is dead).
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (isNaN(start)) start = 0;
  if (isNaN(end) || end >= total) end = total - 1;
  if (start > end || start >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' } });
  }

  const chunk = buf.slice(start, end + 1);
  baseHeaders.set('Content-Range', `bytes ${start}-${end}/${total}`);
  baseHeaders.set('Content-Length', String(chunk.byteLength));
  return new Response(chunk, { status: 206, statusText: 'Partial Content', headers: baseHeaders });
}
