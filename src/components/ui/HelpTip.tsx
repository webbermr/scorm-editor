import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/Icon';

interface Props {
  /** what the help is about, for screen readers ("Help: <label>") */
  label: string;
  children: ReactNode;
}

const WIDTH = 290;
const GAP = 8;

// Small (i) button that explains a setting. Opens on hover or keyboard focus and
// stays open when clicked (for touch). The popover is portalled to <body> and
// position:fixed, so the modal's scroll area and its transform animation (which
// would otherwise become the containing block) can't clip or offset it.
export function HelpTip({ label, children }: Props) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = hover || pinned;

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 12);
    const above = r.bottom + GAP + h > window.innerHeight - 12 && r.top - GAP - h > 12;
    setPos({ left, top: above ? r.top - GAP - h : r.bottom + GAP });
  }, [open]);

  // clicking anywhere else closes a pinned tip
  useLayoutEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent) => {
      if (!btn.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setPinned(false);
    };
    // capture phase: the modal stops mousedown propagation inside the dialog
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [pinned]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="help-tip"
        aria-label={`Help: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={(e) => {
          e.preventDefault(); // don't activate a surrounding <label>
          setPinned((p) => !p);
        }}
      >
        <Icon name="info" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            id={id}
            role="tooltip"
            className="help-pop"
            // a hover preview lets the pointer pass through so it never blocks nearby controls
            style={{ width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999, pointerEvents: pinned ? 'auto' : 'none' }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
