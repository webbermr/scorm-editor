import { Icon } from '@/components/Icon';
import { HelpTip } from '@/components/ui/HelpTip';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { usePreview } from '@/store/previewStore';
import { clearDraft } from '@/store/draft';
import { useEditorActions } from '@/lib/useEditorActions';

export function TopBar() {
  const meta = useCourse((s) => s.course.meta);
  const patchMeta = useCourse((s) => s.patchMeta);
  const canUndo = useCourse((s) => s.past.length > 0);
  const canRedo = useCourse((s) => s.future.length > 0);
  const dirty = useCourse((s) => s.dirty);
  const undo = useCourse((s) => s.undo);
  const redo = useCourse((s) => s.redo);

  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  const inspectorOpen = useUi((s) => s.inspectorOpen);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);
  const setModal = useUi((s) => s.setModal);

  const { save } = useEditorActions();
  const hasPackage = usePreview((s) => !!s.file && !!s.launchHref);
  const previewSupported = usePreview((s) => s.supported);
  const resetUi = useUi((s) => s.reset);

  const startOver = () => {
    if (!window.confirm('Discard the current course and import a new package? This clears the saved draft in this browser.')) return;
    void clearDraft();
    usePreview.getState().clear();
    resetUi();
  };

  return (
    <header
      className="topbar"
      style={{
        height: 'var(--topbar-h)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}>
          <Icon name="logo" size={20} />
        </div>
        <span className="topbar-wordmark" style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>SCORM Editor</span>
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--line)' }} />

      {/* course title (editable), with the imported package's file name beneath */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '0 1 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <input
              value={meta.title}
              onChange={(e) => patchMeta({ title: e.target.value })}
              aria-label="Course title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15.5,
                fontWeight: 700,
                border: '1px solid transparent',
                background: 'transparent',
                borderRadius: 8,
                padding: '2px 9px',
                width: 'clamp(220px, 30vw, 460px)',
                minWidth: 0, // shrink with the window rather than overlap the toolbar
                color: 'var(--ink)',
                transition: 'all .15s',
              }}
              onFocus={(e) => {
                e.target.style.background = 'var(--surface-2)';
                e.target.style.borderColor = 'var(--line)';
              }}
              onBlur={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'transparent';
              }}
            />
            <HelpTip label="Course title">
              <p>
                This is the course title from the package’s <strong>imsmanifest.xml</strong>, set when the course was published. If the manifest has no
                title, the .zip file name is used instead.
              </p>
              <p>Click the title to change it. On export, the new title is written into the manifest, which is the name your LMS shows for the course.</p>
              <p>The file name underneath is the .zip you imported. Changing the title doesn’t rename it; you choose the export file name when you export.</p>
            </HelpTip>
          </div>
          {meta.package && (
            <span
              title={meta.package}
              style={{
                padding: '0 10px',
                fontSize: 11.5,
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 'clamp(220px, 30vw, 460px)',
              }}
            >
              {meta.package}
            </span>
          )}
        </div>
        <div className="topbar-badges">
          <span className="badge badge-mono" style={{ background: 'var(--surface-sunk)', color: 'var(--ink-2)' }}>
            SCORM {meta.scormVersion}
          </span>
          {meta.authoringTool && (
            <span className="badge tip" data-tip="Authoring tool detected on import" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
              <Icon name="layers" size={12} /> {meta.authoringTool}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button className="btn btn-sm btn-soft tip" data-tip="Start over — import a new package" onClick={startOver}>
        <Icon name="upload" size={15} /> New
      </button>

      {/* undo / redo */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Undo" onClick={undo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.35 }}>
          <Icon name="undo" size={17} />
        </button>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Redo" onClick={redo} disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.35 }}>
          <Icon name="redo" size={17} />
        </button>
      </div>

      {/* mode toggle */}
      <div className="seg">
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>
          <Icon name="edit" size={15} /> Edit
        </button>
        <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>
          <Icon name="eye" size={15} /> Preview
        </button>
      </div>

      <button
        className="btn btn-sm btn-icon btn-ghost tip"
        data-tip={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        onClick={() => setInspectorOpen((v) => !v)}
        style={{ color: inspectorOpen ? 'var(--accent)' : 'var(--ink-2)' }}
      >
        <Icon name="panelRight" size={18} />
      </button>

      <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Settings" onClick={() => setModal('settings')} style={{ color: 'var(--ink-2)' }}>
        <Icon name="settings" size={18} />
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
      {hasPackage && (
        <button
          className="btn btn-soft tip"
          data-tip={previewSupported ? 'See the imported package rendered as the LMS would' : 'Needs HTTPS or localhost (service worker required)'}
          onClick={() => previewSupported && setModal('original')}
          disabled={!previewSupported}
          style={{ opacity: previewSupported ? 1 : 0.5 }}
        >
          <Icon name="eye" size={16} /> LMS Preview
        </button>
      )}
      <button className="btn btn-soft" onClick={save}>
        <Icon name="save" size={16} /> {dirty ? 'Save' : 'Saved'}
      </button>
      <button className="btn btn-primary" onClick={() => setModal('export')}>
        <Icon name="download" size={16} /> Export
      </button>
    </header>
  );
}
