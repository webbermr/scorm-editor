import { Icon, type IconName } from '@/components/Icon';

interface Props {
  kind: string;
  /** real image URL (imported / uploaded) — rendered instead of the gradient placeholder */
  url?: string;
  alt?: string;
  editing: boolean;
  onReplace?: () => void;
}

const PALETTES: Record<string, [string, string, IconName]> = {
  shield: ['#6d4ee0', '#9b6cff', 'sparkle'],
  lock: ['#2f9e63', '#5fc98e', 'settings'],
  video: ['#d6504e', '#ff8a6b', 'play'],
  generic: ['#2f7fd9', '#63b3ff', 'image'],
};

// Gradient placeholder for course art the user would replace — OR a real <img>
// once an asset has been imported/uploaded (block.url).
export function Illustration({ kind, url, alt, editing, onReplace }: Props) {
  const [c1, c2, icon] = PALETTES[kind] ?? PALETTES.generic;

  const replaceBtn = editing && (
    <button
      className="btn btn-sm"
      onClick={(e) => {
        e.stopPropagation();
        onReplace?.();
      }}
      style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.92)', color: 'var(--ink)', boxShadow: 'var(--sh-md)' }}
    >
      <Icon name="image" size={14} /> Replace
    </button>
  );

  if (url) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--sh-sm)', background: 'var(--surface-sunk)' }}>
        <img src={url} alt={alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {replaceBtn}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'grid',
        placeItems: 'center',
        boxShadow: 'var(--sh-sm)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.5,
          backgroundImage: 'radial-gradient(circle at 18% 22%, rgba(255,255,255,.35), transparent 38%), radial-gradient(circle at 82% 78%, rgba(0,0,0,.18), transparent 42%)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.14, backgroundImage: 'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 16px)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#fff' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
          <Icon name={icon} size={32} stroke={2} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>Image placeholder</span>
      </div>
      {replaceBtn}
    </div>
  );
}
