// Click-to-edit text inside the LMS Preview iframe.
//
// The preview renders the real (unedited) page. Clicking a Lectora text element
// (id="text<n>") doesn't try to edit *inside* the iframe — the player's own scripts
// fight contentEditable and swallow keystrokes. Instead we report the pick to the
// host, which shows a normal editor popover in the PARENT document (no interference)
// and live-updates the element via this controller. The export patcher
// ([[lectora-source-model]]) does the real source rewrite; the DOM change here is
// just the live preview.

export interface InlineEdit {
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
}

const TEXT_ID_RE = /^text\d+$/;

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

/** Write text back across the element's runs: each line fills one run (so paragraphs
 *  and list items keep their place, styling and bullets), extra lines spill into the
 *  last run, missing lines empty their run. Non-destructive in the preview (we don't
 *  drop <li> here so cancel can restore — the export removes empty list items). */
function setText(el: HTMLElement, text: string): void {
  const normalized = text.replace(/\r\n?/g, '\n');
  const nodes = visibleTextNodes(el);
  const K = nodes.length;
  if (!K) {
    el.textContent = normalized;
    if (normalized.includes('\n')) el.style.whiteSpace = 'pre-wrap';
    return;
  }
  const lines = normalized.split('\n');
  const M = lines.length;
  const assign: (string | null)[] = new Array(K).fill(null);
  if (M >= K) {
    for (let i = 0; i < K - 1; i++) assign[i] = lines[i];
    assign[K - 1] = lines.slice(K - 1).join('\n');
  } else {
    for (let i = 0; i < M; i++) assign[i] = lines[i];
  }
  for (let i = 0; i < K; i++) {
    nodes[i].nodeValue = assign[i] ?? '';
    if (assign[i] && assign[i]!.includes('\n')) el.style.whiteSpace = 'pre-wrap';
  }
}

// NOTE: never use `instanceof HTMLElement` here — these elements live in the iframe's
// realm, whose HTMLElement is a different constructor than the host app's, so the check
// is always false across realms. Duck-type on the properties we actually use instead.
const isTextEl = (el: Element | null): el is HTMLElement => !!el && typeof (el as HTMLElement).id === 'string' && TEXT_ID_RE.test(el.id);

const NOOP: InlineEditController = { teardown: () => {}, applyText: () => {}, setActive: () => {}, markEdited: () => {} };

/**
 * Wire up text handling on a rendered page.
 *  - Edits are ALWAYS applied to the page (so the preview reflects them whether or
 *    not editing is on), re-applied to content the player injects later via a
 *    MutationObserver, reading the edit list LIVE so newly-made edits propagate.
 *  - Click-to-edit + the hover/outline affordances are added only when `interactive`.
 */
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
  };

  const processTree = (root: Element) => {
    if (root.id && TEXT_ID_RE.test(root.id)) applyEdit(root as HTMLElement);
    root.querySelectorAll?.('[id]')?.forEach((c) => {
      if (TEXT_ID_RE.test((c as HTMLElement).id)) applyEdit(c as HTMLElement);
    });
  };

  // Every text element present now…
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[id]'))) {
    if (TEXT_ID_RE.test(el.id)) applyEdit(el);
  }

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

  // Capture phase so we beat the player's own click/navigation handlers — but only
  // for text elements; everything else (nav buttons, links) is left alone.
  let onClick: ((ev: Event) => void) | null = null;
  if (interactive) {
    onClick = (ev: Event) => {
      const target = ev.target as Element | null;
      const el = target?.closest?.('[id]') as HTMLElement | null;
      if (!isTextEl(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      // one editable line per text run (paragraph / list item)
      const current = captureRuns(el) || (el.textContent || '').trim();
      if (el.dataset.seFrom == null) el.dataset.seFrom = current;
      const from = el.dataset.seFrom;
      const r = el.getBoundingClientRect();
      handlers.onPick({ elementId: el.id, from, value: current, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
    };
    doc.addEventListener('click', onClick, true);
  }

  return {
    teardown: () => {
      if (onClick) doc.removeEventListener('click', onClick, true);
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
  };
}
