// Best-effort text recovery for runtime-rendered SCO pages (e.g. Lectora), where
// the visible prose is embedded in escaped JavaScript string literals rather than
// the static DOM. We can't run the player, but we can pull readable text runs out
// of the escaped HTML fragments. Reading order isn't guaranteed, so pages built
// this way are always flagged as partial (read-only) imports.

const ENTITIES: Array<[RegExp, string]> = [
  [/&amp;/g, '&'],
  [/&#160;|&nbsp;/g, ' '],
  [/&copy;|&#169;/g, '©'],
  [/&#8217;|&#x27;|&rsquo;/g, '’'],
  [/&#8216;|&lsquo;/g, '‘'],
  [/&#8211;|&ndash;/g, '–'],
  [/&#8212;|&mdash;/g, '—'],
  [/&quot;/g, '"'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
];

const decodeEntities = (s: string): string => {
  let out = s;
  for (const [re, ch] of ENTITIES) out = out.replace(re, ch);
  return out;
};

// Heuristic: does a captured run read like human prose rather than code? The
// `>…<` capture can match JS that sits between comparison operators inside a
// <script>, so we reject anything with code-shaped tokens.
function looksProse(t: string): boolean {
  if (t.length < 4) return false;
  if (!/[a-zA-Z]{3}/.test(t)) return false;
  // code-shaped tokens: brackets, assignment/operators, dotted identifiers,
  // camelCase, long digit runs, function-call-with-number, css-ish
  if (/[{}[\];=]|=>|\|\||&&|\w\.\w|[a-z][A-Z]|\d{3,}|\(\s*[\d,]|px\b|font-/.test(t)) return false;
  const letters = (t.match(/[a-zA-Z]/g) ?? []).length;
  if (letters / t.length < 0.6) return false;
  // a single very long token with no spaces is almost certainly an identifier
  if (!/\s/.test(t) && t.length > 22) return false;
  return true;
}

/** Extract ordered, de-duplicated prose runs from a runtime-rendered page. */
export function recoverRuntimeText(html: string): string[] {
  // Unescape JS string escapes so escaped HTML fragments become matchable markup.
  const s = html
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\x27/g, "'")
    .replace(/\\\//g, '/')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\r/g, '');

  const runs: string[] = [];
  const seen = new Set<string>();
  const re = />([^<>{}]{3,}?)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const t = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    if (!looksProse(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    runs.push(t);
  }
  return runs;
}

/**
 * Given the recovered runs for every page, return the set of runs that are shared
 * player chrome (appear on a large fraction of pages) and should be dropped.
 */
export function sharedChrome(perPageRuns: string[][], minFraction = 0.4): Set<string> {
  const pages = perPageRuns.length;
  if (pages < 4) return new Set();
  const counts = new Map<string, number>();
  for (const runs of perPageRuns) {
    for (const r of new Set(runs)) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(pages * minFraction));
  const chrome = new Set<string>();
  for (const [run, n] of counts) if (n >= threshold) chrome.add(run);
  return chrome;
}
