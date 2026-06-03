// Real SCORM export: serialize slides → HTML, regenerate the manifest, bundle
// content + media + assets into a .zip with jszip, validate, and download.

import JSZip from 'jszip';
import { slideToHtml, mediaSectionHtml, SHARED_CSS, scormApiJs, type MediaRef } from './serializeHtml';
import { buildManifest, type SlideResource } from './buildManifest';
import { parseManifest } from '@/scorm/import/parseManifest';
import { dirname, join } from '@/scorm/import/paths';
import { planLectoraDeletions, type LectoraEdits } from './lectoraEdit';
import { validatePackage, noteSize, type ValidationReport } from './validate';
import { applyTextEdits } from '@/scorm/edit/lectoraSource';
import type { Block, Course, ScormVersion, SourceTextEdit } from '@/types/course';

export type { ValidationReport, ValidationIssue, ValidationCheck } from './validate';

export interface ExportOptions {
  name: string;
  version: ScormVersion;
  manifest: boolean;
  minify: boolean;
  includeSource: boolean;
  /** how to build the package:
   *  - 'blocks'   = rebuild a clean, LMS-importable course from the EDITED slides
   *                 (honors deletions/reorder), pulling each slide's real media
   *                 (images + narration) from the source pages where available
   *  - 'original' = faithful verbatim copy of the imported source (ignores edits) */
  mode: 'blocks' | 'original';
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  size: string;
  bytes: number;
  /** pre-download validation of the generated package */
  report: ValidationReport;
}

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const slug = (s: string, i: number): string =>
  (s || `slide-${i + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `slide-${i + 1}`;

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

const EXT_FROM_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

const IMG_REF_RE = /(?:src|href|xlink:href)\s*=\s*\\?["']([^"'\\)>]+?\.(?:png|jpe?g|gif|svg|webp|bmp))(?:[?#][^"'\\)>]*)?/gi;
const AUDIO_REF_RE = /["'\\(]([^"'\\)>]+?\.(?:mp3|ogg|oga|m4a|aac|wav))(?:[?#][^"'\\)>]*)?/gi;
const cleanRef = (s: string): string => s.split('#')[0].split('?')[0];

function extractRefs(re: RegExp, html: string): string[] {
  const out = new Set<string>();
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.add(m[1]);
  return [...out];
}

// Rebuild a clean, LMS-importable course from the EDITED slide list. Deletions and
// reordering are honored (we generate our own pages + manifest), and each slide's
// real media (content images + narration) is pulled from its source page so the
// trimmed course keeps its assets — without the original player's embedded,
// course-wide navigation (which is what made per-page splitting unusable).
export async function buildScormPackage(
  course: Course,
  opts: ExportOptions,
  originalFile?: File | null,
  removedPages?: string[],
): Promise<ExportResult> {
  if (opts.mode === 'original' && originalFile) {
    return buildOriginalPackage(course, opts, originalFile, removedPages);
  }

  const zip = new JSZip();
  const { version } = opts;
  zip.file('assets/styles.css', SHARED_CSS);
  zip.file('assets/scorm_api.js', scormApiJs(version));

  const srcZip = originalFile ? await JSZip.loadAsync(originalFile) : null;

  // PASS 1 — collect each slide's source media (resolved to files that exist),
  // so we can tell page-specific content images from shared UI chrome.
  const slideImgs: string[][] = [];
  const slideAudio: string[][] = [];
  const imgFreq = new Map<string, number>();
  for (const slide of course.slides) {
    let imgs: string[] = [];
    let auds: string[] = [];
    if (srcZip && slide.sourceHref && srcZip.file(slide.sourceHref)) {
      const page = await srcZip.file(slide.sourceHref)!.async('string');
      const dir = dirname(slide.sourceHref);
      const resolve = (refs: string[]) =>
        refs
          .filter((r) => !/^(https?:|data:)/i.test(r))
          .map((r) => join(dir, cleanRef(r)))
          .filter((p) => !!srcZip.file(p));
      imgs = [...new Set(resolve(extractRefs(IMG_REF_RE, page)))];
      auds = [...new Set(resolve(extractRefs(AUDIO_REF_RE, page)))];
    }
    slideImgs.push(imgs);
    slideAudio.push(auds);
    for (const p of imgs) imgFreq.set(p, (imgFreq.get(p) ?? 0) + 1);
  }
  // images shared across many pages are UI chrome (logos, buttons) → drop them
  const shareThreshold = Math.max(3, Math.ceil(course.slides.length * 0.35));
  const sharedImg = new Set([...imgFreq].filter(([, c]) => c >= shareThreshold).map(([p]) => p));

  // PASS 2 — generate one clean page per remaining slide
  const slideRes: SlideResource[] = [];
  const mediaCache = new Map<string, string>(); // source path -> export path
  let mediaIndex = 0;
  const copyMedia = async (srcPath: string): Promise<string | null> => {
    if (!srcZip) return null;
    if (mediaCache.has(srcPath)) return mediaCache.get(srcPath)!;
    const f = srcZip.file(srcPath);
    if (!f) return null;
    const ext = (srcPath.split('.').pop() || 'bin').toLowerCase();
    const out = `media/m${++mediaIndex}.${ext}`;
    zip.file(out, await f.async('uint8array'));
    mediaCache.set(srcPath, out);
    return out;
  };

  for (let i = 0; i < course.slides.length; i++) {
    const slide = course.slides[i];
    const base = `${String(i + 1).padStart(2, '0')}-${slug(slide.name, i)}`;
    const href = `${base}.html`;
    const files: string[] = [href, 'assets/styles.css', 'assets/scorm_api.js'];

    // images from edited image-blocks (object URLs from import / replace)
    const mediaMap = new Map<string, string>();
    for (const b of slide.blocks ?? []) {
      if (b.type === 'image' && b.url) {
        const blob = await fetchBlob(b.url);
        if (blob) {
          const ext = EXT_FROM_TYPE[blob.type] || 'png';
          const path = `media/asset-${++mediaIndex}.${ext}`;
          zip.file(path, blob);
          mediaMap.set(b.id, path);
          files.push(path);
        }
      }
    }

    // content images + narration extracted from this slide's source page
    const imgPaths: string[] = [];
    for (const op of slideImgs[i].filter((p) => !sharedImg.has(p)).slice(0, 16)) {
      const ep = await copyMedia(op);
      if (ep) {
        imgPaths.push(ep);
        files.push(ep);
      }
    }
    const audPaths: string[] = [];
    for (const op of slideAudio[i].slice(0, 4)) {
      const ep = await copyMedia(op);
      if (ep) {
        audPaths.push(ep);
        files.push(ep);
      }
    }

    const mediaRef: MediaRef = (block: Extract<Block, { type: 'image' }>) => mediaMap.get(block.id) ?? '';
    zip.file(href, slideToHtml(slide, course, mediaRef, mediaSectionHtml(imgPaths, audPaths)));

    slideRes.push({ itemId: `ITEM-${i + 1}`, resId: `RES-${i + 1}`, title: slide.name, href, files });
  }

  // SCORM manifest (one item per remaining slide) — validated so the LMS accepts it
  const manifestXml = buildManifest(course, version, slideRes);
  zip.file('imsmanifest.xml', manifestXml);
  if (opts.includeSource) zip.file('source/course.json', JSON.stringify(course, null, 2));

  // Validate the generated package before producing the downloadable blob.
  const report = await validatePackage(zip, { expectedVersion: version });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: opts.minify ? 9 : 6 },
  });
  noteSize(report, blob.size);

  const filename = `${opts.name || 'course'}.zip`;
  return { blob, filename, size: humanSize(blob.size), bytes: blob.size, report };
}

const xmlEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function findManifestPath(zip: JSZip): string | null {
  let best: string | null = null;
  zip.forEach((path) => {
    if (/(^|\/)imsmanifest\.xml$/i.test(path) && (best === null || path.length < best.length)) best = path;
  });
  return best;
}

/** Update the imported manifest's metadata (title, mastery/passing score) from the
 *  editor without touching its resource/asset graph. Best-effort; safe on failure. */
function patchManifestMeta(xml: string, course: Course): string {
  let out = xml;
  try {
    // course title — first <title> inside the organization
    out = out.replace(/(<organization\b[^>]*>\s*<title>)([\s\S]*?)(<\/title>)/i, (_m, a, _t, c) => a + xmlEscape(course.meta.title) + c);
    // SCORM 1.2 mastery score
    out = out.replace(/(<adlcp:masteryscore>)\s*[\d.]+\s*(<\/adlcp:masteryscore>)/gi, `$1${course.meta.passingScore}$2`);
    // SCORM 2004 min normalized measure (0..1)
    out = out.replace(/(<imsss:minNormalizedMeasure>)\s*[\d.]+\s*(<\/imsss:minNormalizedMeasure>)/gi, `$1${(course.meta.passingScore / 100).toFixed(2)}$2`);
  } catch {
    return xml;
  }
  return out;
}

// Re-package the imported source faithfully: copy every file (all media, audio,
// narration, player, pages) and patch the manifest metadata from the editor. When
// the editor removed pages from a Lectora course, apply the navigation surgery so
// the trimmed course keeps its original design.
async function buildOriginalPackage(course: Course, opts: ExportOptions, originalFile: File, removedPages?: string[]): Promise<ExportResult> {
  const src = await JSZip.loadAsync(originalFile);
  const out = new JSZip();
  const manifestPath = findManifestPath(src);

  // Plan page deletions for Lectora (re-point neighbors, fix counts, prune TOC).
  let edits: LectoraEdits | null = null;
  if (removedPages && removedPages.length && course.meta.authoringTool === 'Lectora') {
    edits = await planLectoraDeletions(src, new Set(removedPages));
  }

  // In-place text edits the editor made on original pages, keyed by page href.
  const textEdits = new Map<string, SourceTextEdit[]>();
  for (const s of course.slides) {
    if (s.sourceHref && s.sourceEdits?.text?.length) textEdits.set(s.sourceHref, s.sourceEdits.text);
  }

  const tasks: Promise<void>[] = [];
  src.forEach((path, entry) => {
    if (entry.dir) return;
    if (manifestPath && path === manifestPath) return; // patched below
    if (edits?.removed.has(path)) return; // page removed by the editor
    const pageTextEdits = textEdits.get(path);
    if (edits?.rewrites.has(path)) {
      // page already rewritten by nav surgery — apply text edits on top of it
      let content = edits.rewrites.get(path)!;
      if (pageTextEdits) content = applyTextEdits(content, pageTextEdits).source;
      out.file(path, content);
      return;
    }
    if (pageTextEdits) {
      tasks.push(
        entry.async('string').then((str) => {
          out.file(path, applyTextEdits(str, pageTextEdits).source);
        }),
      );
      return;
    }
    tasks.push(
      entry.async('uint8array').then((data) => {
        out.file(path, data);
      }),
    );
  });
  await Promise.all(tasks);

  if (manifestPath) {
    const original = await src.file(manifestPath)!.async('string');
    let patched = patchManifestMeta(original, course);
    // drop <file> entries for pages we removed so the manifest matches the package
    if (edits) {
      for (const r of edits.removed) {
        patched = patched.replace(new RegExp(`[ \\t]*<file\\b[^>]*\\bhref="${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/?>\\s*(?:</file>)?\\s*\\r?\\n?`, 'gi'), '');
      }
    }
    out.file(manifestPath, patched);
    // sanity-check the manifest still parses
    try {
      parseManifest(patched);
    } catch {
      out.file(manifestPath, original); // fall back to the untouched original
    }
  }

  if (opts.includeSource) out.file('scorm-editor/course.json', JSON.stringify(course, null, 2));

  // Validate the re-packaged source — especially important after Lectora page
  // surgery, which rewrites navigation and prunes manifest <file> entries.
  const report = await validatePackage(out, { expectedVersion: course.meta.scormVersion });

  const blob = await out.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: opts.minify ? 9 : 6 },
  });
  noteSize(report, blob.size);

  const filename = `${opts.name || 'course'}.zip`;
  return { blob, filename, size: humanSize(blob.size), bytes: blob.size, report };
}


export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
