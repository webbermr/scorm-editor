import { useState } from 'react';
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

export function Navigator() {
  const slides = useCourse((s) => s.course.slides);
  const reorder = useCourse((s) => s.reorder);
  const selectedId = useUi((s) => s.selectedSlideId);
  const selectSlide = useUi((s) => s.selectSlide);
  const setModal = useUi((s) => s.setModal);
  const { deleteSlide, duplicateSlide } = useEditorActions();

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
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {slides.map((slide, i) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  index={i}
                  selected={slide.id === selectedId}
                  dropBefore={overId === slide.id && activeId !== null && activeId !== slide.id}
                  onSelect={selectSlide}
                  onDelete={deleteSlide}
                  onDuplicate={duplicateSlide}
                />
              ))}
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
