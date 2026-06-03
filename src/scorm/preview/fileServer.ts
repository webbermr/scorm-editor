// Mounts an imported SCORM package into the Cache Storage API so the service
// worker (public/scorm-sw.js) can serve its files at /scorm-fs/<id>/<path>.
// That lets the original course render in an iframe with its real relative
// paths, scripts, and styles.

import JSZip from 'jszip';
import { buildLmsWrapper } from './lmsStub';

const CACHE = 'scorm-editor-fs';

/** filename of the LMS-shim wrapper page cached alongside the package */
export const WRAPPER_PAGE = '__cw_lms.html';

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  txt: 'text/plain',
  pdf: 'application/pdf',
};

const mimeFor = (path: string): string => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

export function supportsPreview(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof caches !== 'undefined';
}

let registered: Promise<void> | null = null;
export function registerFileServer(): Promise<void> {
  if (!supportsPreview()) return Promise.resolve();
  if (!registered) {
    registered = navigator.serviceWorker
      .register('/scorm-sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => undefined)
      .catch(() => undefined);
  }
  return registered;
}

/** Cache every file in the package under /scorm-fs/<id>/<path>. Returns the base path. */
export async function mountPackage(file: File, id: string): Promise<string> {
  const base = `/scorm-fs/${id}/`;
  if (!supportsPreview()) return base;
  await registerFileServer();
  const zip = await JSZip.loadAsync(file);
  // Only one package is mounted at a time — drop any previous one.
  await caches.delete(CACHE);
  const cache = await caches.open(CACHE);

  const paths: string[] = [];
  zip.forEach((path, entry) => {
    if (!entry.dir) paths.push(path);
  });

  await Promise.all(
    paths.map(async (path) => {
      const blob = await zip.file(path)!.async('blob');
      await cache.put(base + path, new Response(blob, { headers: { 'Content-Type': mimeFor(path) } }));
    }),
  );

  // The LMS-shim wrapper (provides a stub SCORM API for standalone/new-tab viewing).
  await cache.put(base + WRAPPER_PAGE, new Response(buildLmsWrapper(), { headers: { 'Content-Type': 'text/html' } }));

  return base;
}
