import { Icon } from '@/components/Icon';
import { useUi } from '@/store/uiStore';

export function Toast() {
  const toast = useUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: 'var(--ink)',
        color: 'var(--paper)',
        padding: '11px 18px',
        borderRadius: 99,
        fontSize: 13.5,
        fontWeight: 600,
        boxShadow: 'var(--sh-pop)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        animation: 'fadeUp .2s both',
      }}
    >
      <Icon name="check" size={16} stroke={2.6} /> {toast}
    </div>
  );
}
