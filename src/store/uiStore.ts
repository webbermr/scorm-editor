// Transient editor UI state — kept separate from the course document.

import { create } from 'zustand';

export type Mode = 'edit' | 'preview';
export type ModalKind = 'add' | 'replace' | 'export' | 'settings' | 'original' | null;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export interface UiStore {
  imported: boolean;
  selectedSlideId: string | null;
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
  selectedBlockId: null,
  mode: 'edit',
  inspectorOpen: false,
  modal: null,
  replaceTargetBlockId: null,
  previewIndex: 0,
  toast: null,

  setImported: (imported) => set({ imported }),
  selectSlide: (selectedSlideId) => set({ selectedSlideId, selectedBlockId: null }),
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
      selectedBlockId: null,
      mode: 'edit',
      modal: null,
      replaceTargetBlockId: null,
      previewIndex: 0,
      toast: null,
    }),
}));
