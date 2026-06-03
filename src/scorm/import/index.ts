// Real SCORM import: unzip → parse manifest → map items to slides → extract
// media → decompose HTML into editable blocks. Returns a Course document.

import JSZip from 'jszip';
import { makeId } from '@/lib/id';
import { parseManifest, type ParsedManifest } from './parseManifest';
import { htmlToBlocks, type DecomposeResult } from './htmlToBlocks';
import { recoverRuntimeText, sharedChrome } from './recoverText';
import { detectAuthoringTool } from './detectTool';
import { dirname, join, IMAGE_RE, HTML_RE } from './paths';
import type { Course, Slide } from '@/types/course';

export const IMPORT_STEPS = [
  'Unzipping package',
  'Reading imsmanifest.xml',
  'Mapping SCOs to slides',
  'Extracting media assets',
  'Ready to edit',
] as const;

export type ProgressFn = (currentStep: number) => void;

/** Object URLs created during an import, so the caller can revoke them on unload. */
export interface ImportedCourse {
  course: Course;
  objectUrls: string[];
  /** package-relative path of the course launcher, for the "View Original" iframe */
  launchHref: string | null;
}

const tick = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function findManifestPath(zip: JSZip): string | null {
  let best: string | null = null;
  zip.forEach((path) => {
    if (/(^|\/)imsmanifest\.xml$/i.test(path)) {
      // prefer the shallowest manifest
      if (best === null || path.split('/').length < best.split('/').length) best = path;
    }
  });
  return best;
}

export async function importScorm(file: File, onProgress?: ProgressFn): Promise<ImportedCourse> {
  const objectUrls: string[] = [];
  const report = (s: number) => onProgress?.(s);

  // 1) Unzip
  report(0);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Could not read the .zip — it may be corrupt or not a zip file.');
  }
  await tick();

  // 2) Manifest
  report(1);
  const manifestPath = findManifestPath(zip);
  if (!manifestPath) throw new Error('No imsmanifest.xml found — this doesn’t look like a SCORM package.');
  const manifestDir = dirname(manifestPath);
  const manifestXml = await zip.file(manifestPath)!.async('string');
  let parsed: ParsedManifest;
  try {
    parsed = parseManifest(manifestXml, file.name.replace(/\.zip$/i, ''));
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Failed to parse imsmanifest.xml.');
  }
  await tick();

  // 4) Media map (done before mapping so HTML images resolve) — keyed by normalized path
  const mediaUrls = new Map<string, string>();
  const allPaths: string[] = [];
  const imageFiles: string[] = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    allPaths.push(path);
    if (IMAGE_RE.test(path)) imageFiles.push(path);
  });
  const authoringTool = detectAuthoringTool(manifestXml, allPaths);

  // 3) Map items → slides
  report(2);
  const launchable = parsed.items.filter((i) => i.launchable);
  const itemsToMap = launchable.length ? launchable : parsed.items.filter((i) => i.depth >= 0);

  const readFile = async (path: string): Promise<string | null> => {
    const f = zip.file(path);
    return f ? f.async('string') : null;
  };

  const ensureImageUrl = async (path: string): Promise<string | undefined> => {
    if (mediaUrls.has(path)) return mediaUrls.get(path);
    const f = zip.file(path);
    if (!f) return undefined;
    const blob = await f.async('blob');
    const url = URL.createObjectURL(blob);
    mediaUrls.set(path, url);
    objectUrls.push(url);
    return url;
  };

  const clean = (s: string): string => s.split('#')[0].split('?')[0];

  interface Page {
    path: string;
    html: string;
    decomp: DecomposeResult;
  }

  // Read one HTML file and decompose it. Image extraction is LAZY: we first
  // decompose with a no-op resolver (cheap), and only if the page yields real
  // editable content do we resolve its images and re-decompose. This avoids
  // decompressing thousands of throwaway button images on runtime-rendered pages
  // whose slides end up text-only.
  const processPage = async (htmlPath: string): Promise<Page | null> => {
    const html = await readFile(htmlPath);
    if (html == null) return null;
    let decomp = htmlToBlocks(html, () => undefined);

    if (decomp.hasContent && /<img\b/i.test(html)) {
      const htmlDir = dirname(htmlPath);
      const candidate = new Map<string, string | undefined>();
      const imgSrcs = Array.from(html.matchAll(/<img[^>]+src\s*=\s*\\?["']([^"'\\]+)/gi))
        .map((m) => m[1])
        .slice(0, 60);
      for (const src of imgSrcs) {
        if (/^(https?:|data:)/i.test(src)) continue;
        const p = join(htmlDir, clean(src));
        candidate.set(p, await ensureImageUrl(p));
      }
      const resolveImg = (src: string): string | undefined => {
        if (!src || /^(https?:|data:)/i.test(src)) return src || undefined;
        return candidate.get(join(htmlDir, clean(src)));
      };
      decomp = htmlToBlocks(html, resolveImg);
    }

    return { path: htmlPath, html, decomp };
  };

  // Transitively collect every HTML page reachable from a resource via its files
  // and <dependency> links (covers tool-authored single-SCO packages like Lectora).
  const collectHtmlPaths = (rootId: string): string[] => {
    const visited = new Set<string>();
    const seen = new Set<string>();
    const out: string[] = [];
    const walk = (resId: string) => {
      if (visited.has(resId)) return;
      visited.add(resId);
      const r = parsed.resources.get(resId);
      if (!r) return;
      for (const f of r.files) {
        if (!HTML_RE.test(f)) continue;
        const p = join(manifestDir, clean(f));
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      }
      for (const dep of r.dependencies) walk(dep);
    };
    walk(rootId);
    return out.slice(0, 300); // backstop against pathological packages
  };

  const prettyName = (path: string): string => {
    const base = (path.split('/').pop() ?? path).replace(/\.html?$/i, '');
    const words = base.replace(/[-_]+/g, ' ').trim();
    return words.replace(/\b\w/g, (c) => c.toUpperCase()) || base;
  };
  // Prefer a real in-page heading (decomposed pages like hand-built courses),
  // then the page <title> (meaningful on tool-authored pages like Lectora),
  // then a prettified filename.
  const pageName = (p: Page): string => p.decomp.heading || p.decomp.docTitle?.trim() || prettyName(p.path);

  const makeSlide = (name: string, result: DecomposeResult, sourceHref?: string): Slide => ({
    id: makeId(),
    type: 'content',
    name,
    status: 'not-started',
    duration: '—',
    blocks: result.blocks,
    ...(result.raw ? { rawImported: true } : {}),
    ...(sourceHref ? { sourceHref } : {}),
  });

  const recoveredSlide = (name: string, runs: string[], sourceHref?: string): Slide => ({
    id: makeId(),
    type: 'content',
    name,
    status: 'not-started',
    duration: '—',
    rawImported: true,
    ...(sourceHref ? { sourceHref } : {}),
    blocks: [
      { id: makeId(), type: 'heading', text: name },
      ...runs.map((t) => ({ id: makeId(), type: 'paragraph' as const, text: t })),
    ],
  });

  const headingSlide = (name: string): Slide => ({
    id: makeId(),
    type: 'content',
    name,
    status: 'not-started',
    duration: '—',
    blocks: [{ id: makeId(), type: 'heading', text: name }],
  });

  const slides: Slide[] = [];
  // The course launcher (first launchable HTML SCO) — used to render the whole
  // original course faithfully in the "View Original" iframe.
  let courseLaunchHref: string | null = null;

  for (const item of itemsToMap) {
    const res = item.identifierref ? parsed.resources.get(item.identifierref) : undefined;
    const href = res?.href;

    if (res && href && HTML_RE.test(href)) {
      const launchPath = join(manifestDir, clean(href));
      if (!courseLaunchHref) courseLaunchHref = launchPath;
      const launch = await processPage(launchPath);
      const otherPaths = collectHtmlPaths(res.identifier).filter((p) => p !== launchPath);
      const others = (await Promise.all(otherPaths.map(processPage))).filter((p): p is Page => p !== null);

      // Recover runtime-rendered text for content-less pages, then drop shared
      // player chrome (boilerplate that repeats across most pages).
      const runtimeRuns = others.map((p) => (p.decomp.hasContent ? [] : recoverRuntimeText(p.html)));
      const chrome = sharedChrome(runtimeRuns.filter((r) => r.length > 0));

      const built: Slide[] = [];
      if (launch?.decomp.hasContent) built.push(makeSlide(launch.decomp.heading ?? item.title, launch.decomp, launchPath));
      others.forEach((p, i) => {
        if (p.decomp.hasContent) {
          built.push(makeSlide(pageName(p), p.decomp, p.path));
          return;
        }
        const name = pageName(p);
        const runs = runtimeRuns[i].filter((r) => !chrome.has(r) && r !== name);
        if (runs.length) built.push(recoveredSlide(name, runs, p.path));
      });

      if (built.length) slides.push(...built);
      else if (launch) slides.push(makeSlide(item.title, launch.decomp, launchPath)); // raw fallback, still flagged
      else slides.push(headingSlide(item.title));
    } else if (href && IMAGE_RE.test(href)) {
      const url = await ensureImageUrl(join(manifestDir, href));
      slides.push({
        id: makeId(),
        type: 'content',
        name: item.title,
        status: 'not-started',
        duration: '—',
        blocks: [
          { id: makeId(), type: 'heading', text: item.title },
          { id: makeId(), type: 'image', src: 'generic', url },
        ],
      });
    } else {
      // Asset/cluster with no launchable HTML — keep a minimal editable heading.
      slides.push(headingSlide(item.title));
    }
  }

  // 4) finish media extraction (any remaining unreferenced images are left lazy)
  report(3);
  await tick();
  void imageFiles;

  if (!slides.length) throw new Error('The manifest defined no launchable content to import.');

  const passingScore = itemsToMap.find((i) => typeof i.masteryScore === 'number')?.masteryScore ?? 80;

  const course: Course = {
    meta: {
      title: parsed.courseTitle,
      package: file.name,
      identifier: parsed.identifier,
      scormVersion: parsed.version,
      edition: parsed.version === '1.2' ? 'SCORM 1.2' : 'SCORM 2004',
      language: 'English (US)',
      author: '',
      duration: '—',
      passingScore,
      masteryRule: 'completed-passed',
      trackTime: true,
      allowReview: true,
      description: '',
      ...(authoringTool ? { authoringTool } : {}),
    },
    slides,
  };

  report(4);
  await tick(120);
  return { course, objectUrls, launchHref: courseLaunchHref };
}
