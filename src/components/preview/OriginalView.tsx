import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';
import { usePreview } from '@/store/previewStore';
import { setupInlineTextEdit, type InlineEdit, type InlineEditController, type PickInfo } from '@/scorm/preview/inlineTextEdit';

interface ActiveEdit {
  elementId: string;
  from: string; // true original (for revert / clearing)
  opened: string; // text shown when the popover opened (for cancel)
  value: string; // current draft text
  left: number; // popover anchor (viewport coords)
  top: number;
}

interface Props {
  /** package-relative path of the page to render; null shows nothing */
  href: string | null;
  style?: CSSProperties;
  title?: string;
  /** when true, fill the available height (modal); otherwise size to the page */
  fill?: boolean;
  /** enable click-to-edit text on the rendered page (Lectora pages) */
  editable?: boolean;
  /** existing text edits (course-wide, keyed by element id) */
  getEdits?: () => InlineEdit[];
  /** report a finished text edit */
  onEdit?: (elementId: string, from: string, to: string) => void;
}

// Renders an imported package's original page in an iframe served by the in-app
// file server, so it appears exactly as the LMS would render it. The iframe is
// sized to the available width so responsive authored pages reflow to their
// desktop layout natively (no shrinking, no clipped headers); height is the real
// content height for document-flow pages, or a slide-ratio viewport for
// fixed-window (height:100%) pages like Lectora.
export function OriginalView({ href, style, title = 'Original page', fill = false, editable = false, getEdits, onEdit }: Props) {
  const ensureMounted = usePreview((s) => s.ensureMounted);
  const supported = usePreview((s) => s.supported);
  const hasFile = usePreview((s) => !!s.file);

  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // sticky document-flow classification (reset per page) — see fit()
  const flowRef = useRef(false);
  // controller for the in-iframe text editor (per loaded page)
  const editCtrlRef = useRef<InlineEditController | null>(null);
  // the page the controller is currently set up for (so re-syncs are idempotent and
  // don't tear down an in-progress edit — see syncEditMode)
  const setupPageRef = useRef<string | null>(null);
  // the text element currently being edited via the popover (parent-document input)
  const [active, setActive] = useState<ActiveEdit | null>(null);
  const activeRef = useRef<ActiveEdit | null>(null);
  activeRef.current = active;

  // Resolve the iframe's current page back to a package-relative href.
  const resolvePageHref = (win: Window): string | null => {
    let path: string;
    try {
      path = decodeURIComponent(win.location.pathname);
    } catch {
      return null;
    }
    const base = usePreview.getState().base;
    if (base && path.startsWith(base)) return path.slice(base.length);
    const m = path.match(/\/scorm-fs\/[^/]+\/(.*)$/);
    return m ? m[1] : null;
  };

  // Map an element's iframe-viewport rect to a popover anchor in parent coords.
  const onPick = useCallback((info: PickInfo) => {
    const iframe = iframeRef.current;
    const fr = iframe?.getBoundingClientRect();
    const left = (fr?.left ?? 0) + info.rect.left;
    const top = (fr?.top ?? 0) + info.rect.top + info.rect.height;
    editCtrlRef.current?.setActive(info.elementId);
    setActive({ elementId: info.elementId, from: info.from, opened: info.value, value: info.value, left, top });
  }, []);

  const detachEdit = useCallback(() => {
    editCtrlRef.current?.teardown();
    editCtrlRef.current = null;
    setupPageRef.current = null;
    setActive(null);
  }, []);

  // Attach click-to-edit to the currently loaded page. Idempotent: if the controller
  // is already set up for this same page it does NOTHING — so the repeated post-load
  // syncs (and any stray load events) can't tear down a popover edit in progress.
  // Only a genuine page change or turning editing off resets it.
  const syncEditMode = useCallback(() => {
    if (!editable) {
      detachEdit();
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;
    let doc: Document | null = null;
    let win: Window | null = null;
    try {
      doc = iframe.contentDocument;
      win = iframe.contentWindow;
    } catch {
      return; // cross-origin (shouldn't happen)
    }
    if (!doc || !doc.body || !win) return; // page not ready yet
    // Use the page URL only to detect real navigation (multi-file Lectora). In
    // single-page/titlemgr builds the URL is stable and the controller's observer
    // handles dynamically-swapped content.
    const pageHref = resolvePageHref(win) ?? win.location.pathname;
    // already wired for this exact page → leave the active edit untouched
    if (editCtrlRef.current && setupPageRef.current === pageHref) return;
    // different page (or first time) → reset and re-attach
    editCtrlRef.current?.teardown();
    setActive(null);
    setupPageRef.current = pageHref;
    editCtrlRef.current = setupInlineTextEdit(doc, win, {
      getEdits: () => getEdits?.() ?? [],
      onPick,
    });
  }, [editable, getEdits, onPick, detachEdit]);

  // Commit / cancel the active popover edit.
  const commitActive = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    const value = a.value.trim();
    editCtrlRef.current?.applyText(a.elementId, value);
    editCtrlRef.current?.markEdited(a.elementId, value !== a.from.trim());
    editCtrlRef.current?.setActive(null);
    onEdit?.(a.elementId, a.from, value);
    setActive(null);
  }, [onEdit]);

  const cancelActive = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    editCtrlRef.current?.applyText(a.elementId, a.opened); // restore what was shown
    editCtrlRef.current?.setActive(null);
    setActive(null);
  }, []);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [size, setSize] = useState({ w: 0, h: 520 });

  useEffect(() => {
    let cancelled = false;
    flowRef.current = false; // re-classify for the new page
    setState('loading');
    setSrc(null);
    if (!supported || !hasFile || !href) {
      setState('error');
      return;
    }
    ensureMounted().then((base) => {
      if (cancelled) return;
      if (!base) {
        setState('error');
        return;
      }
      setSrc(base + href);
      setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [href, supported, hasFile, ensureMounted]);

  const fit = useCallback(() => {
    const iframe = iframeRef.current;
    const wrap = wrapRef.current;
    if (!iframe || !wrap) return;
    const containerW = wrap.clientWidth;
    if (!containerW) return;

    // only update state when the size actually changes (avoids a render→measure loop)
    const apply = (w: number, h: number) => setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));

    if (fill) {
      // Modal: fill the available area; the page (course player) reflows to fit.
      apply(containerW, wrap.clientHeight || 600);
      return;
    }

    let sh = 0;
    try {
      const doc = iframe.contentDocument;
      if (doc?.body) sh = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    } catch {
      /* cross-origin (shouldn't happen) — keep the viewport default */
    }

    // Classify document-flow vs fixed-window. A page whose content overflows a frame
    // shorter than itself is document-flow; one that fills whatever height we give it
    // is a fixed-window slide. The flag is STICKY (only flips to document-flow), so we
    // never shrink back to the viewport height once the content height is known —
    // which is what caused the grow/shrink flicker.
    const probe = iframe.clientHeight || 600;
    if (sh > probe + 80) flowRef.current = true;

    const h = flowRef.current && sh ? Math.min(sh, 20000) : Math.round(containerW * 0.62);
    apply(containerW, h);
  }, [fill]);

  const onLoad = () => {
    setState('ready');
    // Read-only preview: silence the embedded player's own LMS/persistence alerts.
    try {
      const win = iframeRef.current?.contentWindow as (Window & { print?: () => void }) | null | undefined;
      if (win) {
        win.alert = () => {};
        win.print = () => {};
      }
    } catch {
      /* cross-origin — ignore */
    }
    fit();
    // re-measure as authored pages build their DOM via scripts after load
    [250, 700, 1500, 2800].forEach((t) => setTimeout(fit, t));
    // attach click-to-edit once; the controller's MutationObserver handles any
    // text elements the player builds later (no re-sync — that would clobber edits).
    syncEditMode();
  };

  // Toggle editing on/off without a reload, and tear down on unmount / page change.
  useEffect(() => {
    syncEditMode();
    return () => detachEdit();
  }, [syncEditMode, src, detachEdit]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fit, src]);

  const frame: CSSProperties = {
    width: '100%',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-lg)',
    background: '#fff',
    boxShadow: 'var(--sh-sm)',
    overflow: 'hidden',
    ...style,
  };

  if (state === 'error') {
    return (
      <div style={{ ...frame, display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>
        <div>
          <Icon name="warning" size={22} />
          <div style={{ marginTop: 8, fontSize: 13.5 }}>
            {!supported
              ? 'Original view needs a browser with service workers.'
              : !hasFile
                ? 'Re-import the package to view the original.'
                : 'No original page for this slide.'}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'loading' || !src) {
    return (
      <div style={{ ...frame, display: 'grid', placeItems: 'center', minHeight: 200, color: 'var(--ink-3)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="refresh" size={16} className="spin" /> Loading original…
        </div>
      </div>
    );
  }

  const wrapStyle: CSSProperties = fill ? frame : { ...frame, height: size.h };

  return (
    <div ref={wrapRef} style={wrapStyle}>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        onLoad={onLoad}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        scrolling="auto"
        style={{ border: 0, width: '100%', height: fill ? '100%' : size.h, display: 'block', background: '#fff' }}
      />
      {active && (
        <TextEditPopover
          active={active}
          onChange={(value) => {
            setActive((a) => (a ? { ...a, value } : a));
            editCtrlRef.current?.applyText(active.elementId, value);
          }}
          onSave={commitActive}
          onCancel={cancelActive}
        />
      )}
    </div>
  );
}

// Small editor rendered in the PARENT document (so the player's scripts can't
// interfere with typing). Anchored under the clicked element, clamped to the viewport.
function TextEditPopover({
  active,
  onChange,
  onSave,
  onCancel,
}: {
  active: ActiveEdit;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.select();
    }
  }, [active.elementId]);

  const W = 360;
  const left = Math.max(8, Math.min(active.left, window.innerWidth - W - 8));
  const top = Math.max(8, Math.min(active.top + 6, window.innerHeight - 180));
  // savable when the draft differs from what was shown when the popover opened —
  // this allows reverting an existing edit back to the original (clears it).
  const changed = active.value.trim() !== active.opened.trim();

  // Portal to <body> so the modal's backdrop-filter / overflow:hidden can't clip us.
  return createPortal(
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left, top, width: W, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-pop)', padding: 12, animation: 'scaleIn .12s both' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon name="edit" size={13} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Edit text</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{active.elementId}</span>
      </div>
      <textarea
        ref={taRef}
        value={active.value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        rows={3}
        style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.45, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginRight: 'auto' }}>⌘/Ctrl+Enter to save · Esc to cancel</span>
        <button className="btn btn-sm btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={onCancel}>
          {changed ? 'Cancel' : 'Close'}
        </button>
        <button className="btn btn-sm btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={onSave} disabled={!changed}>
          <Icon name="check" size={13} /> Save
        </button>
      </div>
    </div>,
    document.body,
  );
}
