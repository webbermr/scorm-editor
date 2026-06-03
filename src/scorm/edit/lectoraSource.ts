// In-place text editing for Lectora pages.
//
// Lectora builds each page's DOM at runtime from escaped-HTML JS strings:
//
//   text236596.addInnerText('<div id=\"text236596\"> … <span class=\"text236596Font1\">
//                            Copyright © 2017 …</span> … </div>');
//   text236596.build()
//
// To change the visible words we scope to that element's addInnerText('…') argument
// (anchored on the trailing `'); <id>.build()`) and replace the old text with the new
// one, matching/writing it the way Lectora stores it (HTML-escaped, then JS-escaped
// for the single-quoted string). Layout, fonts and everything else are untouched.

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

/** Escape for embedding inside a single-quoted JS string literal. */
const jsEscape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/** The form a piece of visible text takes inside the addInnerText('…') argument. */
const toSourceText = (s: string): string => jsEscape(htmlEscape(s));

/**
 * Capture an element's `addInnerText('…')` argument. The argument is a single-quoted
 * JS string whose own quotes are backslash-escaped, so we read up to the first
 * unescaped quote that is immediately followed by `); <id>.build()`.
 */
function findInnerTextArg(source: string, elementId: string): { start: number; end: number; arg: string } | null {
  const id = reEscape(elementId);
  // arg content is non-greedy up to `'); … <id>.build()` which is a stable, unique anchor.
  const re = new RegExp(`${id}\\.addInnerText\\('([\\s\\S]*?)'\\)\\s*;\\s*${id}\\.build\\s*\\(`, 'm');
  const m = re.exec(source);
  if (!m) return null;
  const argStart = m.index + m[0].indexOf(".addInnerText('") + ".addInnerText('".length;
  const argEnd = argStart + m[1].length;
  return { start: argStart, end: argEnd, arg: m[1] };
}

/** Replace the visible text of one element. Returns the new source, or null if the
 *  element / old text couldn't be matched (caller records the failure). */
function applyOne(source: string, edit: SourceTextEdit): string | null {
  const found = findInnerTextArg(source, edit.elementId);
  if (!found) return null;

  const { start, end, arg } = found;
  // Lectora stores the text HTML-escaped + JS-escaped; try that form first, then a
  // raw fallback for text with no special characters.
  const needleEscaped = toSourceText(edit.from);
  const needleRaw = edit.from;
  let idx = arg.indexOf(needleEscaped);
  let needleLen = needleEscaped.length;
  if (idx < 0) {
    idx = arg.indexOf(needleRaw);
    needleLen = needleRaw.length;
  }
  if (idx < 0) return null;

  const newArg = arg.slice(0, idx) + toSourceText(edit.to) + arg.slice(idx + needleLen);
  return source.slice(0, start) + newArg + source.slice(end);
}

/**
 * Apply a set of text edits to one page's source. Each edit is scoped to its own
 * element, so edits never interfere with one another. Edits that can't be matched
 * are reported in `failed` and leave the source unchanged.
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
