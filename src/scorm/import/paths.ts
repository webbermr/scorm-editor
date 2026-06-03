// Tiny POSIX-style path helpers for zip-internal paths (always '/'-separated).

export const dirname = (p: string): string => {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
};

export const normalize = (p: string): string => {
  const segs = p.split('/');
  const out: string[] = [];
  for (const s of segs) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
};

export const join = (base: string, rel: string): string => {
  if (rel.startsWith('/')) return normalize(rel);
  return normalize(base ? `${base}/${rel}` : rel);
};

export const IMAGE_RE = /\.(png|jpe?g|gif|svg|webp|bmp|avif|ico)$/i;
export const VIDEO_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;
export const HTML_RE = /\.(html?|xhtml)$/i;
