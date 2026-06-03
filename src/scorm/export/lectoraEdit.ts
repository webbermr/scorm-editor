// Lectora-aware page removal. Lectora courses wire navigation as a hardcoded
// linked list inside each page (trivNextPage/trivPrevPage → trivExitPage('x.html')),
// with per-page position counters (PageInChapter / PagesInChapter) and a TOC of
// NewLink(...) entries. Removing a page therefore means: re-point its two neighbors
// to skip it, renumber the chapter's counters, drop its TOC entry, re-point any
// stray cross-links, and delete the file — which preserves the original design while
// honouring the editor's deletions.

import type JSZip from 'jszip';

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

    // any remaining stray references (jump buttons, dashboard links) → forward survivor
    for (const r of removed) {
      if (h.includes(`'${r}'`) || h.includes(`"${r}"`)) {
        const s = survivor(r, 'next') ?? survivor(r, 'prev');
        if (s) h = h.split(`'${r}'`).join(`'${s}'`).split(`"${r}"`).join(`"${s}"`);
      }
    }

    // TOC: drop NewLink/insertEntry lines for removed pages
    if (/toc/i.test(p)) {
      for (const r of removed) {
        h = h.replace(new RegExp(`^.*NewLink\\([^\\n]*${esc(r)}[^\\n]*\\r?\\n`, 'gm'), '');
      }
    }

    if (h !== text.get(p)) rewrites.set(p, h);
  }

  return { rewrites, removed };
}
