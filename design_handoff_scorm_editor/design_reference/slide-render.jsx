// Slide rendering — block renderer shared by Edit canvas and LMS Preview,
// plus tasteful gradient image placeholders (course art the user would replace).

function Illustration({ kind, label, onReplace, editing }) {
  const palettes = {
    shield: ['#6d4ee0', '#9b6cff', 'shield'],
    lock: ['#2f9e63', '#5fc98e', 'settings'],
    video: ['#d6504e', '#ff8a6b', 'play'],
    generic: ['#2f7fd9', '#63b3ff', 'image'],
  };
  const [c1, c2, icon] = palettes[kind] || palettes.generic;
  return (
    <div
      className="illus"
      style={{
        position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)',
        overflow: 'hidden', background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'grid', placeItems: 'center', boxShadow: 'var(--sh-sm)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: .5,
        backgroundImage: 'radial-gradient(circle at 18% 22%, rgba(255,255,255,.35), transparent 38%), radial-gradient(circle at 82% 78%, rgba(0,0,0,.18), transparent 42%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: .14,
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 16px)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#fff' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
          <Icon name={icon} size={32} stroke={2} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .85 }}>Image placeholder</span>
      </div>
      {editing && (
        <button
          className="btn btn-sm"
          onClick={(e) => { e.stopPropagation(); onReplace && onReplace(); }}
          style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', boxShadow: 'var(--sh-md)' }}
        >
          <Icon name="image" size={14} /> Replace
        </button>
      )}
    </div>
  );
}

// One editable text node. In preview mode it's plain text.
function EditText({ html, tag = 'div', editing, selected, onSelect, onCommit, style, className = '', placeholder }) {
  const ref = React.useRef(null);
  const Tag = tag;
  const handleBlur = () => { if (onCommit && ref.current) onCommit(ref.current.innerText); };
  return (
    <Tag
      ref={ref}
      className={`${editing ? 'editable' : ''} ${selected ? 'sel' : ''} ${className}`}
      style={style}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={false}
      onMouseDown={editing ? (e) => { e.stopPropagation(); onSelect && onSelect(); } : undefined}
      onBlur={editing ? handleBlur : undefined}
      data-ph={placeholder}
    >
      {html}
    </Tag>
  );
}

function Block({ block, slide, editing, sel, onSelect, onPatch, onReplaceImage }) {
  const is = (id) => sel === id;
  const select = () => onSelect(block.id);

  switch (block.type) {
    case 'eyebrow':
      return (
        <EditText tag="div" editing={editing} selected={is(block.id)} onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })} html={block.text}
          style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }} />
      );
    case 'heading':
      return (
        <EditText tag="h2" editing={editing} selected={is(block.id)} onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })} html={block.text}
          style={{ fontFamily: 'var(--font-display)', fontSize: slide.type === 'title' ? 46 : 34, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '0 0 2px', color: 'var(--ink)' }} />
      );
    case 'paragraph':
      return (
        <EditText tag="p" editing={editing} selected={is(block.id)} onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })} html={block.text}
          style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: '62ch', textWrap: 'pretty' }} />
      );
    case 'list':
      return (
        <ul className={editing ? 'editable' : ''} onMouseDown={editing ? (e) => { e.stopPropagation(); select(); } : undefined}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {block.items.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' }}>
                <Icon name="check" size={13} stroke={2.4} />
              </span>
              <span contentEditable={editing} suppressContentEditableWarning spellCheck={false}
                onBlur={editing ? (e) => { const items = [...block.items]; items[i] = e.target.innerText; onPatch(block.id, { items }); } : undefined}
                style={{ fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink)', paddingTop: 1 }}>{it}</span>
            </li>
          ))}
        </ul>
      );
    case 'image':
      return (
        <div className={editing ? 'editable' : ''} onMouseDown={editing ? (e) => { e.stopPropagation(); select(); } : undefined}>
          <Illustration kind={block.src} editing={editing} onReplace={() => onReplaceImage(block)} />
          {block.caption && (
            <EditText tag="div" editing={editing} selected={false}
              onCommit={(t) => onPatch(block.id, { caption: t })} html={block.caption}
              style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }} />
          )}
        </div>
      );
    case 'callout': {
      const tones = { info: ['blue', 'info'], warning: ['amber', 'warning'] };
      const [tone, icon] = tones[block.tone] || tones.info;
      return (
        <div className={editing ? 'editable' : ''} onMouseDown={editing ? (e) => { e.stopPropagation(); select(); } : undefined}
          style={{ display: 'flex', gap: 13, padding: 16, borderRadius: 'var(--r-lg)', background: `var(--${tone}-soft)`, border: `1px solid color-mix(in srgb, var(--${tone}) 22%, transparent)` }}>
          <div style={{ flexShrink: 0, color: `var(--${tone})`, marginTop: 1 }}><Icon name={icon} size={22} /></div>
          <div>
            <div contentEditable={editing} suppressContentEditableWarning spellCheck={false}
              onBlur={editing ? (e) => onPatch(block.id, { title: e.target.innerText }) : undefined}
              style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, color: 'var(--ink)' }}>{block.title}</div>
            <div contentEditable={editing} suppressContentEditableWarning spellCheck={false}
              onBlur={editing ? (e) => onPatch(block.id, { text: e.target.innerText }) : undefined}
              style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{block.text}</div>
          </div>
        </div>
      );
    }
    case 'video':
      return (
        <div className={editing ? 'editable' : ''} onMouseDown={editing ? (e) => { e.stopPropagation(); select(); } : undefined}
          style={{ position: 'relative' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'linear-gradient(135deg,#1c1a26,#3a2f4d)', display: 'grid', placeItems: 'center', boxShadow: 'var(--sh-md)' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: .35, backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(155,108,255,.6), transparent 45%), radial-gradient(circle at 75% 70%, rgba(214,80,78,.5), transparent 45%)' }} />
            <div style={{ position: 'relative', width: 66, height: 66, borderRadius: 99, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
              <Icon name="play" size={34} />
            </div>
            <div style={{ position: 'absolute', left: 14, bottom: 12, right: 14, display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.25)' }}>
                <div style={{ width: '32%', height: '100%', borderRadius: 99, background: '#fff' }} />
              </div>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{block.length}</span>
            </div>
          </div>
          {block.title && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>▶ {block.title}{block.required ? ' · required' : ''}</div>}
        </div>
      );
    default:
      return null;
  }
}

Object.assign(window, { Illustration, EditText, Block });
