import { useEffect } from 'react';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { TopBar } from './TopBar';
import { Toast } from './Toast';
import { Navigator } from '@/components/navigator/Navigator';
import { EditCanvas } from '@/components/canvas/EditCanvas';
import { LmsPlayer } from '@/components/preview/LmsPlayer';
import { Inspector } from '@/components/inspector/Inspector';
import { Modals } from '@/components/modals/Modals';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';

export function EditorShell() {
  const slides = useCourse((s) => s.course.slides);
  const selectedId = useUi((s) => s.selectedSlideId);
  const mode = useUi((s) => s.mode);
  const inspectorOpen = useUi((s) => s.inspectorOpen);

  useKeyboardShortcuts();

  const slideIndex = Math.max(
    0,
    slides.findIndex((s) => s.id === selectedId),
  );
  const slide = slides[slideIndex] ?? slides[0];

  const setPreviewIndex = useUi((s) => s.setPreviewIndex);
  // In preview, keep the player index locked to the selected slide (covers
  // both entering preview and clicking a rail card while previewing).
  useEffect(() => {
    if (mode === 'preview') setPreviewIndex(slideIndex);
  }, [mode, slideIndex, setPreviewIndex]);

  if (!slide) return null;

  return (
    <>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Navigator />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            background: mode === 'preview' ? 'var(--surface-sunk)' : 'var(--paper)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {mode === 'edit' ? <EditCanvas slide={slide} slideIndex={slideIndex} total={slides.length} /> : <LmsPlayer />}
        </main>

        {inspectorOpen && mode === 'edit' && <Inspector slide={slide} />}
      </div>

      <Modals />
      <Toast />
    </>
  );
}
