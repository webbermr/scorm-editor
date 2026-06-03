import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { TYPE_META } from '@/lib/typeMeta';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { SlideBody } from './SlideBody';
import { OriginalView } from '@/components/preview/OriginalView';
import type { Slide } from '@/types/course';

interface Props {
  slide: Slide;
  slideIndex: number;
  total: number;
}

export function EditCanvas({ slide, slideIndex, total }: Props) {
  const selectBlock = useUi((s) => s.selectBlock);
  const hasFile = usePreview((s) => !!s.file);
  const supported = usePreview((s) => s.supported);
  // an imported package with a source page for this slide → offer the toggle
  const showToggle = hasFile && !!slide.sourceHref;
  // the Original render itself needs a secure context (service worker)
  const hasOriginal = showToggle && supported;

  const [view, setView] = useState<'blocks' | 'original'>('blocks');
  // reset to the editable view whenever the selected slide changes
  useEffect(() => setView('blocks'), [slide.id]);

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
            <span className="badge" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
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
                  data-tip={supported ? undefined : 'Original view needs HTTPS or localhost'}
                  disabled={!supported}
                  onClick={() => supported && setView('original')}
                  style={{ opacity: supported ? 1 : 0.45, cursor: supported ? 'pointer' : 'default' }}
                >
                  <Icon name="eye" size={14} /> Original
                </button>
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={13} /> {slide.duration}
            </span>
          </div>
        </div>

        {view === 'original' && hasOriginal ? (
          <OriginalView href={slide.sourceHref ?? null} title={slide.name} />
        ) : (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <SlideBody slide={slide} editing />
          </div>
        )}
      </div>
    </div>
  );
}
