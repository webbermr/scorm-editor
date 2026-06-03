// Decompose a SCO's HTML body into editable blocks where feasible. Anything that
// can't be cleanly mapped is preserved as a read-only `rawHtml` block and the
// slide is flagged (rawImported) so the UI can surface the limitation.

import { makeId } from '@/lib/id';
import type { Block } from '@/types/course';

export interface DecomposeResult {
  blocks: Block[];
  raw: boolean;
  /** body title used as the slide heading if the item title is generic */
  docTitle?: string;
  /** first heading text found — a good slide name when the manifest title is generic */
  heading?: string;
  /** true when at least one editable (non-raw) block was produced */
  hasContent: boolean;
}

// Shared page chrome that should never become editable content.
const CHROME_SELECTOR =
  'nav, header, footer, script, style, noscript, [role="navigation"], .navbar, .nav-bar, .site-header, .site-footer, .breadcrumb, .skip-link';

/** Pick the meaningful content root of a page, pruning shared nav/header/footer chrome.
 *  Mutates the parsed document in place (it's a throwaway doc) to avoid an expensive
 *  cloneNode of large, SVG-heavy authored pages. */
function pickContentRoot(body: HTMLElement): HTMLElement {
  body.querySelectorAll(CHROME_SELECTOR).forEach((n) => n.remove());
  const main = body.querySelector('main, [role="main"]') as HTMLElement | null;
  return main ?? body;
}

type ResolveImg = (src: string) => string | undefined;

const cleanText = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function mapElement(el: Element, resolveImg: ResolveImg): Block | Block[] | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3': {
      const text = cleanText(el);
      return text ? { id: makeId(), type: 'heading', text } : null;
    }
    case 'p': {
      const text = cleanText(el);
      const img = el.querySelector('img');
      if (!text && img) return mapImg(img, resolveImg); // a lone <img> wrapped in <p>
      if (!text) return null;
      return { id: makeId(), type: 'paragraph', text };
    }
    case 'ul':
    case 'ol': {
      const items = Array.from(el.querySelectorAll(':scope > li'))
        .map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return items.length ? { id: makeId(), type: 'list', items } : null;
    }
    case 'img':
      return mapImg(el as HTMLImageElement, resolveImg);
    case 'figure': {
      const img = el.querySelector('img');
      if (!img) return null;
      const block = mapImg(img, resolveImg) as Block & { type: 'image' };
      const cap = el.querySelector('figcaption');
      if (cap) block.caption = cleanText(cap);
      return block;
    }
    case 'blockquote': {
      const text = cleanText(el);
      return text ? { id: makeId(), type: 'callout', tone: 'info', title: 'Note', text } : null;
    }
    case 'div':
    case 'section':
    case 'article': {
      // Containers: recurse into their children rather than dumping raw HTML.
      const out: Block[] = [];
      for (const child of Array.from(el.children)) {
        const mapped = mapElement(child, resolveImg);
        if (mapped) {
          if (Array.isArray(mapped)) out.push(...mapped);
          else out.push(mapped);
        } else if (child.textContent?.trim() || child.querySelector('img')) {
          out.push({ id: makeId(), type: 'rawHtml', html: child.outerHTML });
        }
      }
      // If the container had only text (no element children we recognized)
      if (!out.length) {
        const text = cleanText(el);
        if (text) return { id: makeId(), type: 'paragraph', text };
        return null;
      }
      return out;
    }
    case 'script':
    case 'style':
    case 'noscript':
      return null;
    default: {
      const text = cleanText(el);
      if (!text && !el.querySelector('img')) return null;
      return { id: makeId(), type: 'rawHtml', html: el.outerHTML };
    }
  }
}

function mapImg(img: HTMLImageElement | Element, resolveImg: ResolveImg): Block {
  const rawSrc = img.getAttribute('src') ?? '';
  const url = resolveImg(rawSrc);
  return {
    id: makeId(),
    type: 'image',
    src: 'generic',
    url,
    alt: img.getAttribute('alt') ?? '',
  };
}

export function htmlToBlocks(html: string, resolveImg: ResolveImg): DecomposeResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return { blocks: [{ id: makeId(), type: 'rawHtml', html }], raw: true, hasContent: false };
  }

  const docTitle = doc.title?.trim() || undefined;
  if (!doc.body) return { blocks: [{ id: makeId(), type: 'rawHtml', html }], raw: true, hasContent: false };

  const root = pickContentRoot(doc.body);

  const blocks: Block[] = [];
  let raw = false;

  for (const child of Array.from(root.children)) {
    const mapped = mapElement(child, resolveImg);
    if (!mapped) continue;
    const arr = Array.isArray(mapped) ? mapped : [mapped];
    for (const b of arr) {
      if (b.type === 'rawHtml') raw = true;
      blocks.push(b);
    }
  }

  // Content root had only loose text nodes / nothing structural
  if (!blocks.length) {
    const text = (root.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ id: makeId(), type: 'paragraph', text });
    else {
      blocks.push({ id: makeId(), type: 'rawHtml', html: root.innerHTML });
      raw = true;
    }
  }

  const heading = blocks.find((b) => b.type === 'heading') as Extract<Block, { type: 'heading' }> | undefined;
  const hasContent = blocks.some((b) => b.type !== 'rawHtml');

  return { blocks, raw, docTitle, heading: heading?.text, hasContent };
}
