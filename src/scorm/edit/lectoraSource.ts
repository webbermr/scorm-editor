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

/** Rewrite the visible text of one element's argument: the new text goes into the
 *  first run, the remaining runs are cleared (mirroring the live preview). Keyed on
 *  the element id, which is authoritative — we don't gate on the old text matching,
 *  since the rendered DOM decodes entities/whitespace in ways the source doesn't, and
 *  the user explicitly chose this element. Null only if there's no text run to write. */
function replaceVisibleText(arg: string, to: string): string | null {
  const visible = textSegments(arg).filter((s) => normalizeVisible(s.raw).length > 0);
  if (!visible.length) return null;
  let out = arg;
  for (let i = visible.length - 1; i >= 0; i--) {
    const seg = visible[i];
    const text = i === 0 ? toSourceText(to) : '';
    out = out.slice(0, seg.start) + text + out.slice(seg.end);
  }
  return out;
}

function applyOne(source: string, edit: SourceTextEdit): string | null {
  const found = findInnerTextArg(source, edit.elementId);
  if (!found) return null;
  const newArg = replaceVisibleText(found.arg, edit.to);
  if (newArg == null) return null;
  return source.slice(0, found.start) + newArg + source.slice(found.end);
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
  }
  return { source: out, applied, failed };
}
