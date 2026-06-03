import { useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { OriginalView } from '@/components/preview/OriginalView';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { WRAPPER_PAGE } from '@/scorm/preview/fileServer';

// Full-screen faithful render of the original imported course (its launcher),
// running the real package HTML/CSS/JS exactly as an LMS would.
export function OriginalModal() {
  const setModal = useUi((s) => s.setModal);
  const launchHref = usePreview((s) => s.launchHref);
  const close = () => setModal(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,26,20,.55)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', padding: 24, animation: 'fadeIn .15s both' }} onMouseDown={close}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ flex: 1, minHeight: 0, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-pop)', overflow: 'hidden', animation: 'scaleIn .2s both' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <Icon name="eye" size={18} style={{ color: 'var(--accent)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Original course</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>The imported package, rendered exactly as your LMS would run it.</div>
          </div>
          {launchHref && (
            <a
              className="btn btn-sm btn-soft"
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                const base = await usePreview.getState().ensureMounted();
                // Open via the LMS-shim wrapper so the player finds a (stub) SCORM API.
                if (base) window.open(`${base}${WRAPPER_PAGE}?page=${encodeURIComponent(launchHref)}`, '_blank', 'noopener');
              }}
            >
              <Icon name="fullscreen" size={14} /> Open in new tab
            </a>
          )}
          <button className="btn btn-sm btn-icon btn-ghost" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: 14, background: 'var(--surface-sunk)' }}>
          <OriginalView href={launchHref} title="Original course" fill style={{ height: '100%', minHeight: 0 }} />
        </div>
      </div>
    </div>
  );
}
