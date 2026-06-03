import { Icon } from '@/components/Icon';
import { SlideBody } from '@/components/canvas/SlideBody';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';

export function LmsPlayer() {
  const course = useCourse((s) => s.course);
  const slides = course.slides;

  const previewIndex = useUi((s) => s.previewIndex);
  const setPreviewIndex = useUi((s) => s.setPreviewIndex);
  const selectSlide = useUi((s) => s.selectSlide);
  const setMode = useUi((s) => s.setMode);

  const index = Math.min(Math.max(previewIndex, 0), slides.length - 1);
  const slide = slides[index];
  const total = slides.length;
  const pct = Math.round(((index + 1) / total) * 100);

  // navigating the player keeps the rail selection in sync (and vice-versa)
  const nav = (i: number) => {
    const clamped = Math.min(Math.max(i, 0), total - 1);
    setPreviewIndex(clamped);
    if (slides[clamped]) selectSlide(slides[clamped].id);
  };

  if (!slide) return null;

  return (
    <div style={{ flex: 1, padding: 26, display: 'flex', minHeight: 0 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 1080,
          margin: '0 auto',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--sh-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
        }}
      >
        {/* LMS top chrome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="logo" size={19} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.meta.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              Lesson {index + 1} of {total} · {pct}% complete
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 130, height: 6, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Exit preview" onClick={() => setMode('edit')}>
              <Icon name="close" size={17} />
            </button>
          </div>
        </div>

        {/* content (non-editable; reuses the same renderers) */}
        <div key={slide.id} style={{ flex: 1, overflowY: 'auto', padding: '44px 48px', animation: 'riseIn .25s ease-out', background: slide.type === 'title' ? 'var(--surface-2)' : 'var(--surface)' }}>
          <SlideBody slide={slide} editing={false} />
        </div>

        {/* LMS bottom chrome */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <button className="btn btn-soft btn-sm" disabled={index === 0} onClick={() => nav(index - 1)} style={{ opacity: index === 0 ? 0.4 : 1 }}>
            <Icon name="arrowLeft" size={15} /> Previous
          </button>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => nav(i)}
                className="tip"
                data-tip={s.name}
                style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 99, background: i === index ? 'var(--accent)' : i < index ? 'var(--green)' : 'var(--line-strong)', transition: 'all .2s' }}
              />
            ))}
          </div>
          {index === total - 1 ? (
            <button className="btn btn-primary btn-sm" onClick={() => setMode('edit')}>
              <Icon name="check" size={15} /> Finish
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => nav(index + 1)}>
              Next <Icon name="arrowRight" size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
