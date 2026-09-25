// Lectora-aware page removal. Lectora courses wire navigation as a hardcoded
// linked list inside each page (trivNextPage/trivPrevPage → trivExitPage('x.html')),
// with per-page position counters (PageInChapter / PagesInChapter) and a TOC of
// NewLink(...) entries. Removing a page therefore means: re-point its two neighbors
// to skip it, renumber the chapter's counters, drop its TOC entry, re-point any
// stray cross-links, drop it from the course test's question list, and delete the
// file — which preserves the original design while honouring the editor's deletions.

import type JSZip from 'jszip';
import { decryptTest, encryptTest, findTestPassphrase } from '@/scorm/edit/lectoraTestCrypto';

const NEXT_RE = /function\s+trivNextPage\(\)\s*\{\s*trivExitPage\(\s*'([^']+)'/;
const PREV_RE = /function\s+trivPrevPage\(\)\s*\{\s*trivExitPage\(\s*'([^']+)'/;
const PAGENUM_RE = /PageInChapter\.set\(\s*'(\d+)'/;
const PAGESTOT_RE = /PagesInChapter\.set\(\s*'(\d+)'/;

interface Nav {
  prev?: string;
  next?: string;
  pageNum?: number;
  pagesTotal?: number;
}

export interface LectoraEdits {
  /** path -> rewritten file content */
  rewrites: Map<string, string>;
  /** paths to drop from the package */
  removed: Set<string>;
  /** things the author should know about (e.g. deletions we couldn't apply) */
  warnings: Array<{ message: string; detail?: string }>;
}

// Lectora test definitions (_tobj<n>.xml / .txt): the question pages a test draws
// from, stored as plain XML, base64-wrapped XML, or AES-encrypted ("Salted__",
// base64 "U2FsdGVkX1") with a key embedded in the player (see lectoraTestCrypto).
const TEST_OBJ_RE = /(^|\/)_tobj[^/]*\.(xml|txt)$/i;
const LOAD_TEST_RE = /loadTest\(\s*'([^']+)'\s*,\s*'([^']+)'/g;

interface TestObj {
  path: string;
  xml: string;
  format: 'xml' | 'b64' | 'aes';
  /** AES passphrase, for format 'aes' */
  passphrase?: string;
  lineLen: number;
  eol: string;
  trailingEol: boolean;
}

function decodeTestObj(path: string, raw: string): TestObj | 'encrypted' | null {
  if (/^\s*U2FsdGVkX1/.test(raw)) return 'encrypted';
  if (raw.includes('<lectoratest')) return { path, xml: raw, format: 'xml', lineLen: 0, eol: '\n', trailingEol: false };
  try {
    const bin = atob(raw.replace(/\s+/g, ''));
    const xml = new TextDecoder('utf-8').decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    if (!xml.includes('<lectoratest')) return null;
    const firstLine = raw.split('\n')[0].replace(/\r$/, '');
    return {
      path,
      xml,
      format: 'b64',
      lineLen: raw.includes('\n') ? firstLine.length : 0,
      eol: raw.includes('\r\n') ? '\r\n' : '\n',
      trailingEol: /\r?\n$/.test(raw),
    };
  } catch {
    return null;
  }
}

function encodeTestObj(t: TestObj, xml: string): string {
  if (t.format === 'xml') return xml;
  if (t.format === 'aes') return encryptTest(xml, t.passphrase!);
  const bytes = new TextEncoder().encode(xml);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  if (!t.lineLen) return b64 + (t.trailingEol ? t.eol : '');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += t.lineLen) lines.push(b64.slice(i, i + t.lineLen));
  return lines.join(t.eol) + (t.trailingEol ? t.eol : '');
}

/** Drop removed pages from a test's question list, renumber, cap each section's
 *  random draw at what's left, and re-point page references (pass/fail/prev). */
function pruneTestXml(xml: string, removed: Set<string>, nearest: (p: string) => string | undefined): string {
  const pageBlock = /<page\b[^>]*>(?:(?!<\/page>)[\s\S])*?<name>([^<]+)<\/name>[\s\S]*?<\/page>\s*/g;
  let out = xml.replace(pageBlock, (block, name: string) => (removed.has(name.trim()) ? '' : block));
  // sections left with no pages go too; the rest draw at most what remains
  out = out.replace(/<section>[\s\S]*?<\/section>\s*/g, (sec) => {
    const n = (sec.match(/<page\b/g) ?? []).length;
    if (!n) return '';
    return sec.replace(/<numrandom>(\d+)<\/numrandom>/, (m, v: string) => (Number(v) > n ? `<numrandom>${n}</numrandom>` : m));
  });
  let i = 0;
  out = out.replace(/(<page\b[^>]*>\s*<index>)\d+(<\/index>)/g, (_m, a: string, b: string) => `${a}${i++}${b}`);
  for (const r of removed) {
    if (out.includes(`>${r}<`)) {
      const s = nearest(r);
      if (s) out = out.split(`>${r}<`).join(`>${s}<`);
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Plan the file edits needed to remove `removedSet` pages from a Lectora package.
 * Returns null if nothing applies (no recognised pages removed).
 */
export async function planLectoraDeletions(srcZip: JSZip, removedSet: Set<string>): Promise<LectoraEdits | null> {
  const htmlPaths: string[] = [];
  srcZip.forEach((p, e) => {
    if (!e.dir && /\.html?$/i.test(p)) htmlPaths.push(p);
  });

  const text = new Map<string, string>();
  const nav = new Map<string, Nav>();
  for (const p of htmlPaths) {
    const h = await srcZip.file(p)!.async('string');
    text.set(p, h);
    nav.set(p, {
      prev: PREV_RE.exec(h)?.[1],
      next: NEXT_RE.exec(h)?.[1],
      pageNum: PAGENUM_RE.exec(h) ? Number(PAGENUM_RE.exec(h)![1]) : undefined,
      pagesTotal: PAGESTOT_RE.exec(h) ? Number(PAGESTOT_RE.exec(h)![1]) : undefined,
    });
  }

  const removed = new Set([...removedSet].filter((p) => nav.has(p)));
  if (!removed.size) return null;
  const warnings: LectoraEdits['warnings'] = [];

  // Course tests. Deleted question pages come out of the test's list too. An
  // encrypted test is decrypted with the course's own player passphrase; if that
  // fails its pages are kept, since deleting them would leave the test drawing
  // questions that don't exist (the learner gets stuck on a "not found" page).
  const testNames = new Map<string, string>(); // test object file base -> test page prefix
  for (const h of text.values()) for (const m of h.matchAll(LOAD_TEST_RE)) testNames.set(m[1], m[2]);
  const tests: TestObj[] = [];
  const testPaths: string[] = [];
  srcZip.forEach((p, e) => {
    if (!e.dir && TEST_OBJ_RE.test(p)) testPaths.push(p);
  });
  let passphrase: string | null | undefined; // looked up once, on the first encrypted test
  for (const tp of testPaths) {
    const raw = await srcZip.file(tp)!.async('string');
    const t = decodeTestObj(tp, raw);
    if (t === 'encrypted') {
      if (passphrase === undefined) passphrase = await findTestPassphrase(srcZip);
      const xml = passphrase ? decryptTest(raw, passphrase) : null;
      if (xml) {
        tests.push({ path: tp, xml, format: 'aes', passphrase: passphrase!, lineLen: 0, eol: '\n', trailingEol: false });
        continue;
      }
      const base = (tp.split('/').pop() ?? tp).replace(/\.(xml|txt)$/i, '');
      const prefix = testNames.get(base);
      const kept = prefix ? [...removed].filter((p) => (p.split('/').pop() ?? p).startsWith(prefix + '_')) : [];
      if (kept.length) {
        kept.forEach((p) => removed.delete(p));
        warnings.push({
          message: `${kept.length} deleted test page${kept.length === 1 ? ' was' : 's were'} kept, because this course’s encrypted test couldn’t be unlocked to edit its question list.`,
          detail: 'These pages will still appear when learners take the test: ' + kept.map((p) => p.replace(/^.*\//, '')).join(', '),
        });
      }
    } else if (t) tests.push(t);
  }
  if (!removed.size) return { rewrites: new Map(), removed, warnings };

  // first surviving page walking in a direction from (and past) a removed page
  const survivor = (from: string | undefined, dir: 'next' | 'prev'): string | undefined => {
    let cur = from;
    const seen = new Set<string>();
    while (cur && removed.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = nav.get(cur)?.[dir];
    }
    return cur && !removed.has(cur) ? cur : undefined;
  };

  // global page order (follow .next from a head with no in-package prev)
  let head: string | undefined;
  for (const p of htmlPaths) {
    const pr = nav.get(p)!.prev;
    if (!pr || !nav.has(pr)) {
      head = p;
      break;
    }
  }
  const order: string[] = [];
  const seen = new Set<string>();
  let cur = head;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    order.push(cur);
    cur = nav.get(cur)!.next;
  }
  for (const p of htmlPaths) if (!seen.has(p)) order.push(p);

  // closest surviving page to a removed one: along its Next chain, then its Prev
  // chain, then by course order — so a link never points at a deleted file even
  // when everything after it was deleted (e.g. the launcher's first page)
  const orderIdx = new Map(order.map((p, i) => [p, i]));
  const nearest = (r: string): string | undefined => {
    const s = survivor(r, 'next') ?? survivor(r, 'prev');
    if (s) return s;
    // only real course pages (they have Next/Prev) — never the launcher shell
    const ok = (p: string) => !removed.has(p) && !!(nav.get(p)?.next || nav.get(p)?.prev);
    const at = orderIdx.get(r) ?? 0;
    for (let i = at + 1; i < order.length; i++) if (ok(order[i])) return order[i];
    for (let i = at - 1; i >= 0; i--) if (ok(order[i])) return order[i];
    return undefined;
  };

  // segment into chapters at PageInChapter == 1, renumber the survivors
  const chapters: string[][] = [];
  let chapter: string[] = [];
  for (const p of order) {
    if (nav.get(p)!.pageNum === 1 && chapter.length) {
      chapters.push(chapter);
      chapter = [];
    }
    chapter.push(p);
  }
  if (chapter.length) chapters.push(chapter);

  const newNum = new Map<string, number>();
  const newTot = new Map<string, number>();
  for (const ch of chapters) {
    const survivors = ch.filter((p) => !removed.has(p) && nav.get(p)!.pageNum !== undefined);
    survivors.forEach((p, i) => {
      newNum.set(p, i + 1);
      newTot.set(p, survivors.length);
    });
  }

  // rewrite each surviving page
  const rewrites = new Map<string, string>();
  for (const p of htmlPaths) {
    if (removed.has(p)) continue;
    let h = text.get(p)!;
    const n = nav.get(p)!;

    // re-point next/prev past removed pages; at a boundary (now first/last page)
    // fall back to self so the Prev/Next button is a harmless no-op.
    if (n.next && removed.has(n.next)) {
      const s = survivor(n.next, 'next') ?? p;
      h = h.replace(NEXT_RE, (m) => m.replace(/'[^']+'/, `'${s}'`));
    }
    if (n.prev && removed.has(n.prev)) {
      const s = survivor(n.prev, 'prev') ?? p;
      h = h.replace(PREV_RE, (m) => m.replace(/'[^']+'/, `'${s}'`));
    }
    if (newNum.has(p)) h = h.replace(PAGENUM_RE, (m) => m.replace(/'\d+'/, `'${newNum.get(p)}'`));
    if (newTot.has(p)) h = h.replace(PAGESTOT_RE, (m) => m.replace(/'\d+'/, `'${newTot.get(p)}'`));

    // TOC: drop NewLink/insertEntry lines for removed pages (before re-pointing
    // stray links below, which would otherwise turn them into duplicate entries)
    if (/toc/i.test(p)) {
      for (const r of removed) {
        h = h.replace(new RegExp(`^.*NewLink\\([^\\n]*${esc(r)}[^\\n]*\\r?\\n`, 'gm'), '');
      }
    }

    // any remaining stray references (jump buttons, dashboard links, links inside
    // escaped JS strings like \'page.html\') → nearest surviving page
    for (const r of removed) {
      if (!h.includes(r)) continue;
      const quoted = new RegExp(`(['"])${esc(r)}(?=\\\\?['"])`, 'g');
      const s = nearest(r);
      if (s) h = h.replace(quoted, (_m, q: string) => q + s);
    }

    if (h !== text.get(p)) rewrites.set(p, h);
  }

  for (const t of tests) {
    const xml = pruneTestXml(t.xml, removed, nearest);
    if (xml !== t.xml) rewrites.set(t.path, encodeTestObj(t, xml));
  }

  return { rewrites, removed, warnings };
}
