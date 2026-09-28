import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Icon } from '@/components/Icon';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { useEditorActions } from '@/lib/useEditorActions';
import { SlideCard } from './SlideCard';
import { SectionHeader } from './SectionHeader';
import type { Slide } from '@/types/course';

const OTHER = 'Other pages';

export function Navigator() {
  const slides = useCourse((s) => s.course.slides);
  const reorder = useCourse((s) => s.reorder);
  const selectedId = useUi((s) => s.selectedSlideId);
  const checkedIds = useUi((s) => s.checkedSlideIds);
  const selectSlide = useUi((s) => s.selectSlide);
  const toggleSlideCheck = useUi((s) => s.toggleSlideCheck);
  const checkSlideRange = useUi((s) => s.checkSlideRange);
  const setCheckedSlides = useUi((s) => s.setCheckedSlides);
  const setModal = useUi((s) => s.setModal);
  const { deleteSlide, deleteSlides, duplicateSlide } = useEditorActions();

  // Course sections (from the course's table of contents): consecutive slides of
  // the same section form one group. Courses without sections show a flat list.
  const hasSections = slides.some((s) => s.section);
  const groups: Array<{ key: string; title: string; slides: Array<{ slide: Slide; index: number }> }> = [];
  slides.forEach((slide, index) => {
    const title = hasSections ? (slide.section ?? OTHER) : '';
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.slides.push({ slide, index });
    else {
      // keyed by name (+ which run of it), so collapsing survives deleting other sections
      const run = groups.filter((g) => g.title === title).length;
      groups.push({ key: `${title}#${run}`, title, slides: [{ slide, index }] });
    }
  });
  // sections start collapsed; this holds the ones the user opened
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isCollapsed = (g: { key: string; title: string }) => !!g.title && !expanded.has(g.key);
  const toggleCollapsed = (key: string) =>
    setExpanded((c) => {
      const n = new Set(c);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const sectionGroups = groups.filter((g) => g.title);
  const allExpanded = sectionGroups.length > 0 && sectionGroups.every((g) => expanded.has(g.key));
  const setAllExpanded = (open: boolean) => setExpanded(open ? new Set(sectionGroups.map((g) => g.key)) : new Set());
  const groupOf = (id: string | null) => groups.find((g) => g.slides.some((x) => x.slide.id === id));

  // keep the selected slide in view (e.g. while it follows the course playing in
  // LMS Preview), opening its section if it's collapsed — but not for the slide
  // selected when the course opens, so the list starts with every section closed
  const prevSelected = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelected.current;
    prevSelected.current = selectedId;
    if (!selectedId || !prev || prev === selectedId) return;
    const g = groupOf(selectedId);
    if (g && isCollapsed(g)) toggleCollapsed(g.key);
    requestAnimationFrame(() =>
      document.querySelector(`.slide-card[data-slide-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
    // only when the selection changes
  }, [selectedId]);

  // ignore ids that no longer exist (e.g. after undo/redo)
  const checked = new Set(checkedIds.filter((id) => slides.some((s) => s.id === id)));
  const anyChecked = checked.size > 0;
  const orderedChecked = () => slides.filter((s) => checked.has(s.id)).map((s) => s.id);

  const onSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) checkSlideRange(id, slides.map((s) => s.id));
    else if (e.metaKey || e.ctrlKey) {
      // first ⌘-click also ticks the slide being edited, like extending a selection
      if (!anyChecked && selectedId && selectedId !== id) setCheckedSlides([selectedId, id]);
      else toggleSlideCheck(id);
    } else selectSlide(id);
  };
  // section header: tick all its slides (or untick them when all are ticked), delete it
  const toggleSectionChecked = (ids: string[]) => {
    const allOn = ids.every((id) => checked.has(id));
    setCheckedSlides(allOn ? [...checked].filter((id) => !ids.includes(id)) : [...new Set([...checked, ...ids])]);
  };
  const deleteSection = (title: string, ids: string[]) => {
    if (!window.confirm(`Delete the “${title}” section — all ${ids.length} slide${ids.length === 1 ? '' : 's'} in it? You can undo this.`)) return;
    deleteSlides(ids);
  };

  // a card's trash button removes all ticked slides when that card is ticked
  const onDelete = (id: string) => (checked.has(id) ? deleteSlides(orderedChecked()) : deleteSlide(id));

  const [overId, setOverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const completed = slides.filter((s) => s.status === 'complete').length;
  const pct = slides.length ? (completed / slides.length) * 100 : 0;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setOverId(null);
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) reorder(from, to);
  };

  return (
    <aside
      style={{
        width: 'var(--rail-w)',
        flexShrink: 0,
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em' }}>Slides</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>
            {slides.length} items · {completed} done
          </div>
        </div>
        <button className="btn btn-sm btn-soft tip" data-tip="Add slide" onClick={() => setModal('add')}>
          <Icon name="plus" size={15} /> Add
        </button>
      </div>
      <div className="rail-actions" style={{ padding: '0 16px 10px' }}>
        {sectionGroups.length > 0 && (
          <button className="rail-expand-all" onClick={() => setAllExpanded(!allExpanded)} aria-label={allExpanded ? 'Collapse all sections' : 'Expand all sections'}>
            <Icon name={allExpanded ? 'chevRight' : 'chevDown'} size={12} />
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
        {/* tick every slide (and so every section), or none */}
        <button className="rail-expand-all" onClick={() => setCheckedSlides(slides.map((s) => s.id))} disabled={checked.size === slides.length}>
          <Icon name="check" size={12} />
          Select all
        </button>
        <button className="rail-expand-all" onClick={() => setCheckedSlides([])} disabled={!anyChecked}>
          <Icon name="close" size={12} />
          Deselect all
        </button>
      </div>

      {anyChecked && (
        <div
          role="toolbar"
          aria-label="Selected slides"
          style={{
            margin: '0 10px 10px',
            padding: '6px 6px 6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 'var(--r-md)',
            background: 'var(--accent-soft)',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <span style={{ flex: 1 }}>{checked.size} selected</span>
          {checked.size < slides.length && (
            <button className="btn btn-sm btn-ghost" onClick={() => setCheckedSlides(slides.map((s) => s.id))}>
              All
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => setCheckedSlides([])}>
            Clear
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => deleteSlides(orderedChecked())}>
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      )}

      {/* progress bar */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--green))',
              borderRadius: 99,
              transition: 'width .3s',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setOverId(null);
            setActiveId(null);
          }}
        >
          <SortableContext
            items={groups.filter((g) => !isCollapsed(g)).flatMap((g) => g.slides.map((x) => x.slide.id))}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {groups.map((g) => {
                const ids = g.slides.map((x) => x.slide.id);
                return (
                  <div key={g.key} role={g.title ? 'group' : undefined} aria-label={g.title || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {g.title && (
                      <SectionHeader
                        title={g.title}
                        count={ids.length}
                        checkedCount={ids.filter((id) => checked.has(id)).length}
                        collapsed={isCollapsed(g)}
                        onToggleCollapsed={() => toggleCollapsed(g.key)}
                        onToggleChecked={() => toggleSectionChecked(ids)}
                        onDelete={() => deleteSection(g.title, ids)}
                      />
                    )}
                    {!isCollapsed(g) &&
                      g.slides.map(({ slide, index }) => (
                        <SlideCard
                          key={slide.id}
                          slide={slide}
                          index={index}
                          selected={slide.id === selectedId}
                          checked={checked.has(slide.id)}
                          multi={anyChecked}
                          dropBefore={overId === slide.id && activeId !== null && activeId !== slide.id}
                          onSelect={onSelect}
                          onToggle={(id, e) => (e.shiftKey ? checkSlideRange(id, slides.map((s) => s.id)) : toggleSlideCheck(id))}
                          onDelete={onDelete}
                          onDuplicate={duplicateSlide}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <button
          onClick={() => setModal('add')}
          style={{
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '12px',
            borderRadius: 'var(--r-md)',
            border: '1.5px dashed var(--line-strong)',
            color: 'var(--ink-3)',
            fontSize: 13,
            fontWeight: 600,
            transition: 'all .15s',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--line-strong)';
            e.currentTarget.style.color = 'var(--ink-3)';
          }}
        >
          <Icon name="plus" size={16} /> Add slide
        </button>
      </div>
    </aside>
  );
}
