// Global keyboard shortcuts: ⌘/Ctrl+Z / ⇧+Z undo-redo, ⌘/Ctrl+S save,
// ←/→ to navigate slides in Preview, Delete/Esc on ticked slides.

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

      // Ticked slides: Delete/Backspace removes them, Esc unticks them. Only acts on
      // ticked slides, so a stray Backspace never drops the slide being edited.
      if ((e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Escape') && ui.mode === 'edit' && !ui.modal && !isEditableTarget(e.target)) {
        const ids = course.course.slides.filter((s) => ui.checkedSlideIds.includes(s.id)).map((s) => s.id);
        if (ids.length) {
          e.preventDefault();
          if (e.key === 'Escape') {
            ui.setCheckedSlides([]);
            return;
          }
          const next = course.deleteSlides(ids);
          if (next === null) ui.flash('Can’t delete every slide');
          else {
            if (ids.includes(ui.selectedSlideId ?? '')) ui.selectSlide(next);
            ui.setCheckedSlides([]);
            ui.flash(ids.length === 1 ? 'Slide deleted' : `${ids.length} slides deleted`);
          }
          return;
        }
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
