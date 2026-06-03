import { Modal, ModalHead } from './Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useUi } from '@/store/uiStore';
import { usePrefs, ACCENTS, FONTS, type AccentName, type Density, type FontName } from '@/store/prefsStore';

const DENSITIES: Density[] = ['compact', 'regular', 'comfy'];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

export function SettingsModal() {
  const setModal = useUi((s) => s.setModal);
  const close = () => setModal(null);

  const { accent, font, density, dark, setAccent, setFont, setDensity, setDark } = usePrefs();

  return (
    <Modal onClose={close} width={480} label="Settings">
      <ModalHead icon="settings" title="Preferences" sub="Personalize the editor. Saved to this browser." onClose={close} />
      <div style={{ padding: 22 }}>
        <Row label="Accent">
          <div style={{ display: 'flex', gap: 10 }}>
            {(Object.keys(ACCENTS) as AccentName[]).map((a) => {
              const on = accent === a;
              return (
                <button
                  key={a}
                  onClick={() => setAccent(a)}
                  className="tip"
                  data-tip={a}
                  aria-label={a}
                  aria-pressed={on}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 99,
                    background: ACCENTS[a].accent,
                    border: `2px solid ${on ? 'var(--ink)' : 'transparent'}`,
                    outline: on ? '2px solid var(--surface)' : 'none',
                    outlineOffset: -4,
                    boxShadow: 'var(--sh-sm)',
                  }}
                />
              );
            })}
          </div>
        </Row>

        <Row label="Theme">
          <Toggle label="Dark mode" on={dark} onChange={setDark} />
        </Row>

        <Row label="Font pairing">
          <select className="field" value={font} onChange={(e) => setFont(e.target.value as FontName)}>
            {(Object.keys(FONTS) as FontName[]).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Row>

        <Row label="Density">
          <div className="seg" style={{ width: '100%' }}>
            {DENSITIES.map((d) => (
              <button key={d} className={density === d ? 'on' : ''} style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }} onClick={() => setDensity(d)}>
                {d}
              </button>
            ))}
          </div>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-primary" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
