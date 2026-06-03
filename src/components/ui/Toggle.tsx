interface Props {
  label?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}

// Pill switch — shared by the Inspector and the Export modal options.
export function Toggle({ label, on, onChange }: Props) {
  const sw = (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{ width: 40, height: 23, borderRadius: 99, background: on ? 'var(--accent)' : 'var(--line-strong)', padding: 2, transition: 'background .18s', flexShrink: 0 }}
    >
      <span style={{ display: 'block', width: 19, height: 19, borderRadius: 99, background: '#fff', boxShadow: 'var(--sh-sm)', transform: on ? 'translateX(17px)' : 'none', transition: 'transform .18s' }} />
    </button>
  );

  if (label === undefined) return sw;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
      <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{label}</span>
      {sw}
    </div>
  );
}
