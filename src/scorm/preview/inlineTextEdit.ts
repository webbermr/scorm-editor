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

/** Set an element's visible text while preserving its first styled run (span/font). */
function setText(el: HTMLElement, text: string): void {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (n.nodeValue && n.nodeValue.trim()) nodes.push(n);
  }
  if (nodes.length) {
    nodes[0].nodeValue = text;
    for (let i = 1; i < nodes.length; i++) nodes[i].nodeValue = '';
  } else {
    el.textContent = text;
  }
}

// NOTE: never use `instanceof HTMLElement` here — these elements live in the iframe's
// realm, whose HTMLElement is a different constructor than the host app's, so the check
// is always false across realms. Duck-type on the properties we actually use instead.
const isTextEl = (el: Element | null): el is HTMLElement => !!el && typeof (el as HTMLElement).id === 'string' && TEXT_ID_RE.test(el.id);

const NOOP: InlineEditController = { teardown: () => {}, applyText: () => {}, setActive: () => {}, markEdited: () => {} };

export function setupInlineTextEdit(doc: Document, _win: Window, handlers: InlineEditHandlers): InlineEditController {
  if (!doc.body) return NOOP;

  const style = doc.createElement('style');
  style.setAttribute('data-se-style', '1');
  style.textContent = EDIT_STYLE;
  doc.head?.appendChild(style);

  // Tag a text element for the hover affordance + apply any saved edit to it.
  const editsById = new Map(handlers.getEdits().map((e) => [e.elementId, e]));
  const tagAndApply = (el: HTMLElement) => {
    if (el.hasAttribute('data-se-text')) return;
    el.setAttribute('data-se-text', '');
    const e = editsById.get(el.id);
    if (e) {
      setText(el, e.to);
      el.dataset.seFrom = e.from;
      if (e.to.trim() !== e.from.trim()) el.setAttribute('data-se-edited', '');
    }
  };

  // Tag every text element present now…
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[id]'))) {
    if (TEXT_ID_RE.test(el.id)) tagAndApply(el);
  }

  // …and any the player builds later (Lectora assembles some pages after load).
  // Scoped to newly-added elements, so it never re-fires on our own text edits.
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType !== 1) continue;
        const el = node as HTMLElement;
        if (el.id && TEXT_ID_RE.test(el.id)) tagAndApply(el);
        el.querySelectorAll?.('[id]')?.forEach((c) => {
          if (TEXT_ID_RE.test((c as HTMLElement).id)) tagAndApply(c as HTMLElement);
        });
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
  const onClick = (ev: Event) => {
    // match by id pattern (not the data-se-text tag) so late-built elements are
    // editable even if they weren't tagged at setup time
    const target = ev.target as Element | null;
    const el = target?.closest?.('[id]') as HTMLElement | null;
    if (!isTextEl(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const current = (el.textContent ?? '').trim();
    if (el.dataset.seFrom == null) el.dataset.seFrom = current;
    const from = el.dataset.seFrom;
    const r = el.getBoundingClientRect();
    handlers.onPick({ elementId: el.id, from, value: current, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
  };

  doc.addEventListener('click', onClick, true);

  return {
    teardown: () => {
      doc.removeEventListener('click', onClick, true);
      try { observer.disconnect(); } catch { /* */ }
      style.remove();
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
