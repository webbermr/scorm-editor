import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Modal, ModalHead } from './Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { buildScormPackage, downloadBlob, type ExportResult, type ValidationReport } from '@/scorm/export';
import type { ScormVersion } from '@/types/course';

type Phase = 'config' | 'building' | 'review' | 'error';
type Mode = 'blocks' | 'original';

const MODE_OPTIONS: Array<{ id: Mode; label: string; desc: string }> = [
  {
    id: 'original',
    label: 'Faithful copy — original look (recommended)',
    desc: 'Keeps the original design, layout, images, audio and narration. For Lectora courses your deleted pages are removed by rewiring the course navigation (neighbors re-pointed, table of contents and page counts updated) — so the trimmed course still looks and works like the original. Reordering isn’t applied. Other authoring tools: the whole course is kept as-is.',
  },
  {
    id: 'blocks',
    label: 'Rebuilt — clean simplified course',
    desc: 'Generates a brand-new, LMS-ready course from your edited slides (deletions and reordering applied) with recovered text plus extracted media. A plain, simplified layout — it will NOT look like the original design.',
  },
];

const OPTION_ROWS: Array<['manifest' | 'minify' | 'includeSource', string]> = [
  ['manifest', 'Regenerate imsmanifest.xml'],
  ['minify', 'Minify HTML & assets'],
  ['includeSource', 'Include editable source files'],
];

export function ExportModal() {
  const course = useCourse((s) => s.course);
  const setModal = useUi((s) => s.setModal);
  const flash = useUi((s) => s.flash);
  const originalFile = usePreview((s) => s.file);
  const close = () => setModal(null);

  const hasOriginal = !!originalFile;
  const [mode, setMode] = useState<Mode>(hasOriginal ? 'original' : 'blocks');
  const [version, setVersion] = useState<ScormVersion>(course.meta.scormVersion);
  const [name, setName] = useState(course.meta.package.replace(/\.zip$/, ''));
  const [opts, setOpts] = useState({ minify: true, includeSource: false, manifest: true });
  const [phase, setPhase] = useState<Phase>('config');
  const [error, setError] = useState<string>('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const resultRef = useRef<ExportResult | null>(null);

  // Original-passthrough keeps the source package's SCORM version.
  const effectiveVersion: ScormVersion = mode === 'original' ? course.meta.scormVersion : version;

  // pages present at import that the editor has since removed
  const removedPages = (() => {
    const kept = new Set(course.slides.map((s) => s.sourceHref).filter(Boolean));
    return usePreview.getState().importedPages.filter((p) => !kept.has(p));
  })();

  const build = async () => {
    setPhase('building');
    setError('');
    try {
      const result = await buildScormPackage(course, { name, version: effectiveVersion, mode, ...opts }, originalFile, removedPages);
      resultRef.current = result;
      setReport(result.report);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Packaging failed.');
      setPhase('error');
    }
  };

  const download = () => {
    if (resultRef.current) {
      downloadBlob(resultRef.current.blob, resultRef.current.filename);
      flash('Package downloaded');
    }
    close();
  };

  return (
    <Modal onClose={close} width={540} label="Export SCORM">
      <ModalHead icon="download" title="Export SCORM package" sub="Re-package your edits into a fresh LMS-ready .zip." onClose={close} />

      {phase === 'config' && (
        <div style={{ padding: 22 }}>
          {hasOriginal && (
            <div style={{ marginBottom: 16 }}>
              <label className="field-label">What to export</label>
              <select className="field" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {MODE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>{MODE_OPTIONS.find((o) => o.id === mode)?.desc}</div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Package name</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', padding: '9px 12px', border: '1px solid var(--line)', borderLeft: 'none', borderRadius: '0 var(--r-md) var(--r-md) 0', background: 'var(--surface-sunk)' }}>.zip</span>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">SCORM version{mode === 'original' ? ' (kept from source)' : ''}</label>
            <div className="seg" style={{ width: '100%', opacity: mode === 'original' ? 0.55 : 1 }}>
              {([['1.2', 'SCORM 1.2'], ['2004', 'SCORM 2004']] as const).map(([v, lbl]) => (
                <button key={v} className={effectiveVersion === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center' }} disabled={mode === 'original'} onClick={() => setVersion(v)}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <label className="field-label">Options</label>
          <div className="card" style={{ padding: '4px 14px', marginBottom: 18 }}>
            {OPTION_ROWS.filter(([k]) => k !== 'manifest').map(([k, lbl], i, arr) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13.5 }}>{lbl}</span>
                <Toggle on={opts[k]} onChange={() => setOpts((o) => ({ ...o, [k]: !o[k] }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={build} disabled={!name.trim()}>
              <Icon name="download" size={16} /> Build package
            </button>
          </div>
        </div>
      )}

      {phase === 'building' && (
        <div style={{ padding: '48px 22px', textAlign: 'center' }}>
          <div className="spin" style={{ width: 46, height: 46, margin: '0 auto 18px', color: 'var(--accent)' }}>
            <Icon name="refresh" size={46} />
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Building {name}.zip…</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            {mode === 'original' ? 'Re-packaging the original course with all assets' : `Packaging ${course.slides.length} slides with media`} · SCORM {effectiveVersion}
          </div>
        </div>
      )}

      {phase === 'review' && report && (
        <ReviewPanel
          report={report}
          result={resultRef.current}
          version={effectiveVersion}
          onBack={() => setPhase('config')}
          onDownload={download}
        />
      )}

      {phase === 'error' && (
        <div style={{ padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--rose-soft)', color: 'var(--rose)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icon name="warning" size={28} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Export failed</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '6px 0 20px' }}>{error}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-soft" onClick={close}>
              Close
            </button>
            <button className="btn btn-primary" onClick={() => setPhase('config')}>
              Back
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReviewPanel({
  report,
  result,
  version,
  onBack,
  onDownload,
}: {
  report: ValidationReport;
  result: ExportResult | null;
  version: ScormVersion;
  onBack: () => void;
  onDownload: () => void;
}) {
  const errs = report.errors;
  const warns = report.warnings;
  const tone = !report.ok ? 'error' : warns.length ? 'warn' : 'ok';
  const palette = {
    ok: { bg: 'var(--green-soft)', fg: 'var(--green)', icon: 'check' as const, title: 'Validation passed' },
    warn: { bg: 'var(--amber-soft)', fg: 'var(--amber)', icon: 'warning' as const, title: `Passed with ${warns.length} warning${warns.length === 1 ? '' : 's'}` },
    error: { bg: 'var(--rose-soft)', fg: 'var(--rose)', icon: 'warning' as const, title: `${errs.length} issue${errs.length === 1 ? '' : 's'} to fix` },
  }[tone];

  return (
    <div style={{ padding: 22 }}>
      {/* status banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--r-md)', background: palette.bg, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 99, background: '#fff6', color: palette.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={palette.icon} size={20} stroke={tone === 'ok' ? 3 : 2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: palette.fg }}>{palette.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{result?.filename}</span> · {result?.size} · SCORM {version}
          </div>
        </div>
      </div>

      {/* checklist */}
      <div className="card" style={{ padding: '6px 14px', marginBottom: errs.length || warns.length ? 14 : 18 }}>
        {report.checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < report.checks.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <span style={{ width: 18, height: 18, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0, background: c.passed ? 'var(--green-soft)' : 'var(--rose-soft)', color: c.passed ? 'var(--green)' : 'var(--rose)' }}>
              <Icon name={c.passed ? 'check' : 'close'} size={11} stroke={3} />
            </span>
            <span style={{ fontSize: 13, color: c.passed ? 'var(--ink-2)' : 'var(--ink)' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* issues */}
      {(errs.length > 0 || warns.length > 0) && (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...errs, ...warns].map((issue, i) => {
            const isErr = issue.level === 'error';
            return (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 11px', borderRadius: 'var(--r-sm)', background: isErr ? 'var(--rose-soft)' : 'var(--amber-soft)', border: `1px solid ${isErr ? 'var(--rose)' : 'var(--amber)'}22` }}>
                <span style={{ color: isErr ? 'var(--rose)' : 'var(--amber)', flexShrink: 0, marginTop: 1 }}>
                  <Icon name={isErr ? 'warning' : 'info'} size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{issue.message}</div>
                  {issue.detail && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.4 }}>{issue.detail}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrowLeft" size={15} /> Back
        </button>
        {report.ok ? (
          <button className="btn btn-primary" onClick={onDownload}>
            <Icon name="download" size={16} /> Download .zip
          </button>
        ) : (
          <button className="btn btn-soft" onClick={onDownload} style={{ color: 'var(--rose)' }}>
            <Icon name="download" size={16} /> Download anyway
          </button>
        )}
      </div>
    </div>
  );
}
