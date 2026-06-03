import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Modal, ModalHead } from './Modal';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';

export function ReplaceImageModal() {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patchBlock = useCourse((s) => s.patchBlock);
  const setModal = useUi((s) => s.setModal);
  const flash = useUi((s) => s.flash);
  const selectedSlideId = useUi((s) => s.selectedSlideId);
  const blockId = useUi((s) => s.replaceTargetBlockId);

  const close = () => setModal(null);

  const apply = (file: File | undefined) => {
    if (!file || !selectedSlideId || !blockId) return;
    const url = URL.createObjectURL(file);
    patchBlock(selectedSlideId, blockId, { url, alt: file.name });
    setModal(null);
    flash('Image replaced');
  };

  return (
    <Modal onClose={close} width={460} label="Replace image">
      <ModalHead icon="image" title="Replace image" sub="Upload a new asset for this block." onClose={close} />
      <div style={{ padding: 18 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => apply(e.target.files?.[0])}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            apply(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--r-lg)',
            border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-strong)'}`,
            background: drag ? 'var(--accent-soft)' : 'var(--surface-2)',
            padding: '34px 20px',
            textAlign: 'center',
            transition: 'all .15s',
          }}
        >
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--surface)', color: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', boxShadow: 'var(--sh-sm)' }}>
            <Icon name="image" size={24} />
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Drop image or click to browse</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>PNG, JPG, SVG · up to 5 MB</div>
        </div>
      </div>
    </Modal>
  );
}
