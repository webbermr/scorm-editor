import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { Block } from './Block';
import { QuizView } from '@/components/interactive/QuizView';
import { BranchingView } from '@/components/interactive/BranchingView';
import type { Block as BlockT, Slide } from '@/types/course';

interface Props {
  slide: Slide;
  editing: boolean;
}

// Shared slide-body renderer used by both the Edit canvas and the LMS preview.
// In edit mode it wires inline editing through the store; in preview it renders
// read-only (quiz/branching keep their own local interactive state).
export function SlideBody({ slide, editing }: Props) {
  const patchSlide = useCourse((s) => s.patchSlide);
  const patchBlock = useCourse((s) => s.patchBlock);
  const sel = useUi((s) => s.selectedBlockId);
  const selectBlock = useUi((s) => s.selectBlock);
  const openReplace = useUi((s) => s.openReplace);

  const onPatchSlide = (patch: Partial<Slide>) => patchSlide(slide.id, patch);

  if (slide.type === 'quiz' && slide.quiz) {
    return <QuizView slide={slide} editing={editing} onPatchSlide={onPatchSlide} />;
  }
  if (slide.type === 'branching' && slide.scenario) {
    return <BranchingView slide={slide} editing={editing} onPatchSlide={onPatchSlide} />;
  }

  const isTitle = slide.type === 'title';
  const blocks = slide.blocks ?? [];

  if (editing && blocks.length === 0) {
    return (
      <div style={{ border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--r-lg)', padding: '40px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-2)' }}>This slide is empty</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Add a block from the Inspector to get started.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxWidth: isTitle ? 720 : 760,
        margin: isTitle ? '0 auto' : 0,
        textAlign: isTitle ? 'center' : 'left',
        alignItems: isTitle ? 'center' : 'stretch',
      }}
    >
      {(slide.blocks ?? []).map((b) => (
        <Block
          key={b.id}
          block={b}
          slide={slide}
          editing={editing}
          sel={editing ? sel : null}
          onSelect={selectBlock}
          onPatch={(blockId, patch) => patchBlock(slide.id, blockId, patch as Partial<BlockT>)}
          onReplaceImage={openReplace}
        />
      ))}
    </div>
  );
}
