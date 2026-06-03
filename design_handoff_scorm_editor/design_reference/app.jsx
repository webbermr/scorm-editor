// SCORM Editor — main app shell, state, history, top bar, Tweaks.

const ACCENTS = {
  Violet: { accent: '#6d4ee0', press: '#5a3dc8', soft: '#efe9ff', ink: '#4a2fb0' },
  Teal: { accent: '#0d9488', press: '#0b7d73', soft: '#d9f3f0', ink: '#0a6b62' },
  Coral: { accent: '#e2563c', press: '#c9462e', soft: '#fce4dd', ink: '#b23a25' },
  Indigo: { accent: '#3f5bd9', press: '#3349bd', soft: '#e4e8fc', ink: '#2a3aa0' },
};
const FONTS = {
  'Bricolage + Hanken': { display: "'Bricolage Grotesque'", ui: "'Hanken Grotesk'" },
  'Hanken': { display: "'Hanken Grotesk'", ui: "'Hanken Grotesk'" },
  'Fraunces + Hanken': { display: "'Fraunces'", ui: "'Hanken Grotesk'" },
  'Space Grotesk': { display: "'Space Grotesk'", ui: "'Space Grotesk'" },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "Violet",
  "font": "Bricolage + Hanken",
  "density": "regular",
  "dark": false
}/*EDITMODE-END*/;

function TopBar({ course, mode, setMode, onPatchMeta, inspectorOpen, setInspectorOpen, onExport, canUndo, canRedo, onUndo, onRedo, dirty, onSave }) {
  const m = course.meta;
  return (
    <header style={{ height: 'var(--topbar-h)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', zIndex: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="logo" size={20} /></div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>Coursewright</span>
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
      {/* course title (editable) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <input value={m.title} onChange={(e) => onPatchMeta({ title: e.target.value })}
          style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, border: '1px solid transparent', background: 'transparent', borderRadius: 8, padding: '5px 9px', width: 'clamp(220px, 30vw, 460px)', color: 'var(--ink)', transition: 'all .15s' }}
          onFocus={(e) => { e.target.style.background = 'var(--surface-2)'; e.target.style.borderColor = 'var(--line)'; }}
          onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }} />
        <span className="badge badge-mono" style={{ background: 'var(--surface-sunk)', color: 'var(--ink-2)' }}>SCORM {m.scormVersion}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* undo / redo */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Undo" onClick={onUndo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : .35 }}><Icon name="undo" size={17} /></button>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Redo" onClick={onRedo} disabled={!canRedo} style={{ opacity: canRedo ? 1 : .35 }}><Icon name="redo" size={17} /></button>
      </div>

      {/* mode toggle */}
      <div className="seg">
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}><Icon name="edit" size={15} /> Edit</button>
        <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}><Icon name="eye" size={15} /> Preview</button>
      </div>

      <button className={`btn btn-sm btn-icon btn-ghost tip ${inspectorOpen ? '' : ''}`} data-tip={inspectorOpen ? 'Hide inspector' : 'Show inspector'} onClick={() => setInspectorOpen((v) => !v)}
        style={{ color: inspectorOpen ? 'var(--accent)' : 'var(--ink-2)' }}><Icon name="panelRight" size={18} /></button>

      <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
      <button className="btn btn-soft" onClick={onSave}><Icon name="save" size={16} /> {dirty ? 'Save' : 'Saved'}</button>
      <button className="btn btn-primary" onClick={onExport}><Icon name="download" size={16} /> Export</button>
    </header>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [imported, setImported] = React.useState(false);
  const [course, setCourse] = React.useState(() => JSON.parse(JSON.stringify(window.SAMPLE_COURSE)));
  const [past, setPast] = React.useState([]);
  const [future, setFuture] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(window.SAMPLE_COURSE.slides[0].id);
  const [mode, setMode] = React.useState('edit');
  const [selBlock, setSelBlock] = React.useState(null);
  const [inspectorOpen, setInspectorOpen] = React.useState(true);
  const [modal, setModal] = React.useState(null);
  const [replaceTarget, setReplaceTarget] = React.useState(null);
  const [previewIndex, setPreviewIndex] = React.useState(0);
  const [dirty, setDirty] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const slides = course.slides;
  const slideIndex = Math.max(0, slides.findIndex((s) => s.id === selectedId));
  const slide = slides[slideIndex] || slides[0];

  // ---- history-aware commit ----
  const commit = (updater) => {
    setCourse((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setPast((p) => [...p.slice(-40), prev]);
      setFuture([]);
      setDirty(true);
      return next;
    });
  };
  const undo = () => setPast((p) => { if (!p.length) return p; const prev = p[p.length - 1]; setFuture((f) => [course, ...f]); setCourse(prev); return p.slice(0, -1); });
  const redo = () => setFuture((f) => { if (!f.length) return f; const nxt = f[0]; setPast((p) => [...p, course]); setCourse(nxt); return f.slice(1); });

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1900); };

  // ---- mutations ----
  const patchSlide = (patch) => commit((c) => ({ ...c, slides: c.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)) }));
  const patchMeta = (patch) => commit((c) => ({ ...c, meta: { ...c.meta, ...patch } }));

  const addSlide = (type) => {
    const templ = {
      content: { blocks: [{ id: makeId(), type: 'heading', text: 'New section' }, { id: makeId(), type: 'paragraph', text: 'Add your content here.' }] },
      title: { blocks: [{ id: makeId(), type: 'eyebrow', text: 'SECTION' }, { id: makeId(), type: 'heading', text: 'Section title' }] },
      video: { blocks: [{ id: makeId(), type: 'heading', text: 'Video lesson' }, { id: makeId(), type: 'video', poster: 'video', length: '0:00', title: 'New clip', required: true }] },
      quiz: { quiz: { prompt: 'New quiz', instruction: 'Choose the correct answer.', kind: 'single', shuffle: false, feedback: true, questions: [{ id: makeId(), text: 'Your question?', options: [{ id: makeId(), text: 'Option A', correct: true }, { id: makeId(), text: 'Option B', correct: false }] }] } },
      branching: { scenario: { setup: 'Describe the situation the learner faces…', choices: [{ id: makeId(), text: 'First choice', outcome: 'correct', result: 'Why this is the right move.' }, { id: makeId(), text: 'Second choice', outcome: 'incorrect', result: 'Why this is risky.' }] } },
    }[type];
    const ns = { id: makeId(), type, name: window.SLIDE_TYPES.find((x) => x.id === type).label + ' slide', status: 'not-started', duration: '2 min', ...templ };
    commit((c) => { const idx = c.slides.findIndex((s) => s.id === slide.id); const arr = [...c.slides]; arr.splice(idx + 1, 0, ns); return { ...c, slides: arr }; });
    setSelectedId(ns.id); setSelBlock(null); setModal(null); flash('Slide added');
  };
  const deleteSlide = (id) => {
    if (slides.length <= 1) { flash('Can’t delete the last slide'); return; }
    const idx = slides.findIndex((s) => s.id === id);
    commit((c) => ({ ...c, slides: c.slides.filter((s) => s.id !== id) }));
    if (id === selectedId) setSelectedId(slides[Math.max(0, idx - 1)].id);
    flash('Slide deleted');
  };
  const duplicateSlide = (id) => {
    const src = slides.find((s) => s.id === id);
    const copy = JSON.parse(JSON.stringify(src)); copy.id = makeId(); copy.name = src.name + ' (copy)'; copy.status = 'not-started';
    const idx = slides.findIndex((s) => s.id === id);
    commit((c) => { const arr = [...c.slides]; arr.splice(idx + 1, 0, copy); return { ...c, slides: arr }; });
    setSelectedId(copy.id); flash('Slide duplicated');
  };
  const reorder = (from, to) => commit((c) => { const arr = [...c.slides]; const [m] = arr.splice(from, 1); arr.splice(to, 0, m); return { ...c, slides: arr }; });

  const addBlock = (type) => {
    const nb = {
      heading: { type: 'heading', text: 'New heading' },
      paragraph: { type: 'paragraph', text: 'New paragraph of body text.' },
      list: { type: 'list', items: ['First point', 'Second point'] },
      image: { type: 'image', src: 'generic', caption: 'Caption' },
      callout: { type: 'callout', tone: 'info', title: 'Note', text: 'Something worth highlighting.' },
    }[type];
    const blk = { id: makeId(), ...nb };
    patchSlide({ blocks: [...slide.blocks, blk] });
    setSelBlock(blk.id); flash('Block added');
  };
  const deleteBlock = (bid) => { patchSlide({ blocks: slide.blocks.filter((b) => b.id !== bid) }); setSelBlock(null); };

  const selectSlide = (id) => {
    setSelectedId(id);
    if (mode === 'preview') setPreviewIndex(Math.max(0, slides.findIndex((s) => s.id === id)));
  };
  // keep rail selection in sync while navigating the preview player
  const navPreview = (i) => { setPreviewIndex(i); if (slides[i]) setSelectedId(slides[i].id); };

  const selectedBlockObj = slide.blocks ? slide.blocks.find((b) => b.id === selBlock) : null;

  // theme application
  const ac = ACCENTS[t.accent] || ACCENTS.Violet;
  const fo = FONTS[t.font] || FONTS['Bricolage + Hanken'];
  const dens = { compact: { rail: 256, insp: 290 }, regular: { rail: 296, insp: 324 }, comfy: { rail: 336, insp: 360 } }[t.density] || { rail: 296, insp: 324 };
  const rootStyle = {
    '--accent': ac.accent, '--accent-press': ac.press, '--accent-soft': ac.soft, '--accent-ink': ac.ink,
    '--font-display': `${fo.display}, sans-serif`, '--font-ui': `${fo.ui}, sans-serif`,
    '--rail-w': dens.rail + 'px', '--inspector-w': dens.insp + 'px',
    height: '100vh', display: 'flex', flexDirection: 'column',
  };

  React.useEffect(() => { setSelBlock(null); }, [selectedId]);
  React.useEffect(() => { if (mode === 'preview') setPreviewIndex(slideIndex); }, [mode]);

  if (!imported) {
    return (
      <div data-theme={t.dark ? 'dark' : 'light'} style={rootStyle}>
        <ImportScreen onImport={() => setImported(true)} />
        <TweaksUI t={t} setTweak={setTweak} />
      </div>
    );
  }

  return (
    <div data-theme={t.dark ? 'dark' : 'light'} style={rootStyle} className={mode === 'edit' ? 'mode-edit' : 'mode-preview'}>
      <TopBar course={course} mode={mode} setMode={setMode} onPatchMeta={patchMeta}
        inspectorOpen={inspectorOpen} setInspectorOpen={setInspectorOpen}
        onExport={() => setModal('export')} canUndo={past.length > 0} canRedo={future.length > 0}
        onUndo={undo} onRedo={redo} dirty={dirty} onSave={() => { setDirty(false); flash('Saved to draft'); }} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Navigator course={course} selectedId={selectedId} onSelect={selectSlide}
          onReorder={reorder} onDelete={deleteSlide} onDuplicate={duplicateSlide} onAdd={() => setModal('add')} />

        {/* center canvas */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: mode === 'preview' ? 'var(--surface-sunk)' : 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
          {mode === 'edit' ? (
            <div style={{ flex: 1, padding: '30px 40px', display: 'flex', justifyContent: 'center' }} onMouseDown={() => setSelBlock(null)}>
              <div key={slide.id} className="card" style={{ width: '100%', maxWidth: 880, alignSelf: 'flex-start', padding: '46px 52px', boxShadow: 'var(--sh-md)', animation: 'riseIn .28s ease-out', minHeight: 200, background: slide.type === 'title' ? 'var(--surface-2)' : 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, paddingBottom: 16, borderBottom: '1px dashed var(--line)' }}>
                  <span className="badge" style={{ background: TYPE_META[slide.type].soft, color: TYPE_META[slide.type].color }}><Icon name={slide.type} size={13} /> {slide.type}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Slide {slideIndex + 1} of {slides.length}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={13} /> {slide.duration}</span>
                </div>
                <div onMouseDown={(e) => e.stopPropagation()}>
                  <SlideBody slide={slide} editing={true} sel={selBlock} onSelect={setSelBlock}
                    onPatchSlide={patchSlide} onReplaceImage={(b) => { setReplaceTarget(b); setModal('replace'); }} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, padding: '26px', display: 'flex', minHeight: 0 }}>
              <LmsPlayer course={course} slides={slides} index={previewIndex}
                onNav={navPreview} onExit={() => setMode('edit')} />
            </div>
          )}
        </main>

        {/* inspector */}
        {inspectorOpen && mode === 'edit' && (
          <Inspector course={course} slide={slide} selectedBlock={selectedBlockObj}
            onPatchSlide={patchSlide} onPatchMeta={patchMeta} onDeleteBlock={deleteBlock}
            onAddBlock={addBlock} onClose={() => setInspectorOpen(false)} />
        )}
      </div>

      {/* modals */}
      {modal === 'add' && <AddSlideModal onAdd={addSlide} onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal course={course} onClose={() => setModal(null)} />}
      {modal === 'replace' && <ReplaceImageModal onClose={() => setModal(null)} onReplace={() => { setModal(null); flash('Image replaced'); }} />}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--ink)', color: 'var(--paper)', padding: '11px 18px', borderRadius: 99, fontSize: 13.5, fontWeight: 600, boxShadow: 'var(--sh-pop)', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeUp .2s both' }}>
          <Icon name="check" size={16} stroke={2.6} /> {toast}
        </div>
      )}

      <TweaksUI t={t} setTweak={setTweak} />
    </div>
  );
}

function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Theme" />
      <TweakRadio label="Accent" value={t.accent} options={Object.keys(ACCENTS)} onChange={(v) => setTweak('accent', v)} />
      <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
      <TweakSection label="Typography" />
      <TweakSelect label="Font pairing" value={t.font} options={Object.keys(FONTS)} onChange={(v) => setTweak('font', v)} />
      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
