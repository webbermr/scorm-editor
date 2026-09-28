// Lectora-aware page removal. Lectora courses wire navigation as a hardcoded
// linked list inside each page (trivNextPage/trivPrevPage → trivExitPage('x.html')),
// with per-page position counters (PageInChapter / PagesInChapter) and a TOC of
// NewLink(...) entries. Removing a page therefore means: re-point its two neighbors
// to skip it, renumber the chapter's counters, drop its TOC entry, re-point any
// stray cross-links, drop it from the course test's question list, and delete the
// file — which preserves the original design while honouring the editor's deletions.

import type JSZip from 'jszip';
import { decryptTest, encryptTest, findTestPassphrase } from '@/scorm/edit/lectoraTestCrypto';
import { dirname, join } from '@/scorm/import/paths';

const NEXT_RE = /function\s+trivNextPage\(\)\s*\{\s*trivExitPage\(\s*'([^']+)'/;
const PREV_RE = /function\s+trivPrevPage\(\)\s*\{\s*trivExitPage\(\s*'([^']+)'/;
const NEXT_CALL_RE = /(function\s+trivNextPage\(\)\s*\{\s*)trivExitPage\([^()]*\)/;
const PREV_CALL_RE = /(function\s+trivPrevPage\(\)\s*\{\s*)trivExitPage\([^()]*\)/;
const PAGENUM_RE = /PageInChapter\.set\(\s*'(\d+)'/;
const PAGESTOT_RE = /PagesInChapter\.set\(\s*'(\d+)'/;

// Pages a page shows inside a panel rather than navigates to — Lectora's table of
// contents is its own page (a001_toc<n>.html) loaded into a frame on every page
// with toc<n>.load('...'). They aren't slides: removing one and re-pointing the
// panel at a content page makes every slide run a second copy of that slide
// inside its TOC panel (it restarts continuously, narration and all).
const EMBED_RE = /\b\w+\.load\(\s*'([^']+\.html?)'|<i?frame\b[^>]*\bsrc\s*=\s*["']([^"']+\.html?)/gi;

/** Package paths of the pages `html` (at `path`) embeds in a panel or frame. */
export function embeddedPages(path: string, html: string): string[] {
  return [...html.matchAll(EMBED_RE)].map((m) => join(dirname(path), m[1] ?? m[2]));
}

/**
 * Sections ("chapters") of a Lectora course, from its table of contents pages:
 * each top-level TOC folder is a section; the pages listed under it (at any
 * depth) belong to it. Returns page path → section title. When a course has
 * several TOC pages, the fullest one wins and the others only fill gaps.
 */
export function lectoraSections(pages: Map<string, string>): Map<string, string> {
  const FOLDER = /^\s*(\w+)\s*=\s*insertFolder\(\s*(\w+)\s*,\s*NewFolder\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"([^"]*)"/;
  const LINK = /^\s*insertEntry\(\s*(\w+)\s*,\s*NewLink\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"([^"]+)"/;
  const tocs: Array<Map<string, string>> = [];
  for (const [path, html] of pages) {
    if (!/insertFolder\(/.test(html) || !/NewLink\(/.test(html)) continue;
    const top = new Map<string, string>(); // folder variable → its top-level section
    const out = new Map<string, string>();
    const at = (rel: string) => join(dirname(path), rel);
    for (const line of html.split('\n')) {
      const f = FOLDER.exec(line);
      if (f) {
        const [, v, parent, rawTitle, first] = f;
        const title = top.get(parent) ?? rawTitle.replace(/<[^>]*>/g, '').replace(/\\(.)/g, '$1').trim();
        if (top.has(parent) || /^fT$/.test(parent) || !top.size) top.set(v, title);
        if (first && !out.has(at(first))) out.set(at(first), title);
        continue;
      }
      const l = LINK.exec(line);
      if (l && top.has(l[1])) out.set(at(l[2]), top.get(l[1])!);
    }
    if (out.size) tocs.push(out);
  }
  tocs.sort((a, b) => b.size - a.size);
  const sections = new Map<string, string>();
  for (const t of tocs) for (const [p, sec] of t) if (!sections.has(p)) sections.set(p, sec);
  // Pages the TOC doesn't list but whose name extends a listed page's belong with
  // it — a test lists only its intro (a001_test_module_1.html), not its question
  // pages (a001_test_module_1_tmal1_m1_p12.html).
  const stem = (p: string) => p.replace(/\.html?$/i, '');
  const listed = [...sections.keys()].sort((a, b) => stem(b).length - stem(a).length);
  for (const p of pages.keys()) {
    if (sections.has(p)) continue;
    const owner = listed.find((q) => stem(p).startsWith(stem(q) + '_'));
    if (owner) sections.set(p, sections.get(owner)!);
  }
  return sections;
}

const EXIT_TARGET_RE = /trivExitPage\(\s*\\?'([^'\\]+\.html?)\\?'/g;

/**
 * Lectora pages in course order: from the page the launcher opens, along each
 * page's Next chain, then into pages reached any other way (menu / dashboard
 * buttons, jumps) in the order they're linked. Pages never reached come last.
 */
export function lectoraCourseOrder(pages: Map<string, string>, launchPath: string | null): string[] {
  const nextOf = (p: string) => {
    const n = NEXT_RE.exec(pages.get(p) ?? '')?.[1];
    return n ? join(dirname(p), n) : undefined;
  };
  const launchHtml = launchPath ? pages.get(launchPath) : undefined;
  const redir = launchHtml ? [...launchHtml.matchAll(/redirPage\s*=\s*'([^']+\.html?)'/g)].pop()?.[1] : undefined;
  const nexts = new Set([...pages.keys()].map(nextOf).filter(Boolean));
  const start = (redir && join(dirname(launchPath!), redir)) || [...pages.keys()].find((p) => nextOf(p) && !nexts.has(p));

  const order: string[] = [];
  const seen = new Set<string>();
  const walk = (from: string | undefined) => {
    for (let c = from; c && pages.has(c) && !seen.has(c); c = nextOf(c)) {
      seen.add(c);
      order.push(c);
    }
  };
  if (launchPath && pages.has(launchPath)) {
    seen.add(launchPath);
    order.push(launchPath);
  }
  walk(start);
  for (let i = 0; i < order.length; i++) {
    for (const m of (pages.get(order[i]) ?? '').matchAll(EXIT_TARGET_RE)) walk(join(dirname(order[i]), m[1]));
  }
  for (const p of pages.keys()) if (!seen.has(p)) order.push(p);
  return order;
}

// Lectora courses can lock a feature until the learner reaches a page — TMA's
// "unLockTOC" variable is set to '1' only on the Module Summary page, and until
// then the Table of Contents button just says "available after you have
// completed all of the modules". Delete that page and the feature stays locked
// for good, so we find such variables and can start them unlocked instead.
export interface LostUnlock {
  /** Lectora variable, without the "Var" prefix (e.g. "unLockTOC") */
  variable: string;
  /** what it unlocks, for people ("the table of contents") */
  label: string;
  /** the value the removed pages set it to (e.g. "1") */
  value: string;
  /** the removed pages that were the only ones setting it */
  pages: string[];
  /** their page titles, for people */
  titles: string[];
}

const UNLOCK_SET_RE = /\bVar(\w*unlock\w*)\.set\(\s*'([^']+)'/gi;

/** Unlock variables that only removed pages set, and remaining pages still check. */
export function findLostUnlocks(pages: Map<string, string>, removed: Set<string>): LostUnlock[] {
  const setters = new Map<string, { value: string; pages: Set<string> }>();
  for (const [p, h] of pages) {
    for (const m of h.matchAll(UNLOCK_SET_RE)) {
      if (/reset/i.test(m[1])) continue; // "resetunlockTOC" and the like are admin switches
      const e = setters.get(m[1]) ?? { value: m[2], pages: new Set() };
      e.pages.add(p);
      setters.set(m[1], e);
    }
  }
  const lost: LostUnlock[] = [];
  for (const [variable, { value, pages: by }] of setters) {
    if (![...by].every((p) => removed.has(p))) continue;
    const checked = new RegExp(`\\bVar${variable}\\.(?:contains|equals|greaterThan|lessThan)\\(`);
    if (![...pages].some(([p, h]) => !removed.has(p) && checked.test(h))) continue;
    const titles = [...by].map((p) => (/<title>([^<]*)/i.exec(pages.get(p) ?? '')?.[1] ?? '').trim() || p.replace(/^.*\//, ''));
    lost.push({ variable, label: /toc/i.test(variable) ? 'the table of contents' : `“${variable}”`, value, pages: [...by], titles });
  }
  return lost;
}

/** Start the given variables at their unlocked value in a page's declarations:
 *  VarunLockTOC = new Variable( 'VarunLockTOC', '0', ... ) → '1'. Learners who
 *  already have saved progress in the LMS keep their saved value. */
export function startUnlocked(html: string, unlocks: Array<Pick<LostUnlock, 'variable' | 'value'>>): string {
  let out = html;
  for (const u of unlocks) {
    const decl = new RegExp(`(new\\s+Variable\\(\\s*'Var${u.variable}'\\s*,\\s*')[^']*'`, 'g');
    out = out.replace(decl, (_m, a: string) => `${a}${u.value.replace(/[$\\']/g, '')}'`);
  }
  return out;
}

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

/** Every Lectora test definition in the package as XML (decrypting when needed),
 *  plus the paths of any that couldn't be read. */
export async function readTestXml(srcZip: JSZip): Promise<{ xml: string[]; unreadable: string[] }> {
  const paths: string[] = [];
  srcZip.forEach((p, e) => {
    if (!e.dir && TEST_OBJ_RE.test(p)) paths.push(p);
  });
  const xml: string[] = [];
  const unreadable: string[] = [];
  let passphrase: string | null | undefined;
  for (const tp of paths) {
    const raw = await srcZip.file(tp)!.async('string');
    const t = decodeTestObj(tp, raw);
    if (t === 'encrypted') {
      if (passphrase === undefined) passphrase = await findTestPassphrase(srcZip);
      const x = passphrase ? decryptTest(raw, passphrase) : null;
      if (x) xml.push(x);
      else unreadable.push(tp);
    } else if (t) xml.push(t.xml);
    else unreadable.push(tp);
  }
  return { xml, unreadable };
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

/** TOC sections ("chapter" folders) whose own page was removed: drop the folder
 *  when none of its pages are left, else point it at its first remaining page.
 *  A folder's entries are the lines that add to its variable until it's reused:
 *    aux1 = insertFolder(fT, NewFolder("Technology", "a001_technology_welcome.html", ...))
 *    insertEntry(aux1, NewLink("Welcome", "a001_technology_welcome.html", ...)) */
function pruneTocFolders(toc: string, removed: Set<string>): string {
  const lines = toc.split(/(?<=\n)/);
  const FOLDER = /^\s*(\w+)\s*=\s*insertFolder\(\s*\w+\s*,\s*NewFolder\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"([^"]*)"/;
  const drop = new Set<number>();
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = FOLDER.exec(lines[i]);
    if (!m || !removed.has(m[2])) continue;
    const v = m[1];
    const uses = new RegExp(`\\(\\s*${v}\\s*,`);
    const reassigned = new RegExp(`^\\s*${v}\\s*=`);
    let first: string | undefined;
    let used = false;
    for (let j = i + 1; j < lines.length && !reassigned.test(lines[j]); j++) {
      if (drop.has(j) || !uses.test(lines[j])) continue;
      used = true;
      first ??= /New(?:Link|Folder)\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"([^"]+)"/.exec(lines[j])?.[1];
    }
    if (!used) drop.add(i);
    else if (first) lines[i] = lines[i].replace(`"${m[2]}"`, `"${first}"`);
  }
  return lines.filter((_, i) => !drop.has(i)).join('');
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

  // Panel pages (the table of contents) that remaining pages still show are kept.
  const embedded = new Set<string>();
  for (const [p, h] of text) if (!removed.has(p)) embeddedPages(p, h).forEach((e) => embedded.add(e));
  const panels = [...removed].filter((p) => embedded.has(p));
  if (panels.length) {
    panels.forEach((p) => removed.delete(p));
    warnings.push({
      message: `${panels.length === 1 ? 'A table of contents page was' : `${panels.length} table of contents pages were`} kept, because the remaining slides show ${panels.length === 1 ? 'it' : 'them'} in a panel.`,
      detail: 'Deleted slides are removed from its list. Kept: ' + panels.map((p) => p.replace(/^.*\//, '')).join(', '),
    });
  }
  if (!removed.size) return { rewrites: new Map(), removed, warnings };

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

  // Where a jump from surviving page `from` to removed page `r` should land now.
  // Keeps the jump's direction — a Back button goes further back, Next and
  // auto-advance (e.g. "narration finished → next page") go further forward —
  // and never lands on `from` itself: a page that auto-advances to itself replays
  // forever, trapping the learner. undefined = nothing left that way (disable it).
  const jumpTarget = (from: string, r: string): string | undefined => {
    const fi = orderIdx.get(from);
    const ri = orderIdx.get(r);
    let s: string | undefined;
    if (fi === undefined || ri === undefined || fi === ri) s = nearest(r);
    else {
      const dir = ri > fi ? 'next' : 'prev';
      s = survivor(r, dir);
      if (!s) {
        // chain broken past r: continue through course order the same way
        const ok = (q: string) => !removed.has(q) && q !== from && !!(nav.get(q)?.next || nav.get(q)?.prev);
        const step = dir === 'next' ? 1 : -1;
        for (let i = ri + step; i >= 0 && i < order.length && (dir === 'next' ? i > fi : i < fi); i += step) {
          if (ok(order[i])) {
            s = order[i];
            break;
          }
        }
      }
    }
    return s === from ? undefined : s;
  };
  // a call that navigates to page `r` (also inside escaped JS strings: \'r\')
  const exitCall = (r: string) => new RegExp(`trivExitPage\\(\\s*(\\\\?['"])${esc(r)}\\1\\s*(?:,[^()]*)?\\)`, 'g');

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
    // there's nowhere to go, so the button does nothing. (Pointing it at the page
    // itself would make anything that calls it — auto-advance — loop forever.)
    if (n.next && removed.has(n.next)) {
      const s = survivor(n.next, 'next');
      h = s ? h.replace(NEXT_RE, (m) => m.replace(/'[^']+'/, `'${s}'`)) : h.replace(NEXT_CALL_RE, '$1void 0');
    }
    if (n.prev && removed.has(n.prev)) {
      const s = survivor(n.prev, 'prev');
      h = s ? h.replace(PREV_RE, (m) => m.replace(/'[^']+'/, `'${s}'`)) : h.replace(PREV_CALL_RE, '$1void 0');
    }
    if (newNum.has(p)) h = h.replace(PAGENUM_RE, (m) => m.replace(/'\d+'/, `'${newNum.get(p)}'`));
    if (newTot.has(p)) h = h.replace(PAGESTOT_RE, (m) => m.replace(/'\d+'/, `'${newTot.get(p)}'`));

    // TOC: drop NewLink/insertEntry lines for removed pages (before re-pointing
    // stray links below, which would otherwise turn them into duplicate entries)
    if (/toc/i.test(p)) {
      for (const r of removed) {
        h = h.replace(new RegExp(`^.*NewLink\\([^\\n]*${esc(r)}[^\\n]*\\r?\\n`, 'gm'), '');
      }
      h = pruneTocFolders(h, removed);
    }

    // direct jumps (Back buttons, auto-advance when narration ends, ...) keep their
    // direction; with nowhere left to go they're disabled rather than self-looping
    for (const r of removed) {
      if (!h.includes(r)) continue;
      const s = jumpTarget(p, r);
      h = h.replace(exitCall(r), (m, q: string) => (s ? m.replace(`${q}${r}${q}`, `${q}${s}${q}`) : 'void 0'));
    }

    // any remaining stray references (dashboard links, jump menus, links inside
    // escaped JS strings like \'page.html\') → nearest surviving page
    for (const r of removed) {
      if (!h.includes(r)) continue;
      const quoted = new RegExp(`(['"])${esc(r)}(?=\\\\?['"])`, 'g');
      const s = nearest(r);
      if (s) h = h.replace(quoted, (_m, q: string) => q + s);
    }

    if (h !== text.get(p)) rewrites.set(p, h);
  }

  // Safety net: no page may gain a jump to itself (the "slide repeats forever" bug).
  const selfJumps = (p: string, h: string) => (h.match(exitCall(p)) ?? []).length;
  const looping = [...rewrites].filter(([p, h]) => selfJumps(p, h) > selfJumps(p, text.get(p)!)).map(([p]) => p);
  if (looping.length) {
    warnings.push({
      message: `${looping.length} page${looping.length === 1 ? ' now links' : 's now link'} back to ${looping.length === 1 ? 'itself' : 'themselves'} after the deletions, which can make the slide repeat in the LMS.`,
      detail: 'Check these pages in LMS Preview before uploading: ' + looping.map((p) => p.replace(/^.*\//, '')).join(', '),
    });
  }

  for (const t of tests) {
    const xml = pruneTestXml(t.xml, removed, nearest);
    if (xml !== t.xml) rewrites.set(t.path, encodeTestObj(t, xml));
  }

  return { rewrites, removed, warnings };
}
