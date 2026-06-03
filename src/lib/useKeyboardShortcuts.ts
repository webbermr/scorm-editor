// Global keyboard shortcuts: ⌘/Ctrl+Z / ⇧+Z undo-redo, ⌘/Ctrl+S save,
// ←/→ to navigate slides in Preview. (Esc-to-close is handled per-modal.)

import { useEffect } from 'react';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const course = useCourse.getState();
      const ui = useUi.getState();

      // Save — always
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        course.markSaved();
        ui.flash('Saved to draft');
        return;
      }

      // Undo / redo — but not while typing into a field
      if (mod && e.key.toLowerCase() === 'z' && !isEditableTarget(e.target)) {
        e.preventDefault();
        if (e.shiftKey) course.redo();
        else course.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y' && !isEditableTarget(e.target)) {
        e.preventDefault();
        course.redo();
        return;
      }

      // Preview navigation with arrow keys
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ui.mode === 'preview' && !isEditableTarget(e.target)) {
        const slides = course.course.slides;
        const cur = Math.max(0, slides.findIndex((s) => s.id === ui.selectedSlideId));
        const next = e.key === 'ArrowRight' ? Math.min(slides.length - 1, cur + 1) : Math.max(0, cur - 1);
        if (next !== cur && slides[next]) {
          e.preventDefault();
          ui.setPreviewIndex(next);
          ui.selectSlide(slides[next].id);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
