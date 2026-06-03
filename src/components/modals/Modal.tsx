import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  width?: number;
  label: string;
}

export function Modal({ children, onClose, width = 520, label }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,26,20,.42)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'fadeIn .15s both' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-pop)', border: '1px solid var(--line)', animation: 'scaleIn .2s both' }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHead({ title, sub, onClose, icon }: { title: string; sub?: string; onClose: () => void; icon?: IconName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
      {icon && (
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={20} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button className="btn btn-sm btn-icon btn-ghost" onClick={onClose} aria-label="Close">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
