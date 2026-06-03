import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { OriginalView } from '@/components/preview/OriginalView';
import { useUi } from '@/store/uiStore';
import { useCourse } from '@/store/courseStore';
import { usePreview } from '@/store/previewStore';
import { WRAPPER_PAGE } from '@/scorm/preview/fileServer';
import type { InlineEdit } from '@/scorm/preview/inlineTextEdit';

// Full-screen faithful render of the original imported course (its launcher),
// running the real package HTML/CSS/JS exactly as an LMS would. With "Edit text"
// on, Lectora text elements become click-to-edit; changes are recorded as
// SourceTextEdits and applied on the Faithful-copy export.
export function OriginalModal() {
  const setModal = useUi((s) => s.setModal);
  const launchHref = usePreview((s) => s.launchHref);
  const tool = useCourse((s) => s.course.meta.authoringTool);
  // total recorded text edits across the course (for the header counter)
  const editCount = useCourse((s) => s.course.slides.reduce((n, sl) => n + (sl.sourceEdits?.text?.length ?? 0), 0));
  const close = () => setModal(null);

  const [editing, setEditing] = useState(false);
  const canEdit = tool === 'Lectora';

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && !editing && close();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Stable handlers (read the store directly) so toggling edits doesn't thrash the iframe.
  const getEdits = useCallback((pageHref: string): InlineEdit[] => {
    const slide = useCourse.getState().course.slides.find((s) => s.sourceHref === pageHref);
    return slide?.sourceEdits?.text ?? [];
  }, []);

  const onEdit = useCallback((pageHref: string, elementId: string, from: string, to: string) => {
    const slide = useCourse.getState().course.slides.find((s) => s.sourceHref === pageHref);
    if (!slide) {
      useUi.getState().flash('This page isn’t a slide — edit skipped');
      return;
    }
    if (to.trim() === from.trim()) return;
    useCourse.getState().setSourceTextEdit(slide.id, elementId, from, to);
    useUi.getState().flash('Text edited — applies on Faithful export');
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
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>LMS Preview — original course</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {editing ? 'Click any text to edit it. Changes apply to the Faithful-copy export.' : 'The imported package, rendered exactly as your LMS would run it.'}
            </div>
          </div>

          {canEdit && (
            <button
              className={`btn btn-sm tip ${editing ? 'btn-primary' : 'btn-soft'}`}
              data-tip={editing ? 'Done editing text' : 'Edit text on the page'}
              onClick={() => setEditing((v) => !v)}
            >
              <Icon name={editing ? 'check' : 'edit'} size={14} /> {editing ? 'Done' : 'Edit text'}
              {editCount > 0 && (
                <span className="badge" style={{ marginLeft: 6, background: editing ? '#fff3' : 'var(--accent-soft)', color: editing ? '#fff' : 'var(--accent-ink)' }}>
                  {editCount}
                </span>
              )}
            </button>
          )}

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
          <OriginalView href={launchHref} title="Original course" fill style={{ height: '100%', minHeight: 0 }} editable={editing} getEdits={getEdits} onEdit={onEdit} />
        </div>
      </div>
    </div>
  );
}
