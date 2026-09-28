import { Icon } from '@/components/Icon';

interface Props {
  title: string;
  count: number;
  /** how many of the section's slides are ticked */
  checkedCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** tick every slide in the section, or untick them all when all are ticked */
  onToggleChecked: () => void;
  onDelete: () => void;
}

// A course section ("chapter") in the slide rail: collapse it, tick all its slides
// for the bulk toolbar, or delete the whole section.
export function SectionHeader({ title, count, checkedCount, collapsed, onToggleCollapsed, onToggleChecked, onDelete }: Props) {
  const all = checkedCount === count;
  const some = checkedCount > 0 && !all;
  return (
    <div className="section-head">
      <button className="section-chev" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} onClick={onToggleCollapsed}>
        <Icon name={collapsed ? 'chevRight' : 'chevDown'} size={14} />
      </button>
      <button
        role="checkbox"
        aria-checked={all ? true : some ? 'mixed' : false}
        aria-label={`Select all slides in ${title}`}
        className={'section-check' + (all ? ' on' : some ? ' some' : '')}
        onClick={onToggleChecked}
      >
        {all && <Icon name="check" size={11} />}
        {some && <span className="section-check-dash" />}
      </button>
      <button className="section-title" onClick={onToggleCollapsed} title={title}>
        {title}
      </button>
      <span className="section-count">{count}</span>
      <button className="section-del tip" data-tip="Delete section" aria-label={`Delete section ${title}`} onClick={onDelete}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}
