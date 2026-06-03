import { Icon, type IconName } from '@/components/Icon';
import { EditText } from './EditText';
import { Illustration } from './Illustration';
import type { Block as BlockT, Slide } from '@/types/course';

interface Props {
  block: BlockT;
  slide: Slide;
  editing: boolean;
  sel: string | null;
  onSelect: (id: string) => void;
  onPatch: (blockId: string, patch: Partial<BlockT>) => void;
  onReplaceImage: (blockId: string) => void;
}

export function Block({ block, slide, editing, sel, onSelect, onPatch, onReplaceImage }: Props) {
  const isSel = (id: string) => sel === id;
  const select = () => onSelect(block.id);
  const selectMouse = editing
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        select();
      }
    : undefined;

  switch (block.type) {
    case 'eyebrow':
      return (
        <EditText
          tag="div"
          editing={editing}
          selected={isSel(block.id)}
          onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })}
          html={block.text}
          style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}
        />
      );

    case 'heading':
      return (
        <EditText
          tag="h2"
          editing={editing}
          selected={isSel(block.id)}
          onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })}
          html={block.text}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: slide.type === 'title' ? 46 : 34,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            margin: '0 0 2px',
            color: 'var(--ink)',
          }}
        />
      );

    case 'paragraph':
      return (
        <EditText
          tag="p"
          editing={editing}
          selected={isSel(block.id)}
          onSelect={select}
          onCommit={(t) => onPatch(block.id, { text: t })}
          html={block.text}
          style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: '62ch', textWrap: 'pretty' }}
        />
      );

    case 'list':
      return (
        <ul
          className={editing ? 'editable' : ''}
          onMouseDown={selectMouse}
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}
        >
          {block.items.map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' }}>
                <Icon name="check" size={13} stroke={2.4} />
              </span>
              <span
                contentEditable={editing}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={
                  editing
                    ? (e) => {
                        const items = [...block.items];
                        items[i] = (e.target as HTMLElement).innerText;
                        onPatch(block.id, { items });
                      }
                    : undefined
                }
                style={{ fontSize: 16.5, lineHeight: 1.5, color: 'var(--ink)', paddingTop: 1 }}
              >
                {it}
              </span>
            </li>
          ))}
        </ul>
      );

    case 'image':
      return (
        <div className={editing ? 'editable' : ''} onMouseDown={selectMouse}>
          <Illustration kind={block.src} url={block.url} alt={block.alt} editing={editing} onReplace={() => onReplaceImage(block.id)} />
          {block.caption && (
            <EditText
              tag="div"
              editing={editing}
              onCommit={(t) => onPatch(block.id, { caption: t })}
              html={block.caption}
              style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, fontStyle: 'italic' }}
            />
          )}
        </div>
      );

    case 'callout': {
      const tones: Record<string, [string, IconName]> = { info: ['blue', 'info'], warning: ['amber', 'warning'] };
      const [tone, icon] = tones[block.tone] ?? tones.info;
      return (
        <div
          className={editing ? 'editable' : ''}
          onMouseDown={selectMouse}
          style={{ display: 'flex', gap: 13, padding: 16, borderRadius: 'var(--r-lg)', background: `var(--${tone}-soft)`, border: `1px solid color-mix(in srgb, var(--${tone}) 22%, transparent)` }}
        >
          <div style={{ flexShrink: 0, color: `var(--${tone})`, marginTop: 1 }}>
            <Icon name={icon} size={22} />
          </div>
          <div>
            <div
              contentEditable={editing}
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={editing ? (e) => onPatch(block.id, { title: (e.target as HTMLElement).innerText }) : undefined}
              style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, color: 'var(--ink)' }}
            >
              {block.title}
            </div>
            <div
              contentEditable={editing}
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={editing ? (e) => onPatch(block.id, { text: (e.target as HTMLElement).innerText }) : undefined}
              style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}
            >
              {block.text}
            </div>
          </div>
        </div>
      );
    }

    case 'video':
      return (
        <div className={editing ? 'editable' : ''} onMouseDown={selectMouse} style={{ position: 'relative' }}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'linear-gradient(135deg,#1c1a26,#3a2f4d)', display: 'grid', placeItems: 'center', boxShadow: 'var(--sh-md)' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(155,108,255,.6), transparent 45%), radial-gradient(circle at 75% 70%, rgba(214,80,78,.5), transparent 45%)' }} />
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
          {block.title && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>
              ▶ {block.title}
              {block.required ? ' · required' : ''}
            </div>
          )}
        </div>
      );

    case 'rawHtml':
      // Imported HTML that couldn't be decomposed into editable blocks: read-only,
      // still previewable, and clearly flagged.
      return (
        <div onMouseDown={selectMouse} style={{ position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--amber)',
              background: 'var(--amber-soft)',
              border: '1px solid color-mix(in srgb, var(--amber) 30%, transparent)',
              padding: '3px 9px',
              borderRadius: 99,
              marginBottom: 8,
            }}
          >
            <Icon name="code" size={13} /> Imported HTML · read-only
          </div>
          <div
            style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '16px 18px', background: 'var(--surface-2)', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      );

    default:
      return null;
  }
}
