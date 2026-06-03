import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { TYPE_META } from '@/lib/typeMeta';
import { useUi } from '@/store/uiStore';
import { useCourse } from '@/store/courseStore';
import { usePreview } from '@/store/previewStore';
import { SlideBody } from './SlideBody';
import { OriginalView } from '@/components/preview/OriginalView';
import type { InlineEdit } from '@/scorm/preview/inlineTextEdit';
import type { Slide } from '@/types/course';

interface Props {
  slide: Slide;
  slideIndex: number;
  total: number;
}

// Authoring tools that render their slides at runtime (so we can only recover text).
const RUNTIME_TOOLS = new Set([
  'Lectora',
  'Articulate',
  'Articulate Storyline',
  'Articulate Rise',
  'Rise 360',
  'Adobe Captivate',
  'iSpring',
  'iSpring Suite',
  'Elucidat',
  'Gomo',
  'dominKnow',
  'Adapt',
  'Camtasia',
  'Easygenerator',
]);

/** Context for the "partial import" badge, tailored to the detected authoring tool. */
function partialImportTip(tool?: string): string {
  if (tool && RUNTIME_TOOLS.has(tool)) {
    return `Built with ${tool}, which renders each slide at runtime. We recovered the text into editable blocks, but images, audio/narration and the exact layout aren’t captured here — switch to “LMS Preview” to see the complete slide as learners do.`;
  }
  if (tool) {
    return `Some of this ${tool} page couldn’t be turned into editable blocks and is kept read-only. Switch to “LMS Preview” to see the full original.`;
  }
  return `Part of this slide couldn’t be fully converted into editable blocks. The text is editable; switch to “LMS Preview” to see the complete original (images, audio, layout).`;
}

export function EditCanvas({ slide, slideIndex, total }: Props) {
  const selectBlock = useUi((s) => s.selectBlock);
  const authoringTool = useCourse((s) => s.course.meta.authoringTool);
  const hasFile = usePreview((s) => !!s.file);
  const supported = usePreview((s) => s.supported);
  // an imported package with a source page for this slide → offer the toggle
  const showToggle = hasFile && !!slide.sourceHref;
  // the Original render itself needs a secure context (service worker)
  const hasOriginal = showToggle && supported;

  const [view, setView] = useState<'blocks' | 'original'>('blocks');
  const [editText, setEditText] = useState(false);
  const canEditText = authoringTool === 'Lectora';
  const editCount = useCourse((s) => s.course.textEdits?.length ?? 0);
  // reset to the editable view whenever the selected slide changes
  useEffect(() => {
    setView('blocks');
    setEditText(false);
  }, [slide.id]);

  // Stable handlers (read the store directly) — course-wide edits keyed by element id.
  const getEdits = useCallback((): InlineEdit[] => useCourse.getState().course.textEdits ?? [], []);
  const onEdit = useCallback((elementId: string, from: string, to: string) => {
    useCourse.getState().setTextEdit(elementId, from, to);
    useUi.getState().flash(to.trim() === from.trim() ? 'Reverted to original' : 'Text edited — applies on Faithful export');
  }, []);

  return (
    <div style={{ flex: 1, padding: '30px 40px', display: 'flex', justifyContent: 'center' }} onMouseDown={() => selectBlock(null)}>
      <div
        key={slide.id}
        className="card"
        style={{
          width: '100%',
          maxWidth: view === 'original' && hasOriginal ? 1240 : 880,
          alignSelf: 'flex-start',
          padding: '46px 52px',
          transition: 'max-width .2s ease',
          boxShadow: 'var(--sh-md)',
          animation: 'riseIn .28s ease-out',
          minHeight: 200,
          background: slide.type === 'title' ? 'var(--surface-2)' : 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, paddingBottom: 16, borderBottom: '1px dashed var(--line)' }}>
          <span className="badge" style={{ background: TYPE_META[slide.type].soft, color: TYPE_META[slide.type].color }}>
            <Icon name={slide.type} size={13} /> {slide.type}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            Slide {slideIndex + 1} of {total}
          </span>
          {slide.rawImported && (
            <span className="badge tip tip-rich" data-tip={partialImportTip(authoringTool)} style={{ background: 'var(--amber-soft)', color: 'var(--amber)', cursor: 'help' }}>
              <Icon name="warning" size={12} /> partial import
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {showToggle && (
              <div className="seg" onMouseDown={(e) => e.stopPropagation()}>
                <button className={view === 'blocks' ? 'on' : ''} onClick={() => setView('blocks')}>
                  <Icon name="edit" size={14} /> Blocks
                </button>
                <button
                  className={`${view === 'original' && hasOriginal ? 'on' : ''} ${supported ? '' : 'tip'}`}
                  data-tip={supported ? undefined : 'LMS Preview needs HTTPS or localhost'}
                  disabled={!supported}
                  onClick={() => supported && setView('original')}
                  style={{ opacity: supported ? 1 : 0.45, cursor: supported ? 'pointer' : 'default' }}
                >
                  <Icon name="eye" size={14} /> LMS Preview
                </button>
              </div>
            )}
            {view === 'original' && hasOriginal && canEditText && (
              <button
                className={`btn btn-sm tip ${editText ? 'btn-primary' : 'btn-soft'}`}
                data-tip={editText ? 'Done editing text' : 'Click any text on the page to edit it'}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setEditText((v) => !v)}
              >
                <Icon name={editText ? 'check' : 'edit'} size={14} /> {editText ? 'Done' : 'Edit text'}
                {editCount > 0 && (
                  <span className="badge" style={{ marginLeft: 6, background: editText ? '#fff3' : 'var(--accent-soft)', color: editText ? '#fff' : 'var(--accent-ink)' }}>
                    {editCount}
                  </span>
                )}
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={13} /> {slide.duration}
            </span>
          </div>
        </div>

        {view === 'original' && hasOriginal ? (
          <OriginalView href={slide.sourceHref ?? null} title={slide.name} editable={editText} getEdits={getEdits} onEdit={onEdit} />
        ) : (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <SlideBody slide={slide} editing />
          </div>
        )}
      </div>
    </div>
  );
}
