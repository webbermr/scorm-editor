import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { saveDraftPackage } from '@/store/draft';
import { SAMPLE_COURSE } from '@/data/sampleCourse';
import { importScorm, IMPORT_STEPS } from '@/scorm/import';

type Stage = 'idle' | 'parsing' | 'error';

export function ImportScreen() {
  const loadCourse = useCourse((s) => s.load);
  const setImported = useUi((s) => s.setImported);
  const selectSlide = useUi((s) => s.selectSlide);

  const [stage, setStage] = useState<Stage>('idle');
  const [drag, setDrag] = useState(false);
  const [stepN, setStepN] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const enter = (course: typeof SAMPLE_COURSE) => {
    loadCourse(course);
    selectSlide(course.slides[0].id);
    setImported(true);
  };

  const runImport = async (file: File) => {
    setStage('parsing');
    setError('');
    setFileName(file.name);
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    setStepN(0);
    try {
      const { course, launchHref } = await importScorm(file, (s) => setStepN(s));
      setStepN(IMPORT_STEPS.length);
      const pages = course.slides.map((s) => s.sourceHref).filter((h): h is string => !!h);
      usePreview.getState().setPackage(file, launchHref, pages);
      saveDraftPackage(file); // persist the binary so the session survives a reload
      await new Promise((r) => setTimeout(r, 420));
      enter(course);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while importing.');
      setStage('error');
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      setFileName(file.name);
      setError('Please choose a .zip SCORM package.');
      setStage('error');
      return;
    }
    runImport(file);
  };

  const loadSample = () => {
    usePreview.getState().clear();
    saveDraftPackage(null); // sample has no package; drop any stored one
    enter(SAMPLE_COURSE);
  };

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', padding: 28, background: 'radial-gradient(120% 80% at 50% -10%, var(--accent-soft), transparent 60%), var(--paper)' }}>
      <div style={{ maxWidth: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Icon name="logo" size={24} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>SCORM Editor</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '-.025em', margin: '0 0 8px', lineHeight: 1.1, whiteSpace: 'nowrap' }}>Import a SCORM package to start editing</h1>
        <p style={{ fontSize: 15.5, color: 'var(--ink-2)', margin: '0 0 26px', lineHeight: 1.55, whiteSpace: 'nowrap' }}>
          Drop a SCORM 1.2 or 2004 <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>.zip</span> and we’ll render every slide exactly as your LMS would.
        </p>

        <div style={{ width: 560, maxWidth: '100%', margin: '0 auto' }}>
          <input ref={inputRef} type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />

        {stage === 'idle' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            style={{ cursor: 'pointer', borderRadius: 'var(--r-xl)', border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-strong)'}`, background: drag ? 'var(--accent-soft)' : 'var(--surface)', padding: '40px 28px', transition: 'all .18s', boxShadow: 'var(--sh-sm)' }}
          >
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Icon name="upload" size={28} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drag &amp; drop your .zip here</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 18 }}>or click to browse</div>
            <div className="btn btn-primary" style={{ pointerEvents: 'none', display: 'inline-flex' }}>
              <Icon name="upload" size={16} /> Choose SCORM file
            </div>
          </div>
        )}

        {stage === 'parsing' && (
          <div className="card" style={{ padding: '26px 28px', textAlign: 'left', boxShadow: 'var(--sh-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <Icon name="file" size={20} style={{ color: 'var(--accent)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>{fileName}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>{fileSize}</span>
            </div>
            {IMPORT_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0', opacity: i <= stepN ? 1 : 0.35, transition: 'opacity .3s' }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0, background: i < stepN ? 'var(--green)' : i === stepN ? 'var(--accent-soft)' : 'var(--surface-sunk)', color: i < stepN ? '#fff' : 'var(--accent)' }}>
                  {i < stepN ? <Icon name="check" size={13} stroke={3} /> : i === stepN ? <Icon name="refresh" size={13} className="spin" /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--line-strong)' }} />}
                </span>
                <span style={{ fontSize: 14, fontWeight: i === stepN ? 700 : 500, color: i <= stepN ? 'var(--ink)' : 'var(--ink-3)' }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {stage === 'error' && (
          <div className="card" style={{ padding: '28px', textAlign: 'center', boxShadow: 'var(--sh-md)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 99, background: 'var(--rose-soft)', color: 'var(--rose)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <Icon name="warning" size={26} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Couldn’t import that package</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.5 }}>{error}</div>
            <button className="btn btn-soft" onClick={() => { setStage('idle'); setError(''); }}>
              <Icon name="arrowLeft" size={15} /> Try another file
            </button>
          </div>
        )}

          <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--ink-3)' }}>
            No file handy?{' '}
            <button onClick={loadSample} style={{ color: 'var(--accent)', fontWeight: 700 }}>
              Load the sample course →
            </button>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>© {new Date().getFullYear()} Mark Webber</div>
        </div>
      </div>
    </div>
  );
}
