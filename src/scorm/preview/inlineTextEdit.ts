// Click-to-edit text inside the LMS Preview iframe.
//
// The preview renders the real (unedited) page. Clicking a Lectora text element
// (id="text<n>") doesn't try to edit *inside* the iframe — the player's own scripts
// fight contentEditable and swallow keystrokes. Instead we report the pick to the
// host, which shows a normal editor popover in the PARENT document (no interference)
// and live-updates the element via this controller. The export patcher
// ([[lectora-source-model]]) does the real source rewrite; the DOM change here is
// just the live preview.

import type { OverlayChanges } from '@/types/course';
import { alignLines } from '@/scorm/edit/alignLines';

export interface InlineEdit extends OverlayChanges {
  elementId: string;
  from: string;
  to: string;
}

export interface PickInfo {
  elementId: string;
  /** the true original text (for the edit record / revert) */
  from: string;
  /** the currently displayed text (original, or a previously-saved edit) */
  value: string;
  /** element bounds within the iframe viewport, for positioning the popover */
  rect: { top: number; left: number; width: number; height: number };
}

export interface InlineEditHandlers {
  /** existing edits for the page currently shown in the iframe */
  getEdits: () => InlineEdit[];
  /** the user clicked a text element to edit it */
  onPick: (info: PickInfo) => void;
}

export interface InlineEditController {
  teardown: () => void;
  /** live-update an element's visible text as the user types in the host popover */
  applyText: (elementId: string, text: string) => void;
  /** show the solid "editing" outline on one element (or clear with null) */
  setActive: (elementId: string | null) => void;
  /** toggle the dashed "edited" marker on an element */
  markEdited: (elementId: string, edited: boolean) => void;
  /** After a text change: clickable objects laid over the text whose words are gone
   *  (switch off — the hotspot left when "SAVE & EXIT" is deleted) or have moved
   *  (shift — "Resources" sliding left when "Home" is deleted). Measured on the
   *  live page against the layout noted when the text was picked for editing. */
  overlayChanges: (elementId: string) => OverlayChanges;
  /** re-apply overlay hide/move state from the current edits (after a save) */
  refreshOverlays: () => void;
}

const TEXT_ID_RE = /^text\d+$/;
/** Lectora object ids (buttons, images, shapes, text) — candidates for click overlays */
const OBJ_ID_RE = /^(button|image|shape|text)\d+$/;

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const area = (r: Rect) => Math.max(0, r.width) * Math.max(0, r.height);
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** A clickable Lectora object: it (or an inner part, e.g. its image-map link)
 *  carries a mouse/click handler or a link. Read from the DOM — in single-page
 *  (titlemgr) builds the page's script objects aren't reliably reachable. */
function isClickableObj(el: Element): boolean {
  if (!OBJ_ID_RE.test(el.id)) return false;
  type Handlers = { onmouseup?: unknown; onmousedown?: unknown; onclick?: unknown };
  return [el, ...Array.from(el.querySelectorAll('*'))].some((n) => {
    const h = n as unknown as Handlers;
    return !!(h.onmouseup || h.onmousedown || h.onclick) || ((n.tagName === 'A' || n.tagName === 'AREA') && n.hasAttribute('href'));
  });
}

/** The Lectora object element a clicked node belongs to — the hit target is often
 *  an inner part with a suffixed id (`button63018MapArea`, `…Img`). */
function objectElementFor(doc: Document, node: Element | null): HTMLElement | null {
  for (let n: Element | null = node; n; n = n.parentElement) {
    const m = n.id ? /^(?:button|image|shape)\d+/.exec(n.id) : null;
    if (m) return doc.getElementById(m[0]);
  }
  return null;
}

/** Is `el` laid over the text element `textEl` (mostly inside its box)? */
function isOverlayOn(el: Element, textEl: Element): boolean {
  const r = el.getBoundingClientRect();
  return area(r) > 0 && overlap(r, textEl.getBoundingClientRect()) >= 0.7 * area(r);
}

const EDIT_STYLE = `
  [data-se-text]:hover { outline: 2px dashed #d98a2b !important; outline-offset: 2px; cursor: pointer !important; }
  [data-se-editing] { outline: 2px solid #2b8a3e !important; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(43,138,62,.15) !important; }
  [data-se-edited] { outline: 1px dashed rgba(43,138,62,.7) !important; outline-offset: 2px; }
`;

/** The element's visible text runs (non-whitespace text nodes), one per line. */
function visibleTextNodes(el: HTMLElement): Text[] {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (n.nodeValue && n.nodeValue.trim()) nodes.push(n);
  }
  return nodes;
}

/** Read an element's editable text: one run (paragraph / list item) per line. */
function captureRuns(el: HTMLElement): string {
  return visibleTextNodes(el)
    .map((n) => (n.nodeValue ?? '').trim())
    .join('\n');
}

/** Write text back into the element's runs: each line to its own run, matched by
 *  content (see alignLines) so paragraphs, list items and inline links keep their
 *  place and styling; a run whose line was deleted is emptied. Non-destructive in
 *  the preview (we don't drop <li> here so cancel can restore — the export removes
 *  empty list items and links). */
function setText(el: HTMLElement, text: string): void {
  const normalized = text.replace(/\r\n?/g, '\n');
  const nodes = visibleTextNodes(el);
  if (!nodes.length) {
    el.textContent = normalized;
    if (normalized.includes('\n')) el.style.whiteSpace = 'pre-wrap';
    return;
  }
  const assign = alignLines(
    nodes.map((n) => (n.nodeValue ?? '').trim()),
    normalized.split('\n'),
  );
  nodes.forEach((node, i) => {
    const text = assign[i];
    if (text == null) {
      node.nodeValue = '';
      return;
    }
    // keep the run's own edge spacing, which the editor's trimmed lines don't carry
    const [, lead, , trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.nodeValue ?? '')!;
    node.nodeValue = (/^\s/.test(text) ? '' : lead) + text + (/\s$/.test(text) ? '' : trail);
    if (text.includes('\n')) el.style.whiteSpace = 'pre-wrap';
  });
}

// NOTE: never use `instanceof HTMLElement` here — these elements live in the iframe's
// realm, whose HTMLElement is a different constructor than the host app's, so the check
// is always false across realms. Duck-type on the properties we actually use instead.
const isTextEl = (el: Element | null): el is HTMLElement => !!el && typeof (el as HTMLElement).id === 'string' && TEXT_ID_RE.test(el.id);

const NOOP: InlineEditController = {
  teardown: () => {},
  applyText: () => {},
  setActive: () => {},
  markEdited: () => {},
  overlayChanges: () => ({}),
  refreshOverlays: () => {},
};

/**
 * Wire up text handling on a rendered page.
 *  - Edits are ALWAYS applied to the page (so the preview reflects them whether or
 *    not editing is on), re-applied to content the player injects later via a
 *    MutationObserver, reading the edit list LIVE so newly-made edits propagate.
 *  - Click-to-edit + the hover/outline affordances are added only when `interactive`.
 */
/** An element's visible text as one string (runs joined by newlines), with each
 *  run's offset so string positions map back to DOM text for measuring. */
interface TextIndex {
  text: string;
  runs: Array<{ node: Text; start: number }>;
}

function indexText(el: HTMLElement): TextIndex {
  const runs: TextIndex['runs'] = [];
  let text = '';
  for (const node of visibleTextNodes(el)) {
    if (runs.length) text += '\n';
    runs.push({ node, start: text.length });
    text += node.nodeValue ?? '';
  }
  return { text, runs };
}

/** Screen box of text[start, end) — may span runs. */
function textRect(doc: Document, idx: TextIndex, start: number, end: number): DOMRect | null {
  const at = (pos: number) => {
    for (let i = idx.runs.length - 1; i >= 0; i--) {
      const r = idx.runs[i];
      if (pos >= r.start) return { node: r.node, offset: Math.min(pos - r.start, r.node.length) };
    }
    return null;
  };
  const a = at(start);
  const b = at(end);
  if (!a || !b) return null;
  const range = doc.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  const box = range.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
}

/** Where an overlay sat on its text when picked: the words under it, and its
 *  offset from them (so it can follow them if they move). */
interface OverlayAnchor {
  /** the words under the overlay */
  words: string;
  /** position of those words in the text (for in-order matching) */
  start: number;
  /** overlay's top-left minus the words' top-left, in screen px */
  gapX: number;
  gapY: number;
  /** shift already applied to the overlay (page px) */
  offX: number;
  offY: number;
  /** screen px per page px (the player may scale the page) */
  scale: number;
}

export function setupInlineTextEdit(doc: Document, _win: Window, handlers: InlineEditHandlers, interactive: boolean): InlineEditController {
  if (!doc.body) return NOOP;

  let style: HTMLStyleElement | null = null;
  if (interactive) {
    style = doc.createElement('style');
    style.setAttribute('data-se-style', '1');
    style.textContent = EDIT_STYLE;
    doc.head?.appendChild(style);
  }

  // Apply the current saved edit (looked up LIVE) to a text element, and add the
  // editing affordances when interactive.
  const applyEdit = (el: HTMLElement) => {
    if (el.getAttribute('data-se-editing') != null) return; // mid-edit — leave it
    const e = handlers.getEdits().find((x) => x.elementId === el.id);
    if (e) {
      if (el.dataset.seApplied !== e.to) {
        setText(el, e.to);
        el.dataset.seApplied = e.to;
      }
      el.dataset.seFrom = e.from;
    }
    if (interactive) {
      el.setAttribute('data-se-text', '');
      if (e && e.to.trim() !== e.from.trim()) el.setAttribute('data-se-edited', '');
      else el.removeAttribute('data-se-edited');
    }
    // Emptied text removes the element for learners — its box, and any link on it —
    // as the export does. While editing it stays visible and clickable so the
    // author can pick it again to restore the text.
    if (e && !e.to.trim() && !interactive) {
      el.style.display = 'none';
      el.dataset.seRemoved = '1';
    } else if (el.dataset.seRemoved) {
      el.style.display = ''; // only undo what we set; never the player's own value
      delete el.dataset.seRemoved;
    }
  };

  // Overlays switched off by an edit (a deleted link's hotspot) are hidden for
  // learners; while editing they stay, since clicks there open the text editor.
  // Overlays an edit moved (their words shifted) follow them in both modes.
  const applyOverlay = (el: HTMLElement) => {
    const edits = handlers.getEdits();
    const hide = !interactive && edits.some((e) => e.hideObjects?.includes(el.id));
    if (hide) {
      el.style.display = 'none';
      el.dataset.seRemoved = '1';
    } else if (el.dataset.seRemoved && !TEXT_ID_RE.test(el.id)) {
      el.style.display = '';
      delete el.dataset.seRemoved;
    }
    const move = edits.find((e) => e.moveObjects?.[el.id])?.moveObjects?.[el.id];
    if (move) {
      el.style.translate = `${move.dx}px ${move.dy}px`; // separate from the player's own transform
      el.dataset.seDx = String(move.dx);
      el.dataset.seDy = String(move.dy);
    } else if (el.dataset.seDx != null) {
      el.style.translate = '';
      delete el.dataset.seDx;
      delete el.dataset.seDy;
    }
  };

  const visit = (el: HTMLElement) => {
    if (TEXT_ID_RE.test(el.id)) applyEdit(el);
    else if (OBJ_ID_RE.test(el.id)) applyOverlay(el);
  };

  const processTree = (root: Element) => {
    if (root.id) visit(root as HTMLElement);
    root.querySelectorAll?.('[id]')?.forEach((c) => visit(c as HTMLElement));
  };

  // Every text element (and overlay) present now…
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[id]'))) visit(el);

  // …and any the player builds or swaps in later (Lectora titlemgr pages inject
  // content client-side). Scoped to added nodes; reads edits live each time.
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType === 1) processTree(node as Element);
      }
    }
  });
  try {
    observer.observe(doc.body, { childList: true, subtree: true });
  } catch {
    /* ignore */
  }

  // Clickable overlays sitting on each text element, noted when it's picked for
  // editing — i.e. while its current text is laid out (the element's box shrinks
  // to fit once words are deleted, so it can't be measured afterwards) — with the
  // words each one covers, so after the edit it can follow them or be switched off.
  const overlaysOn = new Map<string, Map<string, OverlayAnchor>>();
  const noteOverlays = (textEl: HTMLElement) => {
    const found = new Map<string, OverlayAnchor>();
    const overlays = Array.from(doc.querySelectorAll<HTMLElement>('[id]')).filter(
      (el) => el !== textEl && !TEXT_ID_RE.test(el.id) && isClickableObj(el) && isOverlayOn(el, textEl),
    );
    if (overlays.length) {
      const idx = indexText(textEl);
      // Whole words (not separators like "|" or "&"), each given to the overlay it
      // overlaps most — hotspots are drawn roughly over their words, and the browser
      // may render the font wider than the authoring tool did, so edges don't line up.
      const words: Array<{ start: number; end: number; box: DOMRect }> = [];
      for (const m of idx.text.matchAll(/\S+/g)) {
        if (!/[\p{L}\p{N}]/u.test(m[0])) continue;
        const box = textRect(doc, idx, m.index!, m.index! + m[0].length);
        if (box) words.push({ start: m.index!, end: m.index! + m[0].length, box });
      }
      const rects = overlays.map((el) => el.getBoundingClientRect());
      const mine = overlays.map(() => [] as typeof words);
      for (const w of words) {
        let best = -1;
        let most = 0;
        rects.forEach((r, i) => {
          if (!(w.box.bottom > r.top && w.box.top < r.bottom)) return;
          const ov = Math.min(w.box.right, r.right) - Math.max(w.box.left, r.left);
          if (ov > most) [best, most] = [i, ov];
        });
        if (best >= 0) mine[best].push(w);
      }
      overlays.forEach((el, i) => {
        const r = rects[i];
        const offX = Number(el.dataset.seDx ?? 0);
        const offY = Number(el.dataset.seDy ?? 0);
        const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
        const ws = mine[i];
        // No words under it: it isn't a link on this text (e.g. a popup's close
        // button in an empty corner of the box) — leave it alone.
        if (!ws.length) return;
        const start = ws[0].start;
        const end = ws[ws.length - 1].end;
        const box = textRect(doc, idx, start, end) ?? ws[0].box;
        found.set(el.id, { words: idx.text.slice(start, end), start, gapX: r.left - box.left, gapY: r.top - box.top, offX, offY, scale });
      });
    }
    overlaysOn.set(textEl.id, found);
  };

  // The text element a pointer event is really aimed at: the text itself, or text
  // under a clickable overlay (an invisible hotspot over "SAVE & EXIT") — whose
  // action must not fire while editing.
  const textTarget = (ev: Event): HTMLElement | null => {
    const target = ev.target as Element | null;
    const el = target?.closest?.('[id]') as HTMLElement | null;
    if (isTextEl(el)) return el;
    const overlay = objectElementFor(doc, target);
    if (!overlay || !isClickableObj(overlay)) return null;
    const { clientX: x, clientY: y } = ev as MouseEvent;
    const under = doc.elementsFromPoint?.(x, y) ?? [];
    return (under.map((u) => u.closest?.('[id]')).find((u) => isTextEl(u) && isOverlayOn(overlay, u)) as HTMLElement | undefined) ?? null;
  };

  // Capture phase so we beat the player's own handlers (Lectora acts on mouseup,
  // before click) — but only for text; everything else (nav buttons) is left alone.
  let onClick: ((ev: Event) => void) | null = null;
  let swallow: ((ev: Event) => void) | null = null;
  if (interactive) {
    swallow = (ev: Event) => {
      if (!textTarget(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
    };
    onClick = (ev: Event) => {
      const el = textTarget(ev);
      if (!el) return;
      ev.preventDefault();
      ev.stopPropagation();
      noteOverlays(el);
      // one editable line per text run (paragraph / list item)
      const current = captureRuns(el) || (el.textContent || '').trim();
      if (el.dataset.seFrom == null) el.dataset.seFrom = current;
      const from = el.dataset.seFrom;
      const r = el.getBoundingClientRect();
      handlers.onPick({ elementId: el.id, from, value: current, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    doc.addEventListener('click', onClick, true);
    for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) doc.addEventListener(t, swallow, true);
  }

  return {
    teardown: () => {
      if (onClick) doc.removeEventListener('click', onClick, true);
      if (swallow) for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup']) doc.removeEventListener(t, swallow, true);
      try { observer.disconnect(); } catch { /* */ }
      style?.remove();
      doc.querySelectorAll('[data-se-text]').forEach((el) => {
        el.removeAttribute('data-se-text');
        el.removeAttribute('data-se-editing');
      });
    },
    applyText: (elementId, text) => {
      const el = doc.getElementById(elementId) as HTMLElement | null;
      if (el) setText(el, text);
    },
    setActive: (elementId) => {
      doc.querySelectorAll('[data-se-editing]').forEach((e) => e.removeAttribute('data-se-editing'));
      if (elementId) doc.getElementById(elementId)?.setAttribute('data-se-editing', '');
    },
    markEdited: (elementId, edited) => {
      const el = doc.getElementById(elementId);
      if (!el) return;
      if (edited) el.setAttribute('data-se-edited', '');
      else el.removeAttribute('data-se-edited');
    },
    overlayChanges: (elementId) => {
      const textEl = doc.getElementById(elementId) as HTMLElement | null;
      const prior = handlers.getEdits().find((e) => e.elementId === elementId);
      const anchors = overlaysOn.get(elementId) ?? new Map<string, OverlayAnchor>();
      const hide = new Set<string>();
      const move: Record<string, { dx: number; dy: number }> = {};
      // overlays not measured this time (e.g. not on this page) keep earlier decisions
      for (const id of prior?.hideObjects ?? []) if (!anchors.has(id)) hide.add(id);
      for (const [id, m] of Object.entries(prior?.moveObjects ?? {})) if (!anchors.has(id)) move[id] = m;
      if (!textEl) return { hideObjects: [...hide], moveObjects: move };

      const idx = indexText(textEl);
      const round = (n: number) => Math.round(n * 100) / 100;
      const ordered = [...anchors].sort((x, y) => x[1].start - y[1].start);
      // 1) overlays whose words are still there follow them (matched in reading order)
      const claimed: DOMRect[] = []; // where those words now are
      const unmatched: Array<[string, OverlayAnchor]> = [];
      let cursor = 0;
      for (const [id, a] of ordered) {
        const el = doc.getElementById(id);
        if (!el) continue;
        const at = idx.text.indexOf(a.words, cursor);
        const w = at >= 0 ? textRect(doc, idx, at, at + a.words.length) : null;
        if (!w) {
          unmatched.push([id, a]);
          continue;
        }
        cursor = at + a.words.length;
        claimed.push(w);
        const r = el.getBoundingClientRect();
        const dx = round(a.offX + (w.left + a.gapX - r.left) / a.scale);
        const dy = round(a.offY + (w.top + a.gapY - r.top) / a.scale);
        if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) move[id] = { dx, dy };
      }
      // 2) the rest lost their words. If what's under them now is another link's
      //    words (they slid in from the right) or nothing, switch them off; if it's
      //    unclaimed text, the words were probably reworded — leave the link alone.
      const hits = (b: DOMRect | Rect, x: number, r: DOMRect) => x >= b.left && x <= b.right && b.bottom > r.top && b.top < r.bottom;
      for (const [id, a] of unmatched) {
        const r = doc.getElementById(id)!.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const onText = idx.runs.some(({ node }) => {
          const range = doc.createRange();
          range.selectNodeContents(node);
          return Array.from(range.getClientRects()).some((b) => hits(b, cx, r));
        });
        if (!onText || claimed.some((w) => hits(w, cx, r))) hide.add(id);
        else if (a.offX || a.offY) move[id] = { dx: a.offX, dy: a.offY };
      }
      for (const id of hide) delete move[id];
      return { hideObjects: [...hide], moveObjects: move };
    },
    refreshOverlays: () => {
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[id]'))) {
        if (OBJ_ID_RE.test(el.id) && !TEXT_ID_RE.test(el.id)) applyOverlay(el);
      }
    },
  };
}
