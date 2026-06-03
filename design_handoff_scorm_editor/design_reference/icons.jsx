// Icon set — stroke-based, 1.75 weight, rounded. Friendly & modern.
// Usage: <Icon name="plus" size={18} />
const ICON_PATHS = {
  // navigation / app
  logo: null, // custom below
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  drag: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevRight: '<path d="m9 6 6 6-6 6"/>',
  chevLeft: '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 6"/>',
  // slide types
  content: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/>',
  quiz: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.5 10a2.5 2.5 0 1 1 3.2 2.4c-.7.3-.7.9-.7 1.6"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/>',
  branching: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6 8.2V11a3 3 0 0 0 3 3h0M18 8.2V11a3 3 0 0 1-3 3h0M12 14v1.8"/>',
  title: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 10h8M9.5 14h5"/>',
  // actions
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/>',
  edit: '<path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  upload: '<path d="M12 16V5m0 0 4 4m-4-4-4 4M5 19h14"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7M8 14h8v6H8z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4 12H1m22 0h-3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none"/>',
  warning: '<path d="M12 3 2 20h20z"/><path d="M12 9v5"/><circle cx="12" cy="17.2" r="0.7" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z" fill="currentColor" stroke="none"/>',
  arrowRight: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4"/>',
  grip: '<path d="M9 5v14M15 5v14"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  text: '<path d="M5 6h14M9 6v13M7 19h4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  panelRight: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16"/>',
  fullscreen: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
};

function Icon({ name, size = 20, stroke = 1.75, className = '', style = {} }) {
  if (name === 'logo') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
        <path d="M12 2.5 4 6v5.5c0 4.6 3.2 7.9 8 9.5 4.8-1.6 8-4.9 8-9.5V6z" fill="currentColor" opacity="0.16" />
        <path d="M12 2.5 4 6v5.5c0 4.6 3.2 7.9 8 9.5 4.8-1.6 8-4.9 8-9.5V6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m8.5 12 2.4 2.4L16 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || '' }}
    />
  );
}

const TYPE_ICON = { content: 'content', video: 'video', quiz: 'quiz', branching: 'branching', title: 'title' };

Object.assign(window, { Icon, ICON_PATHS, TYPE_ICON });
