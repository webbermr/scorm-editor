// Holds the imported package so the original course/pages can be rendered in an
// iframe on demand (the "View Original" feature). The package is mounted into the
// file-server cache lazily the first time the user views an original page.

import { create } from 'zustand';
import { makeId } from '@/lib/id';
import { mountPackage, supportsPreview } from '@/scorm/preview/fileServer';

interface PreviewState {
  /** the imported .zip, kept so we can serve its original files */
  file: File | null;
  id: string;
  /** package-relative path of the course launcher (SCO entry) */
  launchHref: string | null;
  /** original page paths (sourceHrefs) at import, to detect what the editor removed */
  importedPages: string[];
  base: string | null; // /scorm-fs/<id>/ once mounted
  mounting: Promise<string | null> | null;

  supported: boolean;

  setPackage: (file: File, launchHref: string | null, importedPages?: string[]) => void;
  clear: () => void;
  /** Ensure the package is mounted; returns the base path or null if unavailable. */
  ensureMounted: () => Promise<string | null>;
}

export const usePreview = create<PreviewState>((set, get) => ({
  file: null,
  id: makeId(),
  launchHref: null,
  importedPages: [],
  base: null,
  mounting: null,
  supported: supportsPreview(),

  setPackage: (file, launchHref, importedPages = []) => set({ file, launchHref, importedPages, id: makeId(), base: null, mounting: null }),
  clear: () => set({ file: null, launchHref: null, importedPages: [], base: null, mounting: null }),

  ensureMounted: () => {
    const { file, id, base, mounting, supported } = get();
    if (!file || !supported) return Promise.resolve(null);
    if (base) return Promise.resolve(base);
    if (mounting) return mounting;
    const p = mountPackage(file, id)
      .then((b) => {
        set({ base: b });
        return b;
      })
      .catch(() => null);
    set({ mounting: p });
    return p;
  },
}));
