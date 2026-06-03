import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/Icon';
import { TYPE_META, STATUS_META } from '@/lib/typeMeta';
import type { Slide } from '@/types/course';

interface Props {
  slide: Slide;
  index: number;
  selected: boolean;
  dropBefore: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function SlideCard({ slide, index, selected, dropBefore, onSelect, onDelete, onDuplicate }: Props) {
  const meta = TYPE_META[slide.type];
  const st = STATUS_META[slide.status];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });

  return (
    <div
      ref={setNodeRef}
      className="slide-card"
      onClick={() => onSelect(slide.id)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        display: 'flex',
        gap: 11,
        padding: '10px 10px 10px 8px',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        border: '1.5px solid ' + (selected ? 'var(--accent)' : 'transparent'),
        background: selected ? 'var(--surface)' : 'transparent',
        boxShadow: selected ? 'var(--sh-sm)' : 'none',
        opacity: isDragging ? 0.4 : 1,
        outline: dropBefore ? '2px solid var(--accent)' : 'none',
        outlineOffset: 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* drag handle + number */}
      <div
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 2 }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      {/* thumbnail */}
      <div style={{ flexShrink: 0, width: 46, height: 34, borderRadius: 8, background: meta.soft, color: meta.color, display: 'grid', placeItems: 'center' }}>
        <Icon name={slide.type} size={19} />
      </div>
      {/* text */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slide.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: st.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{slide.type}</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· {slide.duration}</span>
        </div>
      </div>
      {/* hover actions */}
      <div
        className="card-actions"
        style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0, transition: 'opacity .14s' }}
      >
        <button
          className="mini-act tip"
          data-tip="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(slide.id);
          }}
        >
          <Icon name="copy" size={13} />
        </button>
        <button
          className="mini-act tip"
          data-tip="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(slide.id);
          }}
          style={{ color: 'var(--rose)' }}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}
