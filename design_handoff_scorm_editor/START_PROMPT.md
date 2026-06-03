# Claude Code — Start Prompt

Copy everything in the box below and paste it as your first message to Claude Code, with this `design_handoff_scorm_editor/` folder placed at the root of an empty repo.

---

```
You are building a standalone web application called "Coursewright" — a SCORM editor for L&D / training administrators. They import a SCORM package (.zip), edit every slide (text, images, quizzes, branching scenarios), manage course structure and completion rules, preview each slide exactly as an LMS would render it, and re-export an LMS-ready package.

## Source of truth
This repo contains a `design_handoff_scorm_editor/` folder:
- `README.md` — the COMPLETE spec: design tokens (exact hex/px), every screen, layout, components, interactions, the data model, and the SCORM import/export requirements. Read it in full before writing any code.
- `design_reference/` — an HTML + React (in-browser Babel) PROTOTYPE. It is the visual + behavioral reference, NOT code to ship. Open `design_reference/SCORM Editor.html` in a browser to see the intended result. Study `styles.css` (all tokens), `app.jsx` (state + mutations + undo/redo), and the renderer files. Re-implement cleanly — do not paste the prototype's CDN/Babel setup.

## Fidelity
High-fidelity. Match colors, typography, spacing, radii, shadows, and interactions to the prototype and the README's token tables exactly.

## Tech stack
- React 18 + TypeScript + Vite.
- Styling via CSS variables + CSS Modules (keep a CSS-variable theming layer so dark mode + accent themes work). Tailwind is fine if you wire it to the exact token values.
- State: Zustand (or Context + reducer). The course is one nested document; ALL mutations go through a history-wrapped commit so undo/redo works.
- SCORM: `jszip` (zip read/write) + `fast-xml-parser` (imsmanifest.xml). Support BOTH SCORM 1.2 and SCORM 2004.
- Drag-reorder: `@dnd-kit`. Inline text editing: `contentEditable`. Icons: port `icons.jsx` or use `lucide-react`. Fonts: Bricolage Grotesque (display), Hanken Grotesk (UI), Space Mono (mono).

## What must be REAL (the prototype fakes these)
1. SCORM import — genuinely unzip, parse imsmanifest.xml, detect version, map the organization/item tree to slides, extract media, and load it into the editor. Show the parsing-progress UI and a clear error state for malformed packages. Where imported HTML can't be decomposed into editable blocks, keep it as a read-only previewable "raw HTML" block and flag it in the UI.
2. SCORM export — genuinely re-serialize slides to HTML, regenerate a valid imsmanifest.xml for the chosen version, bundle content + media + manifest into a .zip, validate, and download. Honor the package-name input and option toggles.
Everything else (editing, navigator, inspector, preview, undo/redo, theming) should be fully working app logic, not mocked.

## Build order
1. Scaffold Vite + TS + the theming layer (port every token from README / styles.css). Set up fonts.
2. App shell: 3-zone layout (top bar, navigator, canvas, collapsible inspector) + the course store with history/undo-redo, using the data model in the README. Seed with the sample course from `data.js` so you can build UI before import works.
3. Navigator (select, drag-reorder, add/duplicate/delete, progress) and Top bar (editable title, version badge, Edit/Preview toggle, undo/redo, Save, Export).
4. Edit canvas: block renderers (eyebrow, heading, paragraph, list, image+replace, callout, video) with inline editing + block selection; Inspector property sections.
5. Quiz + branching editors (edit) and their interactive Preview behavior.
6. LMS Preview mode (player chrome, navigation, read-only render reusing the same renderers).
7. Modals: Add-slide, Replace-image, Export. Toasts. Settings (the prototype's Tweaks → persisted preferences: accent, dark mode, font, density).
8. Real SCORM import (the entry screen + parser). Then real SCORM export.
9. Polish: keyboard shortcuts (Esc close, Cmd/Ctrl+Z/⇧Z, Cmd+S, ←/→ in preview), prefers-reduced-motion, empty/error states.

## Rules
- Keep the visible end-state as the base style; entrance animations must never hold persistent content at opacity 0 (use transform-only reveals), and honor prefers-reduced-motion.
- TypeScript throughout; type the course document and all actions.
- Keep components small and the store mutations pure + history-aware.
- After each milestone, run the app and verify against the prototype before moving on.

Start by reading design_handoff_scorm_editor/README.md and the design_reference files, then confirm your understanding and propose a file/folder structure before scaffolding.
```

---

## Tips for working with Claude Code after this
- If it drifts from the visuals, point it back to a specific file: *"Compare the navigator card against `design_reference/navigator.jsx` — the selected state needs the 1.5px accent border and `--sh-sm`."*
- Build and review **milestone by milestone** (the Build order above) rather than all at once.
- The hardest parts are real SCORM **import** and **export** — expect to iterate on manifest parsing/generation with a few real `.zip` samples from your LMS.
- Ask it to add a small test SCORM package fixture so import/export can be verified end-to-end.
