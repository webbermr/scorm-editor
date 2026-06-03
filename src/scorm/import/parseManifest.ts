// Parse imsmanifest.xml → a normalized, version-detected structure that the
// slide mapper consumes. Supports SCORM 1.2 and SCORM 2004.

import { XMLParser } from 'fast-xml-parser';
import type { ScormVersion } from '@/types/course';

export interface ParsedItem {
  identifier: string;
  title: string;
  identifierref?: string;
  masteryScore?: number; // 0..100
  depth: number;
  /** true when this item launches content (leaf SCO/asset) */
  launchable: boolean;
}

export interface ParsedResource {
  identifier: string;
  href?: string;
  scormType?: string;
  files: string[];
  /** identifierrefs of <dependency> elements (other resources whose files this one needs) */
  dependencies: string[];
}

export interface ParsedManifest {
  version: ScormVersion;
  courseTitle: string;
  identifier: string;
  items: ParsedItem[];
  resources: Map<string, ParsedResource>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyNode = any;

const asArray = <T,>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x == null ? [] : [x]);

const textOf = (node: AnyNode): string => {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  if (typeof node['#text'] !== 'undefined') return String(node['#text']).trim();
  return '';
};

const attr = (node: AnyNode, name: string): string | undefined => {
  if (!node || typeof node !== 'object') return undefined;
  const v = node[`@_${name}`];
  return v == null ? undefined : String(v);
};

/** Find a child value by local name, ignoring any namespace prefix. */
const local = (node: AnyNode, localName: string): AnyNode => {
  if (!node || typeof node !== 'object') return undefined;
  if (localName in node) return node[localName];
  const suffix = `:${localName}`;
  for (const key of Object.keys(node)) {
    if (key.endsWith(suffix)) return node[key];
  }
  return undefined;
};

function detectVersion(manifest: AnyNode): ScormVersion {
  const metadata = local(manifest, 'metadata');
  const schemaversion = textOf(local(metadata, 'schemaversion')).toLowerCase();
  if (schemaversion.includes('1.2')) return '1.2';
  if (schemaversion.includes('2004') || schemaversion.includes('cam 1.3')) return '2004';

  // Fallback: inspect namespaces / scormType casing across the document.
  const xml = JSON.stringify(manifest);
  if (xml.includes('imsss:') || xml.includes('adlcp:scormType')) return '2004';
  return '1.2';
}

function readMasteryScore(item: AnyNode): number | undefined {
  // SCORM 1.2 — <adlcp:masteryscore>
  const m12 = textOf(local(item, 'masteryscore'));
  if (m12) {
    const n = Number(m12);
    if (!Number.isNaN(n)) return Math.round(n <= 1 ? n * 100 : n);
  }
  // SCORM 2004 — imsss minNormalizedMeasure (0..1)
  const seq = local(item, 'sequencing');
  const objectives = local(seq, 'objectives');
  const primary = local(objectives, 'primaryObjective');
  const measure = textOf(local(primary, 'minNormalizedMeasure'));
  if (measure) {
    const n = Number(measure);
    if (!Number.isNaN(n)) return Math.round(n * 100);
  }
  return undefined;
}

function collectItems(node: AnyNode, depth: number, out: ParsedItem[]): void {
  for (const item of asArray(local(node, 'item'))) {
    const children = asArray(local(item, 'item'));
    const identifierref = attr(item, 'identifierref');
    out.push({
      identifier: attr(item, 'identifier') ?? '',
      title: textOf(local(item, 'title')) || 'Untitled',
      identifierref,
      masteryScore: readMasteryScore(item),
      depth,
      launchable: !!identifierref,
    });
    if (children.length) collectItems(item, depth + 1, out);
  }
}

export function parseManifest(xml: string, fallbackTitle = 'Imported course'): ParsedManifest {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  let root: AnyNode;
  try {
    root = parser.parse(xml);
  } catch {
    throw new Error('imsmanifest.xml is not valid XML.');
  }

  const manifest = local(root, 'manifest');
  if (!manifest) throw new Error('No <manifest> element found in imsmanifest.xml.');

  const version = detectVersion(manifest);

  // organizations → default organization
  const organizations = local(manifest, 'organizations');
  const orgList = asArray(local(organizations, 'organization'));
  if (!orgList.length) throw new Error('Manifest has no <organization> — nothing to import.');
  const defaultId = attr(organizations, 'default');
  const org = orgList.find((o: AnyNode) => attr(o, 'identifier') === defaultId) ?? orgList[0];

  const courseTitle = textOf(local(org, 'title')) || fallbackTitle;
  const identifier = attr(manifest, 'identifier') ?? 'COURSE';

  const items: ParsedItem[] = [];
  collectItems(org, 0, items);

  // resources
  const resourcesNode = local(manifest, 'resources');
  const resources = new Map<string, ParsedResource>();
  for (const res of asArray(local(resourcesNode, 'resource'))) {
    const id = attr(res, 'identifier');
    if (!id) continue;
    const files = asArray(local(res, 'file'))
      .map((f: AnyNode) => attr(f, 'href'))
      .filter((h): h is string => !!h);
    const dependencies = asArray(local(res, 'dependency'))
      .map((d: AnyNode) => attr(d, 'identifierref'))
      .filter((h): h is string => !!h);
    resources.set(id, {
      identifier: id,
      href: attr(res, 'href'),
      scormType: attr(res, 'scormType') ?? attr(res, 'scormtype'),
      files,
      dependencies,
    });
  }

  return { version, courseTitle, identifier, items, resources };
}
