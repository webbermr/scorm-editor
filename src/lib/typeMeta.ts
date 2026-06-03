// Shared type/status → color maps (ported from the prototype's navigator.jsx).

import type { SlideStatus, SlideType } from '@/types/course';

export const TYPE_META: Record<SlideType, { color: string; soft: string }> = {
  content: { color: 'var(--blue)', soft: 'var(--blue-soft)' },
  video: { color: 'var(--rose)', soft: 'var(--rose-soft)' },
  quiz: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  branching: { color: 'var(--amber)', soft: 'var(--amber-soft)' },
  title: { color: 'var(--green)', soft: 'var(--green-soft)' },
};

export const STATUS_META: Record<SlideStatus, { color: string; label: string }> = {
  complete: { color: 'var(--green)', label: 'Complete' },
  'in-progress': { color: 'var(--amber)', label: 'In progress' },
  'not-started': { color: 'var(--line-strong)', label: 'Not started' },
};
