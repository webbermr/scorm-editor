// In-place text editing for Lectora pages.
//
// Lectora builds each page's DOM at runtime from escaped-HTML JS strings:
//
//   text236596.addInnerText('<div id=\"text236596\"> … <span class=\"text236596Font1\">
//                            Copyright © 2017 …</span> … </div>');
//   text236596.build()
//
// The visible words live in the text nodes (between `>` and `<`) of that escaped HTML
// argument — often split across several <span>/<p> runs. To change the text we verify
// the element's combined visible text still matches the original, then write the new
// text into the first run and clear the others (mirroring the live preview, which puts
// all the text in the first node). Layout, fonts and structure are otherwise untouched.

import type { SourceTextEdit } from '@/types/course';
import { alignLines } from './alignLines';

export interface TextEditResult {
  source: string;
  /** element ids whose text was successfully replaced */
  applied: string[];
  /** element ids we couldn't locate / match (left unchanged) */
  failed: string[];
}

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** HTML-escape the characters that would otherwise break out of text content. */
const htmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escape for embedding inside a single-quoted JS string literal (the addInnerText arg). */
const jsEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '\\n');

/** The form a piece of visible text takes inside the addInnerText('…') argument.
 *  Typed line breaks become <br /> so they survive (HTML collapses bare newlines). */
const toSourceText = (s: string): string => {
  const html = htmlEscape(s.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br />');
  return jsEscape(html);
};

/** Normalize a text fragment for comparison: undo JS-string escapes, decode the
 *  common HTML entities, collapse whitespace. Lets the original visible text (from
 *  the rendered DOM) be matched against the escaped/entity-encoded source. */
function normalizeVisible(s: string): string {
  let t = s.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '' : c));
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
  return t.replace(/[\s ]+/g, ' ').trim();
}

/**
 * Capture an element's `addInnerText('…')` argument. The argument is a single-quoted
 * JS string whose own quotes are backslash-escaped, so we read up to the first
 * unescaped quote that is immediately followed by `); <id>.build()`.
 */
function findInnerTextArg(source: string, elementId: string): { start: number; end: number; arg: string } | null {
  const id = reEscape(elementId);
  const re = new RegExp(`${id}\\.addInnerText\\('([\\s\\S]*?)'\\)\\s*;\\s*${id}\\.build\\s*\\(`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const argStart = m.index + m[0].indexOf(".addInnerText('") + ".addInnerText('".length;
  const argEnd = argStart + m[1].length;
  return { start: argStart, end: argEnd, arg: m[1] };
}

interface Segment {
  start: number; // index of text content within the arg
  end: number;
  raw: string;
}

/** All text-node segments (content between a tag's `>` and the next `<`). */
function textSegments(arg: string): Segment[] {
  const re = />([^<]*)</g;
  const out: Segment[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(arg))) {
    const contentStart = m.index + 1;
    out.push({ start: contentStart, end: contentStart + m[1].length, raw: m[1] });
    re.lastIndex = m.index + m[0].length - 1; // step back onto the trailing '<' so adjacent nodes are caught
  }
  return out;
}

/** The enclosing `<li>…</li>` span around a position in the arg, or null. Used to
 *  drop a whole list item (bullet and all) instead of leaving an empty bullet. */
function enclosingLi(arg: string, pos: number): { start: number; end: number } | null {
  const open = arg.lastIndexOf('<li', pos);
  if (open < 0) return null;
  const after = arg[open + 3];
  if (after !== ' ' && after !== '>' && after !== '\t' && after !== '\\') return null; // not a real <li tag
  const close = arg.indexOf('</li', pos);
  if (close < 0) return null;
  const gt = arg.indexOf('>', close);
  if (gt < 0) return null;
  return { start: open, end: gt + 1 };
}

/** Put the new text back into the element's text runs: each line goes to its own
 *  run (matched by content — see alignLines — so paragraphs, list items and inline
 *  links keep their place, styling and bullets). A run whose line was deleted is
 *  removed — a list item with its bullet, an inline link with its link. Keyed on the
 *  element id (authoritative); null if there's no text run to write. */
function replaceVisibleText(arg: string, to: string): string | null {
  const visible = textSegments(arg).filter((s) => normalizeVisible(s.raw).length > 0);
  if (!visible.length) return null;

  const lines = to.replace(/\r\n?/g, '\n').split('\n');
  const assign = alignLines(visible.map((s) => normalizeVisible(s.raw)), lines);

  let out = arg;
  for (let i = visible.length - 1; i >= 0; i--) {
    const seg = visible[i];
    if (assign[i] == null) {
      const li = enclosingLi(out, seg.start);
      if (li) out = out.slice(0, li.start) + out.slice(li.end);
      else out = out.slice(0, seg.start) + out.slice(seg.end);
    } else {
      // keep the run's own edge spacing ("Click " + "here"), which the editor's
      // trimmed lines don't carry — otherwise neighbouring runs run together
      const edge = /^((?:\s|&nbsp;|\\n)*)[\s\S]*?((?:\s|&nbsp;|\\n)*)$/.exec(seg.raw)!;
      const text = assign[i]!;
      const lead = /^\s/.test(text) ? '' : edge[1];
      const trail = /\s$/.test(text) ? '' : edge[2];
      out = out.slice(0, seg.start) + lead + toSourceText(text) + trail + out.slice(seg.end);
    }
  }
  return dropEmptyLinks(out);
}

/** Remove inline hyperlinks left with no text (their words were deleted), so no
 *  invisible link stays behind. The element's own zero-size anchor (`id="…anc"`,
 *  the whole-box click target) is empty by design and kept. */
function dropEmptyLinks(arg: string): string {
  return arg.replace(/<a\b([^>]*)>((?:(?!<\/a\s*>)[\s\S])*?)<\/a\s*>/g, (whole, attrs: string, inner: string) => {
    if (!/\bhref=/.test(attrs) || /\bid=\\"[^"\\]*anc\\"/.test(attrs)) return whole;
    const text = textSegments(`>${inner}<`).some((seg) => normalizeVisible(seg.raw).length > 0);
    return text ? whole : '';
  });
}

/** An element whose text was deleted entirely: hide it (its box, border and
 *  background go too — Lectora's show/hide only toggles `visibility`, so
 *  `display:none` holds even if an action later "shows" it) and strip its link
 *  hrefs (whole-element onUp links and inline hyperlinks) and pointer cursor. */
function removeEmptiedElementInArg(arg: string, elementId: string): string {
  const openTag = new RegExp(`<\\w+\\s+id=\\\\"${reEscape(elementId)}\\\\"`);
  return arg
    .replace(openTag, (tag) => `${tag} style=\\"display:none\\"`)
    .replace(/\s*href=\\"[\s\S]*?\\"/g, '')
    .replace(/cursor:\s*pointer/g, 'cursor:default');
}

/** Turn off a Lectora text element's click action in the page script: the onUp
 *  handler flag and the mouse capture that routes clicks to it. */
function disableElementActions(source: string, elementId: string): string {
  const id = reEscape(elementId);
  return source
    .replace(new RegExp(`(?<![\\w$])(${id}\\.hasOnUp\\s*=\\s*)true`, 'g'), '$1false')
    .replace(new RegExp(`(?<![\\w$])(${id}\\.capture\\s*=\\s*)\\d+`, 'g'), (_m, lhs: string) => `${lhs}0`);
}

/** Switch off a clickable object laid over edited text (the hotspot left behind by
 *  a deleted link): no click action, no mouse capture (so no hand cursor), marked
 *  disabled, and — for buttons — created hidden. Returns null if it isn't on this page. */
function disableOverlay(source: string, objectId: string): string | null {
  const id = reEscape(objectId);
  if (!new RegExp(`(?<![\\w$])${id}\\s*=\\s*new\\s+Obj\\w+\\(`).test(source)) return null;
  return disableElementActions(source, objectId)
    .replace(new RegExp(`(?<![\\w$])(${id}\\.hasOnUp\\s*=\\s*false)`, 'g'), (m) => `${m}; ${objectId}.bDisabled = true`)
    .replace(
      // ObjButton(name, alt, x, y, w, h, visible, …) → start hidden
      new RegExp(`(${id}\\s*=\\s*new\\s+ObjButton\\(\\s*'${id}'\\s*,\\s*[^,]*,(?:\\s*-?[\\d.]+\\s*,){4}\\s*)1(\\s*,)`),
      (_m, head: string, tail: string) => `${head}0${tail}`,
    );
}

/** Shift a clickable object laid over edited text so it stays on its words (text
 *  before them was deleted or changed): its x/y in the constructor —
 *  `new ObjButton('id', alt, x, y, …)` / `new ObjImage('id', 'src', alt, x, y, …)` —
 *  and in addIe8Attr(x, y, …). Returns null if the object isn't on this page. */
function moveOverlay(source: string, objectId: string, dx: number, dy: number): string | null {
  const id = reEscape(objectId);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const shift = (_m: string, head: string, x: string, sep: string, y: string) => `${head}${fmt(Number(x) + dx)}${sep}${fmt(Number(y) + dy)}`;
  const ctor = new RegExp(`((?<![\\w$])${id}\\s*=\\s*new\\s+Obj\\w+\\(\\s*'${id}'(?:\\s*,\\s*(?:'(?:[^'\\\\]|\\\\.)*'|null))*\\s*,\\s*)(-?[\\d.]+)(\\s*,\\s*)(-?[\\d.]+)`);
  if (!ctor.test(source)) return null;
  return source
    .replace(ctor, shift)
    .replace(new RegExp(`((?<![\\w$])${id}\\.addIe8Attr\\(\\s*)(-?[\\d.]+)(\\s*,\\s*)(-?[\\d.]+)`), shift);
}

function applyOne(source: string, edit: SourceTextEdit): string | null {
  const found = findInnerTextArg(source, edit.elementId);
  if (!found) return null;
  let newArg = replaceVisibleText(found.arg, edit.to);
  if (newArg == null) return null;
  // Text deleted entirely: remove the element, not just its words — otherwise its
  // empty box stays on screen and, if it was a link, keeps the hand cursor and
  // still acts when clicked (a click-to-close popup could never be closed).
  const emptied = !edit.to.trim();
  if (emptied) newArg = removeEmptiedElementInArg(newArg, edit.elementId);
  const out = source.slice(0, found.start) + newArg + source.slice(found.end);
  return emptied ? disableElementActions(out, edit.elementId) : out;
}

/**
 * Apply a set of text edits to one page's source. Each edit is scoped to its own
 * element. Edits that can't be matched (element absent on this page, or its text no
 * longer matches `from`) are reported in `failed` and leave the source unchanged.
 */
export function applyTextEdits(source: string, edits: SourceTextEdit[]): TextEditResult {
  let out = source;
  const applied: string[] = [];
  const failed: string[] = [];
  for (const edit of edits) {
    if (edit.to === edit.from) continue; // no-op
    const next = applyOne(out, edit);
    if (next == null) {
      failed.push(edit.elementId);
    } else {
      out = next;
      applied.push(edit.elementId);
    }
    // overlays can be on pages that don't carry the text element itself
    for (const objectId of edit.hideObjects ?? []) {
      const off = disableOverlay(out, objectId);
      if (off != null && off !== out) {
        out = off;
        applied.push(objectId);
      }
    }
    for (const [objectId, { dx, dy }] of Object.entries(edit.moveObjects ?? {})) {
      const moved = moveOverlay(out, objectId, dx, dy);
      if (moved != null && moved !== out) {
        out = moved;
        applied.push(objectId);
      }
    }
  }
  return { source: out, applied, failed };
}
