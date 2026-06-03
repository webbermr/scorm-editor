// Modals & overlays — Import flow, Export package, Add-slide picker, Replace-image.

function Modal({ children, onClose, width = 520, label }) {
  React.useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,26,20,.42)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'fadeIn .15s both' }}>
      <div role="dialog" aria-label={label} onMouseDown={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-pop)', border: '1px solid var(--line)', animation: 'scaleIn .2s both' }}>
        {children}
      </div>
    </div>
  );
}

function ModalHead({ title, sub, onClose, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
      {icon && <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={icon} size={20} /></div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button className="btn btn-sm btn-icon btn-ghost" onClick={onClose}><Icon name="close" size={18} /></button>
    </div>
  );
}

/* ---------------- Import landing ---------------- */
function ImportScreen({ onImport }) {
  const [stage, setStage] = React.useState('idle'); // idle | parsing | done
  const [drag, setDrag] = React.useState(false);
  const steps = ['Unzipping package', 'Reading imsmanifest.xml', 'Mapping SCOs to slides', 'Extracting media assets', 'Ready to edit'];
  const [stepN, setStepN] = React.useState(0);

  const start = () => {
    setStage('parsing'); setStepN(0);
    let n = 0;
    const t = setInterval(() => {
      n++; setStepN(n);
      if (n >= steps.length) { clearInterval(t); setTimeout(onImport, 480); }
    }, 560);
  };

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: 28, background: 'radial-gradient(120% 80% at 50% -10%, var(--accent-soft), transparent 60%), var(--paper)' }}>
      <div style={{ width: 560, maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="logo" size={24} /></div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>Coursewright</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-.025em', margin: '0 0 8px', lineHeight: 1.1 }}>Import a SCORM package to start editing</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-2)', margin: '0 0 26px', lineHeight: 1.55 }}>Drop a SCORM 1.2 or 2004 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>.zip</span> and we’ll render every slide exactly as your LMS would.</p>

        {stage !== 'parsing' ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); start(); }}
            onClick={start}
            style={{ cursor: 'pointer', borderRadius: 'var(--r-xl)', border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-strong)'}`, background: drag ? 'var(--accent-soft)' : 'var(--surface)', padding: '40px 28px', transition: 'all .18s', boxShadow: 'var(--sh-sm)' }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name="upload" size={28} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drag & drop your .zip here</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 18 }}>or click to browse — max 200&nbsp;MB</div>
            <div className="btn btn-primary" style={{ pointerEvents: 'none', display: 'inline-flex' }}><Icon name="upload" size={16} /> Choose SCORM file</div>
          </div>
        ) : (
          <div className="card" style={{ padding: '26px 28px', textAlign: 'left', boxShadow: 'var(--sh-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <Icon name="file" size={20} className="" style={{ color: 'var(--accent)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>cybersec_essentials_v3.zip</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>18.4 MB</span>
            </div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0', opacity: i <= stepN ? 1 : 0.35, transition: 'opacity .3s' }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0,
                  background: i < stepN ? 'var(--green)' : i === stepN ? 'var(--accent-soft)' : 'var(--surface-sunk)',
                  color: i < stepN ? '#fff' : 'var(--accent)' }}>
                  {i < stepN ? <Icon name="check" size={13} stroke={3} /> : i === stepN ? <Icon name="refresh" size={13} className="spin" /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--line-strong)' }} />}
                </span>
                <span style={{ fontSize: 14, fontWeight: i === stepN ? 700 : 500, color: i <= stepN ? 'var(--ink)' : 'var(--ink-3)' }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--ink-3)' }}>
          No file handy? <button onClick={start} style={{ color: 'var(--accent)', fontWeight: 700 }}>Load the sample course →</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Add slide ---------------- */
function AddSlideModal({ onAdd, onClose }) {
  return (
    <Modal onClose={onClose} width={560} label="Add slide">
      <ModalHead icon="plus" title="Add a slide" sub="Pick a content type to insert after the current slide." onClose={onClose} />
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {window.SLIDE_TYPES.map((t) => (
          <button key={t.id} onClick={() => onAdd(t.id)} className="card"
            style={{ textAlign: 'left', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'all .15s', background: 'var(--surface)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--sh-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: TYPE_META[t.id].soft, color: TYPE_META[t.id].color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={t.id} size={21} /></div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- Replace image ---------------- */
function ReplaceImageModal({ onClose, onReplace }) {
  const [drag, setDrag] = React.useState(false);
  return (
    <Modal onClose={onClose} width={460} label="Replace image">
      <ModalHead icon="image" title="Replace image" sub="Upload a new asset for this block." onClose={onClose} />
      <div style={{ padding: 18 }}>
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); onReplace(); }} onClick={onReplace}
          style={{ cursor: 'pointer', borderRadius: 'var(--r-lg)', border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-strong)'}`, background: drag ? 'var(--accent-soft)' : 'var(--surface-2)', padding: '34px 20px', textAlign: 'center', transition: 'all .15s' }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--surface)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', boxShadow: 'var(--sh-sm)' }}><Icon name="image" size={24} /></div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Drop image or click to browse</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>PNG, JPG, SVG · up to 5 MB</div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Export package ---------------- */
function ExportModal({ course, onClose }) {
  const [version, setVersion] = React.useState(course.meta.scormVersion);
  const [name, setName] = React.useState(course.meta.package.replace(/\.zip$/, ''));
  const [opts, setOpts] = React.useState({ minify: true, includeSource: false, manifest: true });
  const [phase, setPhase] = React.useState('config'); // config | building | done

  const build = () => {
    setPhase('building');
    setTimeout(() => setPhase('done'), 1900);
  };

  return (
    <Modal onClose={onClose} width={540} label="Export SCORM">
      <ModalHead icon="download" title="Export SCORM package" sub="Re-package your edits into a fresh LMS-ready .zip." onClose={onClose} />
      {phase === 'config' && (
        <div style={{ padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Package name</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', padding: '9px 12px', border: '1px solid var(--line)', borderLeft: 'none', borderRadius: '0 var(--r-md) var(--r-md) 0', background: 'var(--surface-sunk)' }}>.zip</span>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">SCORM version</label>
            <div className="seg" style={{ width: '100%' }}>
              {[['1.2', 'SCORM 1.2'], ['2004', 'SCORM 2004']].map(([v, lbl]) => (
                <button key={v} className={version === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setVersion(v)}>{lbl}</button>
              ))}
            </div>
          </div>
          <label className="field-label">Options</label>
          <div className="card" style={{ padding: '4px 14px', marginBottom: 18 }}>
            {[['manifest', 'Regenerate imsmanifest.xml'], ['minify', 'Minify HTML & assets'], ['includeSource', 'Include editable source files']].map(([k, lbl], i, arr) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13.5 }}>{lbl}</span>
                <button onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))} style={{ width: 40, height: 23, borderRadius: 99, background: opts[k] ? 'var(--accent)' : 'var(--line-strong)', padding: 2, transition: 'background .18s' }}>
                  <span style={{ display: 'block', width: 19, height: 19, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-sm)', transform: opts[k] ? 'translateX(17px)' : 'none', transition: 'transform .18s' }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={build}><Icon name="download" size={16} /> Build package</button>
          </div>
        </div>
      )}
      {phase === 'building' && (
        <div style={{ padding: '48px 22px', textAlign: 'center' }}>
          <div className="spin" style={{ width: 46, height: 46, margin: '0 auto 18px', color: 'var(--accent)' }}><Icon name="refresh" size={46} /></div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Building {name}.zip…</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Packaging {course.slides.length} slides · SCORM {version}</div>
        </div>
      )}
      {phase === 'done' && (
        <div style={{ padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name="check" size={30} stroke={3} /></div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Package ready</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '6px 0 20px' }}><span style={{ fontFamily: 'var(--font-mono)' }}>{name}.zip</span> · {(course.slides.length * 2.3 + 4).toFixed(1)} MB · SCORM {version}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-soft" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={onClose}><Icon name="download" size={16} /> Download .zip</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { Modal, ModalHead, ImportScreen, AddSlideModal, ReplaceImageModal, ExportModal });
