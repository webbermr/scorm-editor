import { Icon } from '@/components/Icon';
import { Modal, ModalHead } from './Modal';
import { TYPE_META } from '@/lib/typeMeta';
import { SLIDE_TYPES } from '@/data/reference';
import { useUi } from '@/store/uiStore';
import { useEditorActions } from '@/lib/useEditorActions';

export function AddSlideModal() {
  const setModal = useUi((s) => s.setModal);
  const { addSlide } = useEditorActions();
  const close = () => setModal(null);

  return (
    <Modal onClose={close} width={560} label="Add slide">
      <ModalHead icon="plus" title="Add a slide" sub="Pick a content type to insert after the current slide." onClose={close} />
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {SLIDE_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => addSlide(t.id)}
            className="card"
            style={{ textAlign: 'left', padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'all .15s', background: 'var(--surface)', cursor: 'pointer' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'var(--sh-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 11, background: TYPE_META[t.id].soft, color: TYPE_META[t.id].color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={t.id} size={21} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
