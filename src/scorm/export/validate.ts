// Pre-export SCORM validation. Runs against the *generated* package (the JSZip we
// are about to download), so it catches problems introduced by the export itself —
// e.g. the manifest referencing a page we removed, a launch file that didn't make
// it into the zip, a missing scormType. Tool-agnostic; works for both the rebuilt
// and the faithful-copy export paths.

import type JSZip from 'jszip';
import { parseManifest } from '@/scorm/import/parseManifest';
import { normalize } from '@/scorm/import/paths';
import type { ScormVersion } from '@/types/course';

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: IssueLevel;
  /** stable machine code, handy for tests */
  code: string;
  message: string;
  /** optional second line with context / how to fix */
  detail?: string;
}

export interface ValidationCheck {
  label: string;
  passed: boolean;
}

export interface ValidationReport {
  /** true when there are no errors (warnings are allowed) */
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** high-level checklist for the UI summary */
  checks: ValidationCheck[];
}

export interface ValidateOptions {
  /** the SCORM version the export claims to be — flagged if the manifest disagrees */
  expectedVersion?: ScormVersion;
}

const cleanRef = (s: string): string => s.split('#')[0].split('?')[0];

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const LARGE_PACKAGE_BYTES = 100 * 1024 * 1024; // ~100 MB — many LMSs reject above this

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Append a "package is very large" warning once the final blob size is known. */
export function noteSize(report: ValidationReport, bytes: number): void {
  if (bytes > LARGE_PACKAGE_BYTES) {
    report.warnings.push({
      level: 'warning',
      code: 'large-package',
      message: `Package is ${humanSize(bytes)} — large packages upload slowly and some LMSs reject them.`,
      detail: 'Consider removing unused media or splitting the course.',
    });
  }
}

export async function validatePackage(zip: JSZip, opts: ValidateOptions = {}): Promise<ValidationReport> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string, detail?: string) => errors.push({ level: 'error', code, message, detail });
  const warn = (code: string, message: string, detail?: string) => warnings.push({ level: 'warning', code, message, detail });

  // Index every file path in the package once (case-sensitive + case-folded).
  const paths: string[] = [];
  zip.forEach((p, entry) => {
    if (!entry.dir) paths.push(p);
  });
  const exact = new Set(paths);
  const folded = new Map<string, string>();
  for (const p of paths) folded.set(p.toLowerCase(), p);

  // Resolve a manifest-relative href to a file in the zip.
  // Returns 'exact' (found), 'case' (found but letter-case differs), or 'missing'.
  const lookup = (href: string): 'exact' | 'case' | 'missing' => {
    const candidates = [normalize(cleanRef(href))];
    const dec = safeDecode(candidates[0]);
    if (dec !== candidates[0]) candidates.push(dec);
    for (const c of candidates) if (exact.has(c)) return 'exact';
    for (const c of candidates) if (folded.has(c.toLowerCase())) return 'case';
    return 'missing';
  };

  const buildChecks = (): ValidationCheck[] => {
    const all = [...errors, ...warnings];
    const hasErr = (codes: string[]) => errors.some((i) => codes.includes(i.code));
    const hasAny = (codes: string[]) => all.some((i) => codes.includes(i.code));
    return [
      { label: 'imsmanifest.xml present and well-formed', passed: !hasErr(['no-manifest', 'manifest-parse', 'manifest-not-root']) },
      { label: 'Course has a launchable item (SCO)', passed: !hasErr(['no-items', 'no-launchable', 'dangling-item', 'launchable-no-href']) },
      { label: 'Every referenced file exists in the package', passed: !hasErr(['missing-file', 'missing-href']) },
      { label: 'Resource types & launch files look right', passed: !hasAny(['no-scormtype', 'launch-not-html', 'case-file', 'case-href']) },
      { label: 'SCORM version is consistent', passed: !hasErr(['version-mismatch']) },
    ];
  };

  const done = (): ValidationReport => ({ ok: errors.length === 0, errors, warnings, checks: buildChecks() });

  // 1) imsmanifest.xml present, and at the package root.
  if (!exact.has('imsmanifest.xml')) {
    const elsewhere = paths.find((p) => /(^|\/)imsmanifest\.xml$/i.test(p));
    if (!elsewhere) {
      err('no-manifest', 'No imsmanifest.xml found in the package.', 'Every SCORM package must contain a manifest at its root.');
      return done();
    }
    err('manifest-not-root', `imsmanifest.xml is not at the package root (found at "${elsewhere}").`, 'Most LMSs require the manifest at the top level of the .zip.');
  }
  const manifestPath = exact.has('imsmanifest.xml') ? 'imsmanifest.xml' : paths.find((p) => /(^|\/)imsmanifest\.xml$/i.test(p))!;

  // 2) Manifest parses.
  const xml = await zip.file(manifestPath)!.async('string');
  let parsed;
  try {
    parsed = parseManifest(xml);
  } catch (e) {
    err('manifest-parse', 'imsmanifest.xml could not be parsed.', e instanceof Error ? e.message : 'XML parse error');
    return done();
  }

  // 3) Version consistency.
  if (opts.expectedVersion && parsed.version !== opts.expectedVersion) {
    err('version-mismatch', `Manifest declares SCORM ${parsed.version} but the export is set to ${opts.expectedVersion}.`);
  }

  // 4) Course structure → at least one launchable item.
  const launchable = parsed.items.filter((i) => i.launchable);
  if (!parsed.items.length) {
    err('no-items', 'The manifest organization contains no items.', 'Learners would have nothing to open.');
  } else if (!launchable.length) {
    err('no-launchable', 'No launchable item (SCO/asset) in the manifest.', 'At least one <item> must point to a resource.');
  }

  // 5) Each launchable item resolves to a real resource with a launch file.
  for (const it of launchable) {
    const res = it.identifierref ? parsed.resources.get(it.identifierref) : undefined;
    if (!res) {
      err('dangling-item', `Item “${it.title}” points to resource “${it.identifierref}”, which doesn’t exist.`);
      continue;
    }
    if (!res.href) {
      err('launchable-no-href', `Launchable resource “${res.identifier}” (for “${it.title}”) has no href.`);
    } else if (!/\.x?html?$/i.test(cleanRef(res.href))) {
      warn('launch-not-html', `Launch file for “${it.title}” isn’t HTML: ${res.href}`);
    }
    if (res.href && !res.scormType) {
      warn('no-scormtype', `Resource “${res.identifier}” has no scormType (sco/asset).`, 'Some LMSs require adlcp:scormType on launchable resources.');
    }
  }

  // 6) Every file the manifest references must actually be in the package.
  //    (This is the big one — it catches a manifest that still lists a page the
  //     editor removed, or a launch file that didn't get packaged.)
  const launchTargets = new Set(launchable.map((i) => i.identifierref));
  for (const res of parsed.resources.values()) {
    if (res.href) {
      const st = lookup(res.href);
      if (st === 'missing') {
        err('missing-href', `Launch file is missing from the package: ${cleanRef(res.href)}`, `Referenced by resource “${res.identifier}”.`);
      } else if (st === 'case' && launchTargets.has(res.identifier)) {
        warn('case-href', `Launch file matches only by letter case: ${cleanRef(res.href)}`, 'Case-sensitive LMS file systems may fail to find it.');
      }
    }
    for (const f of res.files) {
      const st = lookup(f);
      if (st === 'missing') {
        err('missing-file', `Manifest lists a file that isn’t in the package: ${cleanRef(f)}`, `Referenced by resource “${res.identifier}”.`);
      } else if (st === 'case') {
        warn('case-file', `File matches only by letter case: ${cleanRef(f)}`, 'Case-sensitive LMS file systems may fail to find it.');
      }
    }
  }

  return done();
}
