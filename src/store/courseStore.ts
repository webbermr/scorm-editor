// The course document store. ONE nested document; every mutation goes through
// the history-wrapped `commit` so undo/redo works across all edits.

import { create } from 'zustand';
import { makeId } from '@/lib/id';
import { SLIDE_TYPES } from '@/data/reference';
import type { Block, BlockType, Course, Slide, SlideType } from '@/types/course';

const HISTORY_CAP = 40;

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// ---- templates (ported from the prototype's addSlide / addBlock) ----

function slideTemplate(type: SlideType): Partial<Slide> {
  switch (type) {
    case 'content':
      return {
        blocks: [
          { id: makeId(), type: 'heading', text: 'New section' },
          { id: makeId(), type: 'paragraph', text: 'Add your content here.' },
        ],
      };
    case 'title':
      return {
        blocks: [
          { id: makeId(), type: 'eyebrow', text: 'SECTION' },
          { id: makeId(), type: 'heading', text: 'Section title' },
        ],
      };
    case 'video':
      return {
        blocks: [
          { id: makeId(), type: 'heading', text: 'Video lesson' },
          { id: makeId(), type: 'video', poster: 'video', length: '0:00', title: 'New clip', required: true },
        ],
      };
    case 'quiz':
      return {
        quiz: {
          prompt: 'New quiz',
          instruction: 'Choose the correct answer.',
          kind: 'single',
          shuffle: false,
          feedback: true,
          questions: [
            {
              id: makeId(),
              text: 'Your question?',
              options: [
                { id: makeId(), text: 'Option A', correct: true },
                { id: makeId(), text: 'Option B', correct: false },
              ],
            },
          ],
        },
      };
    case 'branching':
      return {
        scenario: {
          setup: 'Describe the situation the learner faces…',
          choices: [
            { id: makeId(), text: 'First choice', outcome: 'correct', result: 'Why this is the right move.' },
            { id: makeId(), text: 'Second choice', outcome: 'incorrect', result: 'Why this is risky.' },
          ],
        },
      };
  }
}

function blockTemplate(type: Exclude<BlockType, 'video' | 'rawHtml'>): Block {
  const id = makeId();
  switch (type) {
    case 'heading':
      return { id, type: 'heading', text: 'New heading' };
    case 'paragraph':
      return { id, type: 'paragraph', text: 'New paragraph of body text.' };
    case 'eyebrow':
      return { id, type: 'eyebrow', text: 'EYEBROW' };
    case 'list':
      return { id, type: 'list', items: ['First point', 'Second point'] };
    case 'image':
      return { id, type: 'image', src: 'generic', caption: 'Caption' };
    case 'callout':
      return { id, type: 'callout', tone: 'info', title: 'Note', text: 'Something worth highlighting.' };
  }
}

export interface CourseStore {
  course: Course;
  past: Course[];
  future: Course[];
  dirty: boolean;

  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Replace the document and reset history (used by import / sample load). */
  load: (course: Course) => void;
  /** History-aware mutation. */
  commit: (updater: (c: Course) => Course) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;

  patchMeta: (patch: Partial<Course['meta']>) => void;
  patchSlide: (slideId: string, patch: Partial<Slide>) => void;
  patchBlock: (slideId: string, blockId: string, patch: Partial<Block>) => void;

  /** Record an in-place text edit on an imported page element (Lectora etc.),
   *  keyed by element id (globally unique). Re-editing the same element updates the
   *  entry; setting `to` back to the original `from` clears it. */
  setTextEdit: (elementId: string, from: string, to: string) => void;

  /** Insert a new slide of `type` after `afterId`; returns the new slide id. */
  addSlideAfter: (type: SlideType, afterId: string) => string;
  /** Returns the id that should be selected next, or null if deletion was blocked (last slide). */
  deleteSlide: (slideId: string) => string | null;
  /** Returns the new slide id. */
  duplicateSlide: (slideId: string) => string;
  reorder: (from: number, to: number) => void;

  /** Append a block to a content/title/video slide; returns the new block id. */
  addBlock: (slideId: string, type: Exclude<BlockType, 'video' | 'rawHtml'>) => string;
  deleteBlock: (slideId: string, blockId: string) => void;
}

export const useCourse = create<CourseStore>((set, get) => ({
  course: { meta: {} as Course['meta'], slides: [] },
  past: [],
  future: [],
  dirty: false,

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  load: (course) => set({ course: clone(course), past: [], future: [], dirty: false }),

  commit: (updater) =>
    set((s) => ({
      course: updater(s.course),
      past: [...s.past.slice(-HISTORY_CAP), s.course],
      future: [],
      dirty: true,
    })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { course: prev, past: s.past.slice(0, -1), future: [s.course, ...s.future] };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { course: next, past: [...s.past, s.course], future: s.future.slice(1) };
    }),

  markSaved: () => set({ dirty: false }),

  patchMeta: (patch) => get().commit((c) => ({ ...c, meta: { ...c.meta, ...patch } })),

  patchSlide: (slideId, patch) =>
    get().commit((c) => ({
      ...c,
      slides: c.slides.map((s) => (s.id === slideId ? ({ ...s, ...patch } as Slide) : s)),
    })),

  patchBlock: (slideId, blockId, patch) =>
    get().commit((c) => ({
      ...c,
      slides: c.slides.map((s) =>
        s.id === slideId
          ? { ...s, blocks: s.blocks?.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)) }
          : s,
      ),
    })),

  setTextEdit: (elementId, from, to) =>
    get().commit((c) => {
      const others = (c.textEdits ?? []).filter((e) => e.elementId !== elementId);
      // dropping the edit (text returned to original) → remove the entry
      const next = to.trim() === from.trim() ? others : [...others, { elementId, from, to }];
      return { ...c, textEdits: next.length ? next : undefined };
    }),

  addSlideAfter: (type, afterId) => {
    const label = SLIDE_TYPES.find((x) => x.id === type)?.label ?? 'New';
    const ns: Slide = {
      id: makeId(),
      type,
      name: `${label} slide`,
      status: 'not-started',
      duration: '2 min',
      ...slideTemplate(type),
    };
    get().commit((c) => {
      const idx = c.slides.findIndex((s) => s.id === afterId);
      const arr = [...c.slides];
      arr.splice(idx < 0 ? arr.length : idx + 1, 0, ns);
      return { ...c, slides: arr };
    });
    return ns.id;
  },

  deleteSlide: (slideId) => {
    const slides = get().course.slides;
    if (slides.length <= 1) return null;
    const idx = slides.findIndex((s) => s.id === slideId);
    const nextSelect = slides[Math.max(0, idx - 1)].id;
    get().commit((c) => ({ ...c, slides: c.slides.filter((s) => s.id !== slideId) }));
    return nextSelect;
  },

  duplicateSlide: (slideId) => {
    const src = get().course.slides.find((s) => s.id === slideId)!;
    const copy = clone(src);
    copy.id = makeId();
    copy.name = `${src.name} (copy)`;
    copy.status = 'not-started';
    get().commit((c) => {
      const idx = c.slides.findIndex((s) => s.id === slideId);
      const arr = [...c.slides];
      arr.splice(idx + 1, 0, copy);
      return { ...c, slides: arr };
    });
    return copy.id;
  },

  reorder: (from, to) =>
    get().commit((c) => {
      const arr = [...c.slides];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return { ...c, slides: arr };
    }),

  addBlock: (slideId, type) => {
    const blk = blockTemplate(type);
    get().commit((c) => ({
      ...c,
      slides: c.slides.map((s) => (s.id === slideId ? { ...s, blocks: [...(s.blocks ?? []), blk] } : s)),
    }));
    return blk.id;
  },

  deleteBlock: (slideId, blockId) =>
    get().commit((c) => ({
      ...c,
      slides: c.slides.map((s) =>
        s.id === slideId ? { ...s, blocks: s.blocks?.filter((b) => b.id !== blockId) } : s,
      ),
    })),
}));
