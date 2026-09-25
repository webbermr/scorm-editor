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
  selectedBlockId: string | null;
  mode: Mode;
  inspectorOpen: boolean;
  modal: ModalKind;
  /** block id currently targeted by the Replace-image modal */
  replaceTargetBlockId: string | null;
  previewIndex: number;
  toast: string | null;

  setImported: (v: boolean) => void;
  selectSlide: (id: string) => void;
  /** checkbox / ⌘-click: tick or untick one slide */
  toggleSlideCheck: (id: string) => void;
  /** ⇧-click: tick every slide between the current slide and `id` (in `order`) */
  checkSlideRange: (id: string, order: string[]) => void;
  setCheckedSlides: (ids: string[]) => void;
  selectBlock: (id: string | null) => void;
  setMode: (m: Mode) => void;
  setInspectorOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setModal: (m: ModalKind) => void;
  openReplace: (blockId: string) => void;
  setPreviewIndex: (i: number) => void;
  flash: (msg: string) => void;
  /** return to the import screen for a fresh start */
  reset: () => void;
}

export const useUi = create<UiStore>((set) => ({
  imported: false,
  selectedSlideId: null,
  checkedSlideIds: [],
  selectedBlockId: null,
  mode: 'edit',
  inspectorOpen: false,
  modal: null,
  replaceTargetBlockId: null,
  previewIndex: 0,
  toast: null,

  setImported: (imported) => set({ imported }),
  selectSlide: (selectedSlideId) => set({ selectedSlideId, selectedBlockId: null }),
  toggleSlideCheck: (id) =>
    set((s) => ({
      checkedSlideIds: s.checkedSlideIds.includes(id) ? s.checkedSlideIds.filter((x) => x !== id) : [...s.checkedSlideIds, id],
    })),
  checkSlideRange: (id, order) =>
    set((s) => {
      const a = order.indexOf(s.selectedSlideId ?? id);
      const b = order.indexOf(id);
      if (b < 0) return s;
      if (a < 0) return { checkedSlideIds: [id] };
      return { checkedSlideIds: order.slice(Math.min(a, b), Math.max(a, b) + 1) };
    }),
  setCheckedSlides: (checkedSlideIds) => set({ checkedSlideIds }),
  selectBlock: (selectedBlockId) => set({ selectedBlockId }),
  setMode: (mode) => set({ mode }),
  setInspectorOpen: (v) => set((s) => ({ inspectorOpen: typeof v === 'function' ? v(s.inspectorOpen) : v })),
  setModal: (modal) => set({ modal }),
  openReplace: (replaceTargetBlockId) => set({ modal: 'replace', replaceTargetBlockId }),
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
      selectedBlockId: null,
      mode: 'edit',
      modal: null,
      replaceTargetBlockId: null,
      previewIndex: 0,
      toast: null,
    }),
}));
