import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/globals.css';
import { App } from './App';
import { registerFileServer } from './scorm/preview/fileServer';
import { installLmsStub } from './scorm/preview/lmsStub';
import { restoreDraftSync, setupDraftAutosave } from './store/draft';

// Register the in-app file server early so "View Original" is ready by import time.
registerFileServer();
// Provide a no-op SCORM API so embedded course players (Lectora, etc.) don't error
// with "Unable to find an API adapter" when rendered in the Original view.
installLmsStub(window);
// Bring back the last session from this browser (before first render), then autosave.
// (skip the restore when a ?demo= dev hook will load its own course)
if (!new URLSearchParams(window.location.search).has('demo')) restoreDraftSync();
setupDraftAutosave();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
