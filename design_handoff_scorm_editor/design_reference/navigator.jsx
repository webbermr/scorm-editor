// Left rail — slide navigator with drag-to-reorder, status, hover actions.

const TYPE_META = {
  content: { color: 'var(--blue)', soft: 'var(--blue-soft)' },
  video: { color: 'var(--rose)', soft: 'var(--rose-soft)' },
  quiz: { color: 'var(--accent)', soft: 'var(--accent-soft)' },
  branching: { color: 'var(--amber)', soft: 'var(--amber-soft)' },
  title: { color: 'var(--green)', soft: 'var(--green-soft)' },
};
const STATUS_META = {
  complete: { color: 'var(--green)', label: 'Complete' },
  'in-progress': { color: 'var(--amber)', label: 'In progress' },
  'not-started': { color: 'var(--line-strong)', label: 'Not started' },
};

function SlideCard({ slide, index, selected, onSelect, onDelete, onDuplicate, dragProps, dragging, dropBefore }) {
  const meta = TYPE_META[slide.type];
  const st = STATUS_META[slide.status];
  return (
    <div
      {...dragProps}
      onClick={() => onSelect(slide.id)}
      style={{
        position: 'relative', display: 'flex', gap: 11, padding: '10px 10px 10px 8px', borderRadius: 'var(--r-md)',
        cursor: 'pointer', border: '1.5px solid ' + (selected ? 'var(--accent)' : 'transparent'),
        background: selected ? 'var(--surface)' : 'transparent', boxShadow: selected ? 'var(--sh-sm)' : 'none',
        opacity: dragging ? 0.4 : 1, transition: 'background .14s, border-color .14s',
        outline: dropBefore ? '2px solid var(--accent)' : 'none', outlineOffset: 1,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* drag handle + number */}
      <div className="drag-handle" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 2 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}>{String(index + 1).padStart(2, '0')}</span>
      </div>
      {/* thumbnail */}
      <div style={{ flexShrink: 0, width: 46, height: 34, borderRadius: 8, background: meta.soft, color: meta.color, display: 'grid', placeItems: 'center' }}>
        <Icon name={slide.type} size={19} />
      </div>
      {/* text */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slide.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: st.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{slide.type}</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>· {slide.duration}</span>
        </div>
      </div>
      {/* hover actions */}
      <div className="card-actions" style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0, transition: 'opacity .14s' }}>
        <button className="mini-act tip" data-tip="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(slide.id); }}><Icon name="copy" size={13} /></button>
        <button className="mini-act tip" data-tip="Delete" onClick={(e) => { e.stopPropagation(); onDelete(slide.id); }} style={{ color: 'var(--rose)' }}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  );
}

function Navigator({ course, selectedId, onSelect, onReorder, onDelete, onDuplicate, onAdd }) {
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  const slides = course.slides;

  const onDrop = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) onReorder(dragIdx, overIdx);
    setDragIdx(null); setOverIdx(null);
  };

  const completed = slides.filter((s) => s.status === 'complete').length;

  return (
    <aside style={{ width: 'var(--rail-w)', flexShrink: 0, background: 'var(--surface-2)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em' }}>Slides</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{slides.length} items · {completed} done</div>
        </div>
        <button className="btn btn-sm btn-soft tip" data-tip="Add slide" onClick={onAdd}><Icon name="plus" size={15} /> Add</button>
      </div>

      {/* progress bar */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completed / slides.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--green))', borderRadius: 99, transition: 'width .3s' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {slides.map((slide, i) => (
          <SlideCard
            key={slide.id} slide={slide} index={i} selected={slide.id === selectedId}
            onSelect={onSelect} onDelete={onDelete} onDuplicate={onDuplicate}
            dragging={dragIdx === i} dropBefore={overIdx === i && dragIdx !== null && dragIdx !== i}
            dragProps={{
              draggable: true,
              onDragStart: () => setDragIdx(i),
              onDragOver: (e) => { e.preventDefault(); setOverIdx(i); },
              onDragEnd: onDrop,
              onDrop,
            }}
          />
        ))}
        <button onClick={onAdd}
          style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--line-strong)', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600, transition: 'all .15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line-strong)'; e.currentTarget.style.color = 'var(--ink-3)'; }}>
          <Icon name="plus" size={16} /> Add slide
        </button>
      </div>
    </aside>
  );
}

Object.assign(window, { Navigator, TYPE_META, STATUS_META });
