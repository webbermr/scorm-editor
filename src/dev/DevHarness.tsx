// Dev-only verification harness (mounted via ?demo=roundtrip). Runs the REAL
// import → export → re-import pipeline against the bundled fixture and reports
// the result, so import/export can be checked end-to-end in a real browser.

import { useEffect, useState } from 'react';
import { importScorm } from '@/scorm/import';
import { buildScormPackage } from '@/scorm/export';
import type { ScormVersion } from '@/types/course';

interface Line {
  label: string;
  value: string;
  ok?: boolean;
}

export function DevHarness() {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const add = (l: Line) => !cancelled && setLines((prev) => [...prev, l]);

    (async () => {
      try {
        const res = await fetch('/test-scorm.zip');
        const blob = await res.blob();
        const file = new File([blob], 'test-scorm.zip', { type: 'application/zip' });

        const { course } = await importScorm(file);
        add({ label: 'Import: detected version', value: `SCORM ${course.meta.scormVersion}`, ok: true });
        add({ label: 'Import: course title', value: course.meta.title, ok: course.meta.title === 'Fire Safety Basics' });
        add({ label: 'Import: slide count', value: String(course.slides.length), ok: course.slides.length === 3 });
        add({ label: 'Import: slide names', value: course.slides.map((s) => s.name).join(' · ') });
        add({ label: 'Import: passing score from manifest', value: `${course.meta.passingScore}%`, ok: course.meta.passingScore === 75 });
        const withImage = course.slides.find((s) => s.blocks?.some((b) => b.type === 'image' && b.url));
        add({ label: 'Import: extracted image asset', value: withImage ? `yes (in "${withImage.name}")` : 'no', ok: !!withImage });
        const flagged = course.slides.find((s) => s.rawImported);
        add({ label: 'Import: non-decomposable HTML flagged', value: flagged ? `yes ("${flagged.name}")` : 'no', ok: !!flagged });

        for (const version of ['2004', '1.2'] as ScormVersion[]) {
          const result = await buildScormPackage(course, {
            name: `export-${version}`,
            version,
            mode: 'blocks',
            manifest: true,
            minify: true,
            includeSource: true,
          });
          add({ label: `Export ${version}: package built`, value: `${result.filename} · ${result.size}`, ok: result.bytes > 0 });

          // re-import the exported package
          const reFile = new File([result.blob], result.filename, { type: 'application/zip' });
          const { course: re } = await importScorm(reFile);
          add({
            label: `Round-trip ${version}: re-import`,
            value: `${re.slides.length} slides · SCORM ${re.meta.scormVersion}`,
            ok: re.slides.length === course.slides.length && re.meta.scormVersion === version,
          });
        }

        add({ label: 'RESULT', value: 'round-trip complete', ok: true });
      } catch (e) {
        add({ label: 'ERROR', value: e instanceof Error ? e.message : String(e), ok: false });
      } finally {
        if (!cancelled) {
          setDone(true);
          document.title = 'roundtrip-done';
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 32, fontFamily: 'var(--font-mono, monospace)', fontSize: 13, lineHeight: 1.7 }}>
      <h2 style={{ fontFamily: 'var(--font-display)' }}>SCORM round-trip harness {done ? '✓' : '…'}</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 16px 3px 0', color: 'var(--ink-2)' }}>{l.label}</td>
              <td style={{ padding: '3px 0', color: l.ok === undefined ? 'var(--ink)' : l.ok ? 'var(--green)' : 'var(--rose)', fontWeight: 700 }}>
                {l.ok === undefined ? '' : l.ok ? '✓ ' : '✗ '}
                {l.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
