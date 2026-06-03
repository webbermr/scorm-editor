// Local draft persistence so a page refresh doesn't lose work.
//   - the course document (JSON)            -> localStorage
//   - the imported .zip package (binary)    -> IndexedDB
//   - image object-URLs (don't survive a reload) are re-created from the package
//
// Autosave runs (debounced) on every course/selection change once a course is loaded.

import JSZip from 'jszip';
import { useCourse } from './courseStore';
import { useUi } from './uiStore';
import { usePreview } from './previewStore';
import type { Course } from '@/types/course';

const LS_KEY = 'scorm-editor.draft.v1';
const DB_NAME = 'scorm-editor';
const STORE = 'drafts';
const PKG_KEY = 'package';

interface DraftMeta {
  v: number;
  course: Course;
  selectedSlideId: string | null;
  launchHref: string | null;
  importedPages: string[];
  hasPackage: boolean;
  savedAt: number;
}

// ---- IndexedDB (stores the File/Blob directly via structured clone) ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result as T | undefined);
    rq.onerror = () => reject(rq.error);
  });
  db.close();
  return out;
}
async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

// ---- save / read / clear ----

function readMeta(): DraftMeta | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? (JSON.parse(s) as DraftMeta) : null;
  } catch {
    return null;
  }
}

/** Persist the current course + session metadata to localStorage (synchronous). */
export function flushDraft(): void {
  const ui = useUi.getState();
  if (!ui.imported) return;
  const pv = usePreview.getState();
  const meta: DraftMeta = {
    v: 1,
    course: useCourse.getState().course,
    selectedSlideId: ui.selectedSlideId,
    launchHref: pv.launchHref,
    importedPages: pv.importedPages,
    hasPackage: !!pv.file,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(meta));
  } catch {
    /* quota exceeded — give up silently */
  }
}

/** Store (or clear) the imported package binary in IndexedDB. */
export async function saveDraftPackage(file: File | null): Promise<void> {
  try {
    if (file) await idbPut(PKG_KEY, file);
    else await idbDel(PKG_KEY);
  } catch {
    /* IndexedDB unavailable — preview/export won't survive reload, edits still do */
  }
}

export async function clearDraft(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  await idbDel(PKG_KEY);
}

// ---- restore ----

/** Re-create image object-URLs from the package for blocks that stored an asset path. */
async function reresolveImages(course: Course, file: File): Promise<Course> {
  const needs = course.slides.some((s) => s.blocks?.some((b) => b.type === 'image' && b.assetPath));
  if (!needs) return course;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return course;
  }
  const cache = new Map<string, string | undefined>();
  const get = async (path: string) => {
    if (cache.has(path)) return cache.get(path);
    const f = zip.file(path);
    const url = f ? URL.createObjectURL(await f.async('blob')) : undefined;
    cache.set(path, url);
    return url;
  };
  const slides = await Promise.all(
    course.slides.map(async (s) => {
      if (!s.blocks) return s;
      const blocks = await Promise.all(
        s.blocks.map(async (b) => {
          if (b.type === 'image' && b.assetPath) {
            const url = await get(b.assetPath);
            return url ? { ...b, url } : b;
          }
          return b;
        }),
      );
      return { ...s, blocks };
    }),
  );
  return { ...course, slides };
}

/** Synchronously bring back the editor from the saved draft (before first render).
 *  Returns true if a draft was restored. Image URLs are cleared until reresolved. */
export function restoreDraftSync(): boolean {
  const d = readMeta();
  if (!d?.course?.slides?.length) return false;
  // dead object-URLs won't load — clear them so a placeholder shows until reresolve
  const course: Course = {
    ...d.course,
    slides: d.course.slides.map((s) =>
      s.blocks ? { ...s, blocks: s.blocks.map((b) => (b.type === 'image' && b.assetPath ? { ...b, url: undefined } : b)) } : s,
    ),
  };
  useCourse.getState().load(course);
  useUi.getState().setImported(true);
  if (d.selectedSlideId) useUi.getState().selectSlide(d.selectedSlideId);
  return true;
}

/** Restore the imported package (for LMS Preview / export) and re-create image URLs. */
export async function restoreDraftAsync(): Promise<void> {
  const d = readMeta();
  if (!d?.course || !d.hasPackage) return;
  const file = await idbGet<File>(PKG_KEY);
  if (!file) return;
  usePreview.getState().setPackage(file, d.launchHref ?? null, d.importedPages ?? []);
  const patched = await reresolveImages(useCourse.getState().course, file);
  if (patched !== useCourse.getState().course) {
    const sel = useUi.getState().selectedSlideId;
    useCourse.getState().load(patched);
    if (sel) useUi.getState().selectSlide(sel);
  }
}

// ---- autosave wiring ----

let timer: ReturnType<typeof setTimeout> | null = null;
const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushDraft, 600);
};

export function setupDraftAutosave(): void {
  useCourse.subscribe(schedule);
  useUi.subscribe((s, p) => {
    if (s.selectedSlideId !== p.selectedSlideId || s.imported !== p.imported) schedule();
  });
}
