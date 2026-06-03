import { useEffect } from 'react';
import { usePrefs, rootThemeVars } from '@/store/prefsStore';
import { useUi } from '@/store/uiStore';
import { useCourse } from '@/store/courseStore';
import { importScorm } from '@/scorm/import';
import { EditorShell } from '@/components/shell/EditorShell';
import { ImportScreen } from '@/components/modals/ImportScreen';
import { DevHarness } from '@/dev/DevHarness';

export function App() {
  const prefs = usePrefs();
  const themeVars = rootThemeVars(prefs);

  const imported = useUi((s) => s.imported);
  const mode = useUi((s) => s.mode);

  const demoParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('demo') : null;
  const demo = demoParam === 'roundtrip';

  // Dev hook: ?demo=import loads the bundled fixture straight into the editor.
  useEffect(() => {
    if (demoParam !== 'import') return;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const fileName = params.get('file') ?? 'test-scorm.zip';
        const idx = Number(params.get('slide') ?? '1');
        const res = await fetch('/' + fileName);
        const file = new File([await res.blob()], fileName, { type: 'application/zip' });
        const t0 = performance.now();
        const { course, launchHref } = await importScorm(file);
        // eslint-disable-next-line no-console
        console.log(`[demo-import] ${course.slides.length} slides in ${Math.round(performance.now() - t0)}ms`);
        document.title = `imported:${course.slides.length}`;
        const { usePreview } = await import('@/store/previewStore');
        const pages = course.slides.map((s) => s.sourceHref).filter((h): h is string => !!h);
        usePreview.getState().setPackage(file, launchHref, pages);
        useCourse.getState().load(course);
        useUi.getState().selectSlide(course.slides[Math.min(idx, course.slides.length - 1)].id);
        useUi.getState().setImported(true);
      } catch (e) {
        document.title = 'import-error';
        // eslint-disable-next-line no-console
        console.error('[demo-import] failed:', e);
        const pre = document.createElement('pre');
        pre.style.cssText = 'position:fixed;inset:20px;z-index:9999;background:#fff;color:#b00;padding:20px;overflow:auto;font:12px monospace;border:2px solid #b00';
        pre.textContent = '[demo-import] ' + (e instanceof Error ? e.stack ?? e.message : String(e));
        document.body.appendChild(pre);
      }
    })();
  }, [demoParam]);

  return (
    <div
      data-theme={prefs.dark ? 'dark' : 'light'}
      className={mode === 'edit' ? 'mode-edit' : 'mode-preview'}
      style={{ ...themeVars, height: '100vh', display: 'flex', flexDirection: 'column' } as React.CSSProperties}
    >
      {demo ? <DevHarness /> : imported ? <EditorShell /> : <ImportScreen />}
    </div>
  );
}
