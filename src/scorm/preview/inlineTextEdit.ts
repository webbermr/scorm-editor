// Click-to-edit text inside the LMS Preview iframe.
//
// The preview renders the real (unedited) page; this overlays an editing affordance
// on Lectora text elements (id="text<n>"). Clicking one makes it contentEditable;
// on blur we report (elementId, originalText, newText) to the host, which records a
// SourceTextEdit. Existing edits are re-applied to the DOM on load so the preview is
// WYSIWYG. The export patcher ([[lectora-source-model]]) does the real source rewrite —
// this DOM manipulation is purely the live preview.

export interface InlineEdit {
  elementId: string;
  from: string;
  to: string;
}

export interface InlineEditHandlers {
  /** existing edits for the page currently shown in the iframe */
  getEdits: () => InlineEdit[];
  /** called when the user finishes editing an element */
  onEdit: (elementId: string, from: string, to: string) => void;
}

const TEXT_ID_RE = /^text\d+$/;

const EDIT_STYLE = `
  [data-se-text]:hover { outline: 2px dashed #d98a2b !important; outline-offset: 2px; cursor: text !important; }
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

const isTextEl = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && TEXT_ID_RE.test(el.id);

export function setupInlineTextEdit(doc: Document, win: Window, handlers: InlineEditHandlers): () => void {
  if (!doc.body) return () => {};

  const style = doc.createElement('style');
  style.setAttribute('data-se-style', '1');
  style.textContent = EDIT_STYLE;
  doc.head?.appendChild(style);

  // Tag every Lectora text element as editable.
  const texts = Array.from(doc.querySelectorAll<HTMLElement>('[id]')).filter((el) => TEXT_ID_RE.test(el.id));
  for (const el of texts) el.setAttribute('data-se-text', '');

  // Re-apply existing edits so the preview reflects them.
  for (const e of handlers.getEdits()) {
    const el = doc.getElementById(e.elementId);
    if (el instanceof HTMLElement) {
      setText(el, e.to);
      el.dataset.seFrom = e.from;
      if (e.to.trim() !== e.from.trim()) el.setAttribute('data-se-edited', '');
    }
  }

  const beginEdit = (el: HTMLElement) => {
    if (el.getAttribute('data-se-editing') != null) return;
    if (el.dataset.seFrom == null) el.dataset.seFrom = (el.textContent ?? '').trim();
    el.setAttribute('data-se-editing', '');
    el.setAttribute('contenteditable', 'true');
    el.focus();
    const range = doc.createRange();
    range.selectNodeContents(el);
    const sel = win.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const finishEdit = (el: HTMLElement) => {
    el.setAttribute('contenteditable', 'false');
    el.removeAttribute('data-se-editing');
    const to = (el.textContent ?? '').trim();
    const from = el.dataset.seFrom ?? to;
    if (to !== from) el.setAttribute('data-se-edited', '');
    else el.removeAttribute('data-se-edited');
    handlers.onEdit(el.id, from, to);
  };

  // Capture phase so we beat the player's own click/navigation handlers — but only
  // for text elements; everything else (nav buttons, links) is left alone.
  const onClick = (ev: Event) => {
    const target = ev.target as Element | null;
    const el = target?.closest?.('[data-se-text]') as HTMLElement | null;
    if (!isTextEl(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    beginEdit(el);
  };

  const onBlur = (ev: Event) => {
    const el = ev.target as HTMLElement | null;
    if (el?.getAttribute?.('data-se-editing') != null) finishEdit(el);
  };

  const onKey = (ev: KeyboardEvent) => {
    const el = ev.target as HTMLElement | null;
    if (el?.getAttribute?.('data-se-editing') == null) return;
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      el.blur();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      const orig = el.dataset.seFrom;
      if (orig != null) setText(el, orig);
      el.blur();
    }
  };

  doc.addEventListener('click', onClick, true);
  doc.addEventListener('blur', onBlur, true);
  doc.addEventListener('keydown', onKey, true);

  return () => {
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('blur', onBlur, true);
    doc.removeEventListener('keydown', onKey, true);
    style.remove();
    for (const el of texts) {
      el.removeAttribute('data-se-text');
      el.removeAttribute('data-se-editing');
      el.setAttribute('contenteditable', 'false');
    }
  };
}
