// Media cleanup for the faithful-copy export, in two passes.
//
// 1) After page removal. Deleting a page from a faithful-copy export
// used to drop only its HTML, leaving every image / narration / video it used in
// the package — so a course trimmed by half stayed almost the same size, and the
// deleted content was still sitting in the zip.
//
// A file is dropped only when a removed page referenced it AND nothing left in the
// package still mentions its file name (surviving pages, player JS, CSS, XML...).
// The name match is deliberately loose (by basename, case-insensitive), so shared
// chrome — logos, buttons, the media player — always stays. Erring towards keeping
// a file costs a few KB; erring the other way breaks a slide.
//
// 2) Unused media (optional). Lectora publishes can carry hundreds of MB of media
// nothing uses — e.g. other modules' narration and images. A media file is unused
// when its name (without extension) appears in no other file in the package, test
// definitions included (decrypted when encrypted). If a test can't be read, this
// pass is skipped, since it could be the only thing naming a file.

import type JSZip from 'jszip';
import { dirname, join, normalize } from '@/scorm/import/paths';
import { readTestXml } from './lectoraEdit';

const MEDIA_EXT = 'png|jpe?g|gif|svg|webp|bmp|avif|ico|mp3|ogg|oga|m4a|aac|wav|mp4|webm|ogv|mov|m4v|flv|swf|pdf';
/** any run of path-ish characters ending in a media extension — attributes, JS
 *  strings, CSS url(), escaped \'...\' all included */
const MEDIA_TOKEN_RE = new RegExp(`[^"'\`\\\\()\\s<>=,;{}[\\]]+?\\.(?:${MEDIA_EXT})(?![a-z0-9])`, 'gi');
const MEDIA_FILE_RE = new RegExp(`\\.(?:${MEDIA_EXT})$`, 'i');
const TEXT_FILE_RE = /\.(html?|xhtml|js|css|xml|json|txt)$/i;
const HTML_FILE_RE = /\.(html?|xhtml)$/i;

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const baseName = (p: string): string => (p.split('/').pop() ?? p).toLowerCase();

function mediaTokens(text: string): string[] {
  MEDIA_TOKEN_RE.lastIndex = 0;
  return [...text.matchAll(MEDIA_TOKEN_RE)].map((m) => safeDecode(m[0].split('#')[0].split('?')[0]));
}

/** a zip entry's uncompressed size, without reading it where JSZip already knows */
async function entrySize(e: JSZip.JSZipObject): Promise<number> {
  const known = (e as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  return typeof known === 'number' && known >= 0 ? known : (await e.async('uint8array')).length;
}

async function totalSize(files: Map<string, JSZip.JSZipObject>, paths: Iterable<string>): Promise<number> {
  const sizes = await Promise.all([...paths].map((p) => entrySize(files.get(p)!)));
  return sizes.reduce((a, b) => a + b, 0);
}

export interface MediaPrune {
  /** media only removed pages used — left out of the package */
  removed: Set<string>;
  /** total uncompressed size of `removed` */
  bytes: number;
  /** media only a removed page used, kept because a non-page file (player JS,
   *  XML...) still mentions its name — may be left over from deleted content */
  uncertain: string[];
  /** media nothing in the package uses (pass 2) — disjoint from `removed` */
  unused: Set<string>;
  /** total uncompressed size of `unused` */
  unusedBytes: number;
  /** why pass 2 didn't run, when it was asked for but couldn't be done safely */
  unusedSkipped?: string;
}

export interface MediaPruneOptions {
  /** page paths being removed from the package */
  removed: Set<string>;
  /** surviving files whose content the export replaces (nav surgery) */
  rewrites: Map<string, string>;
  /** other files left out of the export (e.g. the manifest, which lists every
   *  file and is pruned separately) */
  skip: Set<string>;
  /** also find media nothing in the package uses (pass 2) */
  unused: boolean;
}

/** Plan which media files to leave out of a faithful-copy export. */
export async function planMediaPrune(src: JSZip, opts: MediaPruneOptions): Promise<MediaPrune> {
  const { removed, rewrites, skip } = opts;
  const result: MediaPrune = { removed: new Set(), bytes: 0, uncertain: [], unused: new Set(), unusedBytes: 0 };

  const files = new Map<string, JSZip.JSZipObject>();
  const folded = new Map<string, string>();
  src.forEach((p, e) => {
    if (e.dir) return;
    files.set(p, e);
    folded.set(p.toLowerCase(), p);
  });

  if (removed.size) await planRemovedPageMedia(files, folded, opts, result);
  if (opts.unused) await planUnusedMedia(src, files, removed, rewrites, skip, result);
  return result;
}

// Pass 1 — media files only the removed pages referenced.
async function planRemovedPageMedia(
  files: Map<string, JSZip.JSZipObject>,
  folded: Map<string, string>,
  { removed, rewrites, skip }: MediaPruneOptions,
  result: MediaPrune,
): Promise<void> {
  // candidates: media files the removed pages reference, resolved to real files
  const candidates = new Set<string>();
  for (const page of removed) {
    const entry = files.get(page);
    if (!entry) continue;
    const dir = dirname(page);
    for (const ref of mediaTokens(await entry.async('string'))) {
      if (/^(https?:|data:|\/\/)/i.test(ref)) continue;
      for (const c of [join(dir, ref), normalize(ref)]) {
        const hit = files.has(c) ? c : folded.get(c.toLowerCase());
        if (hit && MEDIA_FILE_RE.test(hit)) {
          candidates.add(hit);
          break;
        }
      }
    }
  }
  if (!candidates.size) return;

  // every media name still mentioned by what's left of the package
  const inPages = new Set<string>();
  const inOther = new Set<string>();
  for (const [p, entry] of files) {
    if (removed.has(p) || skip.has(p) || !TEXT_FILE_RE.test(p)) continue;
    const text = rewrites.get(p) ?? (await entry.async('string'));
    const into = HTML_FILE_RE.test(p) ? inPages : inOther;
    for (const t of mediaTokens(text)) into.add(baseName(t));
  }

  // drop candidates nobody mentions any more
  for (const c of candidates) {
    const name = baseName(c);
    if (inPages.has(name)) continue; // shared with a surviving page
    if (inOther.has(name)) {
      result.uncertain.push(c);
      continue;
    }
    result.removed.add(c);
  }
  result.bytes = await totalSize(files, result.removed);
  result.uncertain.sort();
}

// Pass 2 — media whose name appears nowhere else in the package.
async function planUnusedMedia(
  src: JSZip,
  files: Map<string, JSZip.JSZipObject>,
  removed: Set<string>,
  rewrites: Map<string, string>,
  skip: Set<string>,
  result: MediaPrune,
): Promise<void> {
  const tests = await readTestXml(src);
  if (tests.unreadable.length) {
    result.unusedSkipped = `The course’s test file couldn’t be read (${tests.unreadable.join(', ')}), so unused media wasn’t removed — it might be the only file that names some of it.`;
    return;
  }

  // Everything that could name a media file: all non-media files (scripts, pages,
  // data, even unknown formats — a false match only keeps a file), with the
  // export's rewrites, minus removed pages and skipped files, plus the tests.
  const parts: string[] = [...tests.xml];
  const launch = new Set<string>(); // files the manifest launches — always kept
  for (const [p, entry] of files) {
    if (skip.has(p)) {
      const xml = await entry.async('string');
      for (const m of xml.matchAll(/<resource\b[^>]*\bhref="([^"]+)"/gi)) launch.add(join(dirname(p), safeDecode(m[1].split('?')[0])).toLowerCase());
      continue;
    }
    if (removed.has(p) || MEDIA_FILE_RE.test(p)) continue;
    parts.push(rewrites.get(p) ?? (await entry.async('string')));
  }
  const corpus = parts.join('\n').toLowerCase();

  // each candidate's name (without extension) in the spellings it could appear in
  const candidates: string[] = [];
  const patterns: string[] = [];
  const owner: number[] = []; // pattern index -> candidate index
  for (const p of files.keys()) {
    if (!MEDIA_FILE_RE.test(p) || removed.has(p) || skip.has(p) || result.removed.has(p) || launch.has(p.toLowerCase())) continue;
    const stem = baseName(p).replace(/\.[^.]+$/, '');
    if (!stem) continue; // nameless (".png") — can't tell, keep it
    const i = candidates.push(p) - 1;
    for (const f of new Set([stem, stem.replace(/ /g, '%20'), encodeURIComponent(stem).toLowerCase(), stem.replace(/&/g, '&amp;')])) {
      patterns.push(f);
      owner.push(i);
    }
  }
  const seen = new Set([...findPatterns(corpus, patterns)].map((k) => owner[k]));
  candidates.forEach((p, i) => {
    if (!seen.has(i)) result.unused.add(p);
  });
  result.unusedBytes = await totalSize(files, result.unused);
}

/** Indexes of the patterns that occur anywhere in `text` — one pass over the text
 *  for all patterns at once (Aho–Corasick), since a large course has ~30 MB of
 *  scripts and pages and thousands of media names to look for. */
function findPatterns(text: string, patterns: string[]): Set<number> {
  const next: Map<number, number>[] = [new Map()];
  const fail: number[] = [0];
  const out: number[][] = [[]];
  patterns.forEach((pat, i) => {
    let s = 0;
    for (let k = 0; k < pat.length; k++) {
      const c = pat.charCodeAt(k);
      let n = next[s].get(c);
      if (n === undefined) {
        n = next.push(new Map()) - 1;
        fail.push(0);
        out.push([]);
        next[s].set(c, n);
      }
      s = n;
    }
    out[s].push(i);
  });
  // breadth-first: each state's fallback is the longest proper suffix in the trie
  const queue = [...next[0].values()];
  for (let h = 0; h < queue.length; h++) {
    const s = queue[h];
    for (const [c, n] of next[s]) {
      let f = fail[s];
      while (f && !next[f].has(c)) f = fail[f];
      fail[n] = next[f].get(c) ?? 0;
      if (out[fail[n]].length) out[n] = out[n].concat(out[fail[n]]);
      queue.push(n);
    }
  }
  const found = new Set<number>();
  let s = 0;
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    while (s && !next[s].has(c)) s = fail[s];
    s = next[s].get(c) ?? 0;
    for (const i of out[s]) found.add(i);
  }
  return found;
}
