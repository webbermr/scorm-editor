import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { EditText } from '@/components/canvas/EditText';
import type { Scenario, ScenarioOutcome, Slide } from '@/types/course';

interface Props {
  slide: Slide;
  editing: boolean;
  onPatchSlide: (patch: Partial<Slide>) => void;
}

const TONES: Record<ScenarioOutcome, [string, string]> = {
  correct: ['green', 'Best choice'],
  partial: ['amber', 'Risky'],
  incorrect: ['rose', 'Unsafe'],
};

export function BranchingView({ slide, editing, onPatchSlide }: Props) {
  const sc = slide.scenario!;
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => setPicked(null), [slide.id]);

  const patchSc = (patch: Partial<Scenario>) => onPatchSlide({ scenario: { ...sc, ...patch } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 12.5, fontWeight: 700 }}>
        <Icon name="branching" size={15} /> Branching scenario
      </div>
      <EditText
        tag="div"
        editing={editing}
        onCommit={(t) => patchSc({ setup: t })}
        html={sc.setup}
        style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.01em', maxWidth: '40ch' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {sc.choices.map((ch, i) => {
          const [tone, lbl] = TONES[ch.outcome] ?? TONES.partial;
          const active = picked === ch.id;
          return (
            <div key={ch.id}>
              <div
                onClick={!editing ? () => setPicked(ch.id) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: '15px 17px',
                  borderRadius: 'var(--r-lg)',
                  cursor: editing ? 'default' : 'pointer',
                  background: active ? `var(--${tone}-soft)` : 'var(--surface)',
                  border: `1.5px solid ${active ? `var(--${tone})` : 'var(--line)'}`,
                  transition: 'all .15s',
                  boxShadow: 'var(--sh-sm)',
                }}
              >
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: 'var(--surface-sunk)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)' }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span
                  contentEditable={editing}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={editing ? (e) => patchSc({ choices: sc.choices.map((x) => (x.id === ch.id ? { ...x, text: (e.target as HTMLElement).innerText } : x)) }) : undefined}
                  style={{ flex: 1, fontSize: 15.5, fontWeight: 500 }}
                >
                  {ch.text}
                </span>
                {editing && (
                  <select
                    value={ch.outcome}
                    onChange={(e) => patchSc({ choices: sc.choices.map((x) => (x.id === ch.id ? { ...x, outcome: e.target.value as ScenarioOutcome } : x)) })}
                    className="field"
                    style={{ width: 'auto', padding: '5px 8px', fontSize: 12.5, height: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="correct">Best</option>
                    <option value="partial">Risky</option>
                    <option value="incorrect">Unsafe</option>
                  </select>
                )}
              </div>
              {!editing && active && (
                <div style={{ marginTop: 9, padding: '13px 16px', borderRadius: 'var(--r-md)', background: `var(--${tone}-soft)`, border: `1px solid color-mix(in srgb, var(--${tone}) 25%, transparent)`, animation: 'riseIn .25s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: `var(--${tone})`, marginBottom: 4 }}>
                    <Icon name={(ch.outcome === 'correct' ? 'check' : 'warning') as IconName} size={15} /> {lbl}
                  </div>
                  <div style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{ch.result}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
