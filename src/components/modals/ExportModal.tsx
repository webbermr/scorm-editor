import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Modal, ModalHead } from './Modal';
import { Toggle } from '@/components/ui/Toggle';
import { HelpTip } from '@/components/ui/HelpTip';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { buildScormPackage, downloadBlob, estimateMediaSavings, type ExportResult, type MediaSavings, type ValidationReport } from '@/scorm/export';
import { humanSize } from '@/scorm/export/validate';
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

// Help text shown behind the (i) next to each export setting.
const MODE_HELP = (
  <>
    <p>
      <strong>Faithful copy</strong> creates a copy of the original package with the same player, design, images, audio and narration. Only these edits
      are applied:
    </p>
    <ul>
      <li>Text changed with “Edit text” in LMS Preview (Lectora courses)</li>
      <li>Deleted slides (Lectora courses only; other tools export every page)</li>
      <li>Course title, and passing score if the original package sets one</li>
    </ul>
    <p>
      Changes made in the Blocks view, reordering and new slides are <strong>not</strong> included.
    </p>
    <p>
      <strong>Rebuilt</strong> creates a new course with one simple page per slide, using your Blocks-view text, slide order and new slides, plus the
      images and narration taken from the original pages. “Edit text” changes aren’t carried over. It’s ready for any LMS but looks plain, not like
      the original.
    </p>
  </>
);

const NAME_HELP = (
  <p>
    The name of the downloaded .zip file. It doesn’t change the course title learners see in the LMS; edit that in the title field at the top of the
    editor.
  </p>
);

const VERSION_HELP = (
  <>
    <p>The SCORM standard your LMS uses to launch the course and record completion and scores.</p>
    <p>
      <strong>SCORM 1.2</strong> works in almost every LMS. Choose <strong>SCORM 2004</strong> only if your LMS requires it.
    </p>
    <p>A Faithful copy always keeps the version of the original package.</p>
  </>
);

const OPTION_ROWS: Array<['manifest' | 'minify' | 'includeSource', string, React.ReactNode]> = [
  ['manifest', 'Regenerate imsmanifest.xml', null],
  [
    'minify',
    'Maximum compression',
    <p key="m">
      Compresses the .zip as much as possible so it uploads faster. The course itself is unchanged. Images and audio are already compressed, so the file
      usually shrinks only a little.
    </p>,
  ],
  [
    'includeSource',
    'Include editor data (course.json)',
    <>
      <p>Adds a course.json file with the editor’s copy of your slides and course settings, for your records or other tools.</p>
      <p>The LMS ignores it, and importing the package here again does not read it, so it won’t restore your edits.</p>
    </>,
  ],
];

const UNUSED_MEDIA_HELP = (
  <>
    <p>
      Leaves out images, audio and video that nothing in the course uses. Authoring tools often publish media the course no longer needs, such as
      narration from other modules or images replaced in later versions.
    </p>
    <p>
      A file counts as unused only when its name appears nowhere else in the package: not in any page, script, style sheet or data file, including the
      course test. Anything the course mentions, even indirectly, is kept.
    </p>
    <p>Media used only by slides you deleted is always removed, whether or not this is on.</p>
  </>
);

const count = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const labelRow = { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 } as const;

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
  // on by default where we've verified it on real courses (Lectora)
  const [removeUnused, setRemoveUnused] = useState(course.meta.authoringTool === 'Lectora');
  const [savings, setSavings] = useState<MediaSavings | 'checking' | 'failed'>('checking');
  // features (the table of contents) only deleted slides unlocked: start them
  // unlocked by default, since otherwise learners can never use them
  const [unlockLost, setUnlockLost] = useState(true);
  const lostUnlocks = mode === 'original' && typeof savings === 'object' ? savings.lostUnlocks : [];
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

  // how much media the faithful copy leaves out — shown next to the option
  const removedKey = removedPages.join('\n');
  useEffect(() => {
    if (mode !== 'original' || !originalFile) return;
    let live = true;
    setSavings('checking');
    estimateMediaSavings(course, originalFile, removedPages)
      .then((s) => live && setSavings(s))
      .catch(() => live && setSavings('failed'));
    return () => {
      live = false;
    };
    // re-run only when the package or the deleted pages change
  }, [mode, originalFile, removedKey]);

  const build = async () => {
    setPhase('building');
    setError('');
    try {
      const result = await buildScormPackage(course, { name, version: effectiveVersion, mode, ...opts, removeUnusedMedia: removeUnused, unlockLostFeatures: unlockLost }, originalFile, removedPages);
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
              <div style={labelRow}>
                <label className="field-label" htmlFor="export-mode" style={{ marginBottom: 0 }}>
                  What to export
                </label>
                <HelpTip label="What to export">{MODE_HELP}</HelpTip>
              </div>
              <select id="export-mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
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
            <div style={labelRow}>
              <label className="field-label" htmlFor="export-name" style={{ marginBottom: 0 }}>
                Package name
              </label>
              <HelpTip label="Package name">{NAME_HELP}</HelpTip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input id="export-name" className="field" value={name} onChange={(e) => setName(e.target.value)} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', padding: '9px 12px', border: '1px solid var(--line)', borderLeft: 'none', borderRadius: '0 var(--r-md) var(--r-md) 0', background: 'var(--surface-sunk)' }}>.zip</span>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelRow}>
              <span className="field-label" style={{ marginBottom: 0 }}>
                SCORM version{mode === 'original' ? ' (kept from source)' : ''}
              </span>
              <HelpTip label="SCORM version">{VERSION_HELP}</HelpTip>
            </div>
            <div className="seg" style={{ width: '100%', opacity: mode === 'original' ? 0.55 : 1 }}>
              {([['1.2', 'SCORM 1.2'], ['2004', 'SCORM 2004']] as const).map(([v, lbl]) => (
                <button key={v} className={effectiveVersion === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center' }} disabled={mode === 'original'} onClick={() => setVersion(v)}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {lostUnlocks.map((u) => (
            <div key={u.variable} className="card" style={{ padding: '12px 14px', marginBottom: 16, background: 'var(--amber-soft)', borderColor: 'transparent' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="warning" size={17} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45, color: 'var(--ink)' }}>
                  <strong>You deleted the slide that unlocks {u.label}</strong> ({u.titles.join(', ')}).{' '}
                  {unlockLost
                    ? `It will be unlocked from the start, so learners can open it on any slide.`
                    : `Learners will never be able to open it: they’ll only see the “not available yet” message.`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingLeft: 27 }}>
                <span style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Unlock {u.label} from the start
                  <HelpTip label={`Unlock ${u.label}`}>
                    <p>
                      This course keeps {u.label} locked until the learner reaches “{u.titles.join(', ')}”. That slide is deleted, so without this it stays
                      locked for good.
                    </p>
                    <p>Turning this on makes it available from the first slide. Learners who already have saved progress in your LMS keep their saved state.</p>
                  </HelpTip>
                </span>
                <Toggle on={unlockLost} onChange={() => setUnlockLost((v) => !v)} />
              </div>
            </div>
          ))}

          <label className="field-label">Options</label>
          <div className="card" style={{ padding: '4px 14px', marginBottom: 18 }}>
            {mode === 'original' && (
              <div style={{ padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Remove unused media
                    <HelpTip label="Remove unused media">{UNUSED_MEDIA_HELP}</HelpTip>
                  </span>
                  {typeof savings === 'object' && !savings.unusedSkipped && savings.unused.files > 0 && (
                    <Toggle on={removeUnused} onChange={() => setRemoveUnused((v) => !v)} />
                  )}
                </div>
                <MediaSavingsNote savings={savings} on={removeUnused} />
              </div>
            )}
            {OPTION_ROWS.filter(([k]) => k !== 'manifest').map(([k, lbl, help], i, arr) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <span style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {lbl}
                  {help && <HelpTip label={lbl}>{help}</HelpTip>}
                </span>
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

function MediaSavingsNote({ savings, on }: { savings: MediaSavings | 'checking' | 'failed'; on: boolean }) {
  const style = { fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45 } as const;
  if (savings === 'checking') return <div style={style}>Checking the course for unused media…</div>;
  if (savings === 'failed') return <div style={style}>Couldn’t check this course for unused media.</div>;
  const { unused, deletedSlides } = savings;
  const main = savings.unusedSkipped
    ? 'Not available: the course’s test file couldn’t be read, and it might be the only file that uses some media.'
    : unused.files === 0
      ? 'No unused media found.'
      : on
        ? `Makes the package about ${humanSize(unused.bytes)} smaller (${count(unused.files, 'file')} nothing in the course uses).`
        : `Would make the package about ${humanSize(unused.bytes)} smaller (${count(unused.files, 'file')} nothing in the course uses).`;
  return (
    <div style={style}>
      {main}
      {deletedSlides.files > 0 && (
        <>
          {' '}
          Media used only by deleted slides ({humanSize(deletedSlides.bytes)}, {count(deletedSlides.files, 'file')}) is always removed.
        </>
      )}
    </div>
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
