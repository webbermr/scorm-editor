// Right inspector — context-aware properties for the selected slide / block,
// course completion rules, and quiz settings.

function InspRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
function InspSection({ title, icon, children, right }) {
  return (
    <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
          {icon && <Icon name={icon} size={15} />} {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Inspector({ course, slide, selectedBlock, onPatchSlide, onPatchMeta, onDeleteBlock, onAddBlock, onClose }) {
  const meta = course.meta;
  const block = selectedBlock;

  return (
    <aside style={{ width: 'var(--inspector-w)', flexShrink: 0, background: 'var(--surface-2)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Inspector</span>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Hide panel" onClick={onClose}><Icon name="panelRight" size={16} /></button>
      </div>

      {/* BLOCK properties (when a block is selected in a content slide) */}
      {block && (
        <InspSection title="Selected block" icon="grip"
          right={<button className="btn btn-sm btn-icon btn-danger tip" data-tip="Delete block" onClick={() => onDeleteBlock(block.id)}><Icon name="trash" size={14} /></button>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent-ink)', marginBottom: 12 }}>
            <Icon name={block.type === 'image' ? 'image' : block.type === 'callout' ? 'info' : block.type === 'list' ? 'list' : block.type === 'video' ? 'video' : 'text'} size={17} />
            <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{block.type}</span>
          </div>
          {block.type === 'callout' && (
            <InspRow label="Tone">
              <div className="seg" style={{ width: '100%' }}>
                {['info', 'warning'].map((t) => (
                  <button key={t} className={block.tone === t ? 'on' : ''} style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}
                    onClick={() => onPatchSlide({ blocks: slide.blocks.map((b) => (b.id === block.id ? { ...b, tone: t } : b)) })}>{t}</button>
                ))}
              </div>
            </InspRow>
          )}
          {block.type === 'image' && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Click <b style={{ color: 'var(--ink-2)' }}>Replace</b> on the image to swap in your own asset. Drag-drop or browse — PNG, JPG, SVG up to 5&nbsp;MB.</div>
          )}
          {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'eyebrow') && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Click the text on the slide to edit it inline.</div>
          )}
        </InspSection>
      )}

      {/* SLIDE properties */}
      <InspSection title="Slide" icon={slide.type}>
        <InspRow label="Slide name">
          <input className="field" value={slide.name} onChange={(e) => onPatchSlide({ name: e.target.value })} />
        </InspRow>
        <InspRow label="Type">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 'var(--r-md)', background: TYPE_META[slide.type].soft, color: TYPE_META[slide.type].color }}>
            <Icon name={slide.type} size={17} />
            <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{slide.type}</span>
          </div>
        </InspRow>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <InspRow label="Status">
              <select className="field" value={slide.status} onChange={(e) => onPatchSlide({ status: e.target.value })}>
                <option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option>
              </select>
            </InspRow>
          </div>
          <div style={{ width: 96 }}>
            <InspRow label="Est. time">
              <input className="field" value={slide.duration} onChange={(e) => onPatchSlide({ duration: e.target.value })} />
            </InspRow>
          </div>
        </div>
        {(slide.type === 'content' || slide.type === 'title') && (
          <InspRow label="Add block">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[['heading', 'Heading', 'text'], ['paragraph', 'Text', 'text'], ['list', 'List', 'list'], ['image', 'Image', 'image'], ['callout', 'Callout', 'info']].map(([t, lbl, ic]) => (
                <button key={t} className="btn btn-sm btn-soft" style={{ justifyContent: 'flex-start' }} onClick={() => onAddBlock(t)}>
                  <Icon name={ic} size={14} /> {lbl}
                </button>
              ))}
            </div>
          </InspRow>
        )}
      </InspSection>

      {/* QUIZ settings */}
      {slide.type === 'quiz' && (
        <InspSection title="Quiz settings" icon="quiz">
          <Toggle label="Shuffle questions" on={slide.quiz.shuffle} onChange={(v) => onPatchSlide({ quiz: { ...slide.quiz, shuffle: v } })} />
          <Toggle label="Show feedback" on={slide.quiz.feedback} onChange={(v) => onPatchSlide({ quiz: { ...slide.quiz, feedback: v } })} />
          <InspRow label="Question type">
            <div className="seg" style={{ width: '100%' }}>
              {[['single', 'Single'], ['multiple', 'Multi-question']].map(([v, lbl]) => (
                <button key={v} className={slide.quiz.kind === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => onPatchSlide({ quiz: { ...slide.quiz, kind: v } })}>{lbl}</button>
              ))}
            </div>
          </InspRow>
        </InspSection>
      )}

      {/* COURSE / completion */}
      <InspSection title="Course completion" icon="check">
        <InspRow label="Completion rule">
          <select className="field" value={meta.masteryRule} onChange={(e) => onPatchMeta({ masteryRule: e.target.value })}>
            {window.COMPLETION_RULES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>
            {window.COMPLETION_RULES.find((r) => r.id === meta.masteryRule)?.desc}
          </div>
        </InspRow>
        <InspRow label="Passing score">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min="0" max="100" step="5" value={meta.passingScore} onChange={(e) => onPatchMeta({ passingScore: +e.target.value })} style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, width: 40, textAlign: 'right' }}>{meta.passingScore}%</span>
          </div>
        </InspRow>
        <Toggle label="Track time spent" on={meta.trackTime} onChange={(v) => onPatchMeta({ trackTime: v })} />
        <Toggle label="Allow review after pass" on={meta.allowReview} onChange={(v) => onPatchMeta({ allowReview: v })} />
      </InspSection>
    </aside>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
      <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</span>
      <button onClick={() => onChange(!on)} style={{ width: 40, height: 23, borderRadius: 99, background: on ? 'var(--accent)' : 'var(--line-strong)', padding: 2, transition: 'background .18s', flexShrink: 0 }}>
        <span style={{ display: 'block', width: 19, height: 19, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-sm)', transform: on ? 'translateX(17px)' : 'none', transition: 'transform .18s' }} />
      </button>
    </div>
  );
}

Object.assign(window, { Inspector });
