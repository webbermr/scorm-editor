import { useRef, type CSSProperties, type ElementType } from 'react';

interface Props {
  html: string;
  tag?: ElementType;
  editing: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onCommit?: (text: string) => void;
  style?: CSSProperties;
  className?: string;
  placeholder?: string;
}

// One editable text node. In preview mode it renders as plain (non-editable) text.
// Commits innerText on blur — mirrors the prototype's EditText so the cursor is
// never reset mid-edit (the model only updates on blur).
export function EditText({ html, tag, editing, selected, onSelect, onCommit, style, className = '', placeholder }: Props) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (tag ?? 'div') as ElementType;
  return (
    <Tag
      ref={ref}
      className={`${editing ? 'editable' : ''} ${selected ? 'sel' : ''} ${className}`.trim()}
      style={style}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={false}
      onMouseDown={
        editing
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
      onBlur={editing ? () => onCommit?.(ref.current?.innerText ?? '') : undefined}
      data-ph={placeholder}
    >
      {html}
    </Tag>
  );
}
