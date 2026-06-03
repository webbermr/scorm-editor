import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/Icon';
import { usePreview } from '@/store/previewStore';
import { setupInlineTextEdit, type InlineEdit } from '@/scorm/preview/inlineTextEdit';

interface Props {
  /** package-relative path of the page to render; null shows nothing */
  href: string | null;
  style?: CSSProperties;
  title?: string;
  /** when true, fill the available height (modal); otherwise size to the page */
  fill?: boolean;
  /** enable click-to-edit text on the rendered page (Lectora pages) */
  editable?: boolean;
  /** existing text edits for the page at `pageHref` (package-relative) */
  getEdits?: (pageHref: string) => InlineEdit[];
  /** report a finished text edit on the page at `pageHref` */
  onEdit?: (pageHref: string, elementId: string, from: string, to: string) => void;
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
  // teardown for the in-iframe text editor (per loaded page)
  const editTeardownRef = useRef<(() => void) | null>(null);

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

  // (Re)attach or detach click-to-edit on the currently loaded page.
  const syncEditMode = useCallback(() => {
    editTeardownRef.current?.();
    editTeardownRef.current = null;
    if (!editable) return;
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
    if (!doc || !win) return;
    const pageHref = resolvePageHref(win);
    if (!pageHref) return;
    editTeardownRef.current = setupInlineTextEdit(doc, win, {
      getEdits: () => getEdits?.(pageHref) ?? [],
      onEdit: (id, from, to) => onEdit?.(pageHref, id, from, to),
    });
  }, [editable, getEdits, onEdit]);
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
    // (re)attach click-to-edit — also runs after the player builds its DOM
    syncEditMode();
    [400, 1200].forEach((t) => setTimeout(syncEditMode, t));
  };

  // Toggle editing on/off without a reload, and tear down on unmount / page change.
  useEffect(() => {
    syncEditMode();
    return () => {
      editTeardownRef.current?.();
      editTeardownRef.current = null;
    };
  }, [syncEditMode, src]);

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
    </div>
  );
}
