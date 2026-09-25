import type { OverlayChanges } from '@/types/course';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Toast suffix describing what a text edit did to the links laid over the text. */
export function overlayNote(o?: OverlayChanges): string {
  const parts: string[] = [];
  const moved = Object.keys(o?.moveObjects ?? {}).length;
  const hidden = o?.hideObjects?.length ?? 0;
  if (moved) parts.push(`${plural(moved, 'link')} moved with ${moved === 1 ? 'its' : 'their'} words`);
  if (hidden) parts.push(`${plural(hidden, 'link')} on removed text disabled`);
  return parts.length ? ` · ${parts.join(', ')}` : '';
}
