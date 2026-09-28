// Transient editor UI state — kept separate from the course document.

import { create } from 'zustand';

export type Mode = 'edit' | 'preview';
export type ModalKind = 'add' | 'replace' | 'export' | 'settings' | 'original' | null;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export interface UiStore {
  imported: boolean;
  selectedSlideId: string | null;
  /** slides ticked in the navigator for bulk actions — independent of the slide being edited */
  checkedSlideIds: string[];
  /** where a ⇧-click range starts: the slide last clicked or ticked */
  checkAnchorId: string | null;
  selectedBlockId: string | null;
  mode: Mode;
  inspectorOpen: boolean;
  modal: ModalKind;
  /** page the full-screen LMS Preview opens on (null: the course's launcher) */
  originalHref: string | null;
  /** block id currently targeted by the Replace-image modal */
  replaceTargetBlockId: string | null;
  previewIndex: number;
  toast: string | null;

  setImported: (v: boolean) => void;
  selectSlide: (id: string) => void;
  /** checkbox / ⌘-click: tick or untick one slide */
  toggleSlideCheck: (id: string) => void;
  /** ⇧-click: also tick every slide between the last clicked/ticked slide and `id` (in `order`) */
  checkSlideRange: (id: string, order: string[]) => void;
  setCheckedSlides: (ids: string[]) => void;
  selectBlock: (id: string | null) => void;
  setMode: (m: Mode) => void;
  setInspectorOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setModal: (m: ModalKind) => void;
  openReplace: (blockId: string) => void;
  /** full-screen LMS Preview, starting on `href` (default: the course's launcher) */
  openOriginal: (href?: string | null) => void;
  setPreviewIndex: (i: number) => void;
  flash: (msg: string) => void;
  /** return to the import screen for a fresh start */
  reset: () => void;
}

export const useUi = create<UiStore>((set) => ({
  imported: false,
  selectedSlideId: null,
  checkedSlideIds: [],
  checkAnchorId: null,
  selectedBlockId: null,
  mode: 'edit',
  inspectorOpen: false,
  modal: null,
  originalHref: null,
  replaceTargetBlockId: null,
  previewIndex: 0,
  toast: null,

  setImported: (imported) => set({ imported }),
  selectSlide: (selectedSlideId) => set({ selectedSlideId, selectedBlockId: null, checkAnchorId: selectedSlideId }),
  toggleSlideCheck: (id) =>
    set((s) => ({
      checkedSlideIds: s.checkedSlideIds.includes(id) ? s.checkedSlideIds.filter((x) => x !== id) : [...s.checkedSlideIds, id],
      checkAnchorId: id,
    })),
  checkSlideRange: (id, order) =>
    set((s) => {
      const b = order.indexOf(id);
      if (b < 0) return s;
      // from the last clicked/ticked slide (else the open one); a vanished anchor
      // (deleted, undone) just ticks the clicked slide
      const a = order.indexOf(s.checkAnchorId ?? s.selectedSlideId ?? id);
      const range = a < 0 ? [id] : order.slice(Math.min(a, b), Math.max(a, b) + 1);
      return { checkedSlideIds: [...new Set([...s.checkedSlideIds, ...range])], checkAnchorId: id };
    }),
  setCheckedSlides: (checkedSlideIds) => set({ checkedSlideIds }),
  selectBlock: (selectedBlockId) => set({ selectedBlockId }),
  setMode: (mode) => set({ mode }),
  setInspectorOpen: (v) => set((s) => ({ inspectorOpen: typeof v === 'function' ? v(s.inspectorOpen) : v })),
  setModal: (modal) => set({ modal }),
  openReplace: (replaceTargetBlockId) => set({ modal: 'replace', replaceTargetBlockId }),
  openOriginal: (originalHref = null) => set({ modal: 'original', originalHref }),
  setPreviewIndex: (previewIndex) => set({ previewIndex }),
  flash: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 1900);
  },
  reset: () =>
    set({
      imported: false,
      selectedSlideId: null,
      checkedSlideIds: [],
      checkAnchorId: null,
      selectedBlockId: null,
      mode: 'edit',
      modal: null,
      replaceTargetBlockId: null,
      previewIndex: 0,
      toast: null,
    }),
}));
