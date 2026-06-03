import type { CompletionRule, SlideTypeDef } from '@/types/course';

export const COMPLETION_RULES: CompletionRule[] = [
  { id: 'completed-passed', label: 'Completed + Passed', desc: 'Learner must view all slides and pass the quiz.' },
  { id: 'passed', label: 'Passed only', desc: 'Completion is granted on reaching the passing score.' },
  { id: 'completed', label: 'Completed only', desc: 'Completion is granted on viewing all content.' },
  { id: 'visited', label: 'Visited', desc: 'Marked complete on first launch.' },
];

export const SLIDE_TYPES: SlideTypeDef[] = [
  { id: 'content', label: 'Content', desc: 'Text, images & callouts' },
  { id: 'video', label: 'Video', desc: 'Embedded media clip' },
  { id: 'quiz', label: 'Quiz', desc: 'Graded questions' },
  { id: 'branching', label: 'Scenario', desc: 'Branching decision' },
  { id: 'title', label: 'Title', desc: 'Section opener' },
];
