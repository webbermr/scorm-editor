// Orchestration layer: combines the pure course mutations with UI side-effects
// (selection, toasts, modal close) so components call one intent-named action.

import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { flushDraft } from '@/store/draft';
import type { BlockType, SlideType } from '@/types/course';

export function useEditorActions() {
  const course = useCourse();
  const ui = useUi();

  const currentSlideId = () => ui.selectedSlideId ?? course.course.slides[0]?.id ?? '';

  const deleteSlide = (id: string) => {
    const next = course.deleteSlide(id);
    if (next === null) {
      ui.flash('Can’t delete the last slide');
      return;
    }
    if (id === ui.selectedSlideId) ui.selectSlide(next);
    ui.setCheckedSlides(ui.checkedSlideIds.filter((x) => x !== id));
    ui.flash('Slide deleted');
  };

  return {
    addSlide: (type: SlideType) => {
      const id = course.addSlideAfter(type, currentSlideId());
      ui.selectSlide(id);
      ui.setModal(null);
      // keep preview player in sync if we add while previewing
      const idx = useCourse.getState().course.slides.findIndex((s) => s.id === id);
      if (ui.mode === 'preview' && idx >= 0) ui.setPreviewIndex(idx);
      ui.flash('Slide added');
    },

    deleteSlide,

    deleteSlides: (ids: string[]) => {
      if (ids.length <= 1) {
        if (ids[0]) deleteSlide(ids[0]);
        return;
      }
      const next = course.deleteSlides(ids);
      if (next === null) {
        ui.flash('Can’t delete every slide');
        return;
      }
      if (ids.includes(ui.selectedSlideId ?? '')) ui.selectSlide(next);
      ui.setCheckedSlides([]);
      ui.flash(`${ids.length} slides deleted`);
    },

    duplicateSlide: (id: string) => {
      const nid = course.duplicateSlide(id);
      ui.selectSlide(nid);
      ui.flash('Slide duplicated');
    },

    addBlock: (type: Exclude<BlockType, 'video' | 'rawHtml'>) => {
      const sid = currentSlideId();
      const bid = course.addBlock(sid, type);
      ui.selectBlock(bid);
      ui.flash('Block added');
    },

    deleteBlock: (blockId: string) => {
      course.deleteBlock(currentSlideId(), blockId);
      ui.selectBlock(null);
    },

    save: () => {
      flushDraft();
      course.markSaved();
      ui.flash('Saved to this browser');
    },
  };
}
