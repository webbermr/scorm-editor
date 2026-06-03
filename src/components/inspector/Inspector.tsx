import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { TYPE_META } from '@/lib/typeMeta';
import { COMPLETION_RULES } from '@/data/reference';
import { useCourse } from '@/store/courseStore';
import { useUi } from '@/store/uiStore';
import { useEditorActions } from '@/lib/useEditorActions';
import type { Block, BlockType, CalloutTone, MasteryRule, Slide, SlideStatus } from '@/types/course';

function InspRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function InspSection({ title, icon, children, right }: { title: string; icon?: IconName; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
          {icon && <Icon name={icon} size={15} />} {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const BLOCK_ICON: Record<BlockType, IconName> = {
  image: 'image',
  callout: 'info',
  list: 'list',
  video: 'video',
  heading: 'text',
  paragraph: 'text',
  eyebrow: 'text',
  rawHtml: 'code',
};

const ADD_BLOCKS: Array<[Exclude<BlockType, 'video' | 'rawHtml'>, string, IconName]> = [
  ['heading', 'Heading', 'text'],
  ['paragraph', 'Text', 'text'],
  ['list', 'List', 'list'],
  ['image', 'Image', 'image'],
  ['callout', 'Callout', 'info'],
];

interface Props {
  slide: Slide;
}

export function Inspector({ slide }: Props) {
  const meta = useCourse((s) => s.course.meta);
  const patchSlide = useCourse((s) => s.patchSlide);
  const patchMeta = useCourse((s) => s.patchMeta);
  const selectedBlockId = useUi((s) => s.selectedBlockId);
  const setInspectorOpen = useUi((s) => s.setInspectorOpen);
  const { addBlock, deleteBlock } = useEditorActions();

  const block: Block | undefined = slide.blocks?.find((b) => b.id === selectedBlockId);

  const onSlide = (patch: Partial<Slide>) => patchSlide(slide.id, patch);

  return (
    <aside
      style={{
        width: 'var(--inspector-w)',
        flexShrink: 0,
        background: 'var(--surface-2)',
        borderLeft: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Inspector</span>
        <button className="btn btn-sm btn-icon btn-ghost tip" data-tip="Hide panel" onClick={() => setInspectorOpen(false)}>
          <Icon name="panelRight" size={16} />
        </button>
      </div>

      {/* BLOCK properties */}
      {block && (
        <InspSection
          title="Selected block"
          icon="grip"
          right={
            <button className="btn btn-sm btn-icon btn-danger tip" data-tip="Delete block" onClick={() => deleteBlock(block.id)}>
              <Icon name="trash" size={14} />
            </button>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', color: 'var(--accent-ink)', marginBottom: 12 }}>
            <Icon name={BLOCK_ICON[block.type]} size={17} />
            <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{block.type}</span>
          </div>
          {block.type === 'callout' && (
            <InspRow label="Tone">
              <div className="seg" style={{ width: '100%' }}>
                {(['info', 'warning'] as CalloutTone[]).map((t) => (
                  <button key={t} className={block.tone === t ? 'on' : ''} style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }} onClick={() => onSlide({ blocks: slide.blocks?.map((b) => (b.id === block.id ? { ...b, tone: t } : b)) })}>
                    {t}
                  </button>
                ))}
              </div>
            </InspRow>
          )}
          {block.type === 'image' && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              Click <b style={{ color: 'var(--ink-2)' }}>Replace</b> on the image to swap in your own asset. Drag-drop or browse — PNG, JPG, SVG up to 5&nbsp;MB.
            </div>
          )}
          {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'eyebrow') && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Click the text on the slide to edit it inline.</div>
          )}
          {block.type === 'rawHtml' && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>This block was imported as raw HTML and couldn’t be decomposed into editable parts. It stays read-only but renders in preview and export.</div>
          )}
        </InspSection>
      )}

      {/* SLIDE properties */}
      <InspSection title="Slide" icon={slide.type}>
        <InspRow label="Slide name">
          <input className="field" value={slide.name} onChange={(e) => onSlide({ name: e.target.value })} />
        </InspRow>
        <InspRow label="Type">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 'var(--r-md)', background: TYPE_META[slide.type].soft, color: TYPE_META[slide.type].color }}>
            <Icon name={slide.type} size={17} />
            <span style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize' }}>{slide.type}</span>
          </div>
        </InspRow>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <InspRow label="Status">
              <select className="field" value={slide.status} onChange={(e) => onSlide({ status: e.target.value as SlideStatus })}>
                <option value="not-started">Not started</option>
                <option value="in-progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </InspRow>
          </div>
          <div style={{ width: 96 }}>
            <InspRow label="Est. time">
              <input className="field" value={slide.duration} onChange={(e) => onSlide({ duration: e.target.value })} />
            </InspRow>
          </div>
        </div>
        {(slide.type === 'content' || slide.type === 'title') && (
          <InspRow label="Add block">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {ADD_BLOCKS.map(([t, lbl, ic]) => (
                <button key={t} className="btn btn-sm btn-soft" style={{ justifyContent: 'flex-start' }} onClick={() => addBlock(t)}>
                  <Icon name={ic} size={14} /> {lbl}
                </button>
              ))}
            </div>
          </InspRow>
        )}
      </InspSection>

      {/* QUIZ settings */}
      {slide.type === 'quiz' && slide.quiz && (
        <InspSection title="Quiz settings" icon="quiz">
          <Toggle label="Shuffle questions" on={slide.quiz.shuffle} onChange={(v) => onSlide({ quiz: { ...slide.quiz!, shuffle: v } })} />
          <Toggle label="Show feedback" on={slide.quiz.feedback} onChange={(v) => onSlide({ quiz: { ...slide.quiz!, feedback: v } })} />
          <InspRow label="Question type">
            <div className="seg" style={{ width: '100%' }}>
              {(['single', 'multiple'] as const).map((v) => (
                <button key={v} className={slide.quiz!.kind === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSlide({ quiz: { ...slide.quiz!, kind: v } })}>
                  {v === 'single' ? 'Single' : 'Multi-question'}
                </button>
              ))}
            </div>
          </InspRow>
        </InspSection>
      )}

      {/* COURSE completion */}
      <InspSection title="Course completion" icon="check">
        <InspRow label="Completion rule">
          <select className="field" value={meta.masteryRule} onChange={(e) => patchMeta({ masteryRule: e.target.value as MasteryRule })}>
            {COMPLETION_RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.45 }}>{COMPLETION_RULES.find((r) => r.id === meta.masteryRule)?.desc}</div>
        </InspRow>
        <InspRow label="Passing score">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={0} max={100} step={5} value={meta.passingScore} onChange={(e) => patchMeta({ passingScore: +e.target.value })} style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, width: 40, textAlign: 'right' }}>{meta.passingScore}%</span>
          </div>
        </InspRow>
        <Toggle label="Track time spent" on={meta.trackTime} onChange={(v) => patchMeta({ trackTime: v })} />
        <Toggle label="Allow review after pass" on={meta.allowReview} onChange={(v) => patchMeta({ allowReview: v })} />
      </InspSection>
    </aside>
  );
}
