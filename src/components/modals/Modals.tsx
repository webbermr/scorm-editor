import { useUi } from '@/store/uiStore';
import { AddSlideModal } from './AddSlideModal';
import { ReplaceImageModal } from './ReplaceImageModal';
import { ExportModal } from './ExportModal';
import { SettingsModal } from './SettingsModal';
import { OriginalModal } from './OriginalModal';

export function Modals() {
  const modal = useUi((s) => s.modal);
  switch (modal) {
    case 'add':
      return <AddSlideModal />;
    case 'replace':
      return <ReplaceImageModal />;
    case 'export':
      return <ExportModal />;
    case 'settings':
      return <SettingsModal />;
    case 'original':
      return <OriginalModal />;
    default:
      return null;
  }
}
