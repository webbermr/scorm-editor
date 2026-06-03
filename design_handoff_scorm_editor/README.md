# Handoff: SCORM Editor — "Coursewright"

## Overview
**Coursewright** is a standalone web application for **L&D / training administrators** to import SCORM packages, edit every slide (text, images, quizzes, branching scenarios), manage course structure and completion rules, **preview content exactly as an LMS would render it**, and re-export an LMS-ready package.

This document is a complete, self-sufficient specification. A developer who was not part of the design conversation should be able to build the app from this README alone, using the bundled HTML prototype as the visual source of truth.

---

## About the Design Files
The files in `design_reference/` are a **design prototype built in HTML + React (via in-browser Babel)**. They are a **reference for look, layout, and behavior — not production code to ship directly.**

Your task is to **recreate this design in a real, standalone web codebase** using a proper build toolchain and the framework conventions below. Treat the prototype as the spec for visuals and interactions; re-implement the logic cleanly with real state management, real file handling, and real SCORM parsing/packaging.

The prototype fakes two things that must become **real** in the build:
1. **SCORM import** — currently a simulated "parsing" animation that loads hard-coded sample data. Must become genuine `.zip` + `imsmanifest.xml` parsing.
2. **SCORM export** — currently a simulated "build" with a no-op download. Must become a genuine `.zip` re-package with a regenerated manifest.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, and interactions are final. Recreate the UI faithfully. Exact design tokens are listed below and in `design_reference/styles.css`.

---

## Recommended Tech Stack (no existing codebase)
There is no existing environment, so choose a modern standalone setup:

- **Framework:** React 18 + TypeScript
- **Build tool:** Vite
- **Styling:** CSS variables + CSS Modules (or Tailwind configured with the token values below). The prototype's token system maps cleanly to either. Keep the CSS-variable theming layer — it powers dark mode + accent theming.
- **State:** Component state + a lightweight store (Zustand or React Context + reducer). The course document is a single nested object; an undo/redo history stack wraps all mutations.
- **SCORM parsing/packaging:** `jszip` for zip read/write; `fast-xml-parser` (or `@xmldom/xmldom` + manual) for `imsmanifest.xml`. Support **SCORM 1.2** and **SCORM 2004**.
- **Drag & drop reorder:** `@dnd-kit/core` + `@dnd-kit/sortable` (the prototype uses raw HTML5 DnD; dnd-kit is more robust).
- **Rich text inline editing:** `contentEditable` is acceptable for this scope (as in the prototype). If richer formatting is needed later, consider TipTap.
- **Icons:** The prototype ships a hand-built stroke icon set (`design_reference/icons.jsx`, 1.75 stroke weight, rounded caps/joins). Port these exact paths, or swap to `lucide-react` (visually equivalent — same stroke style).
- **Fonts:** Google Fonts — Bricolage Grotesque (display), Hanken Grotesk (UI/body), Space Mono (mono/IDs). Optional: Fraunces, Space Grotesk (used by a theme tweak).

---

## Design Tokens

### Color — Light theme (default)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#f5f1ea` | App background (warm cream) |
| `--surface` | `#ffffff` | Cards, panels, inputs |
| `--surface-2` | `#faf7f2` | Sidebars, subtle raised areas |
| `--surface-sunk` | `#f0ebe2` | Track fills, segmented-control bg |
| `--ink` | `#2a2620` | Primary text (warm near-black) |
| `--ink-2` | `#5c554b` | Secondary text |
| `--ink-3` | `#8c8377` | Tertiary / hint text |
| `--line` | `#e7e0d5` | Default borders |
| `--line-strong` | `#d8cfc0` | Stronger borders, dashed dropzones |

### Color — Accent (themeable; default "Violet")
| Token | Violet | Teal | Coral | Indigo |
|---|---|---|---|---|
| `--accent` | `#6d4ee0` | `#0d9488` | `#e2563c` | `#3f5bd9` |
| `--accent-press` | `#5a3dc8` | `#0b7d73` | `#c9462e` | `#3349bd` |
| `--accent-soft` | `#efe9ff` | `#d9f3f0` | `#fce4dd` | `#e4e8fc` |
| `--accent-ink` | `#4a2fb0` | `#0a6b62` | `#b23a25` | `#2a3aa0` |

### Color — Semantic
| Token | Hex | Soft variant |
|---|---|---|
| Green (complete/correct) | `--green #2f9e63` | `--green-soft #e3f4ea` |
| Amber (in-progress/risky) | `--amber #d98a2b` | `--amber-soft #fbeed8` |
| Rose (delete/incorrect) | `--rose #d6504e` | `--rose-soft #fbe6e5` |
| Blue (info) | `--blue #2f7fd9` | `--blue-soft #e3eefb` |

### Color — Dark theme overrides
Applied via `[data-theme='dark']` on the root. Key values: `--paper #1a1814`, `--surface #242019`, `--surface-2 #2b261e`, `--surface-sunk #1f1c16`, `--ink #f3ede2`, `--ink-2 #c2b9a9`, `--ink-3 #8f8676`, `--line #38322a`, `--line-strong #463f34`; soft semantic colors are darkened (see `styles.css`). Accent hexes stay the same; only `--accent-soft` darkens per theme.

### Typography
- **Display** (`--font-display`): `'Bricolage Grotesque'`. Headings, course title, logo wordmark, modal titles. Weight 700, letter-spacing −0.02em.
- **UI/body** (`--font-ui`): `'Hanken Grotesk'`. Everything else. Weights 400/500/600/700/800.
- **Mono** (`--font-mono`): `'Space Mono'`. SCORM IDs, version badges, file names, slide numbers, percentage readouts.
- Scale (px): slide title heading 46 (title slide) / 34 (content & quiz prompt); branching setup 26; body paragraph 17 (line-height 1.6); list item 16.5; quiz option 15; UI labels 13.5; field labels 11.5 uppercase tracked .04em; eyebrow 12.5 bold tracked .14em uppercase.

### Shape & elevation
- Radius: `--r-sm 8px`, `--r-md 12px`, `--r-lg 16px`, `--r-xl 22px`.
- Shadows: `--sh-sm` (subtle 1–3px), `--sh-md` (cards: 2/6 + 6/18), `--sh-lg` (overlays), `--sh-pop` (modals: 0 10px 40px rgba(42,38,32,.18)). Exact values in `styles.css`.

### Spacing & density
Layout has 3 density presets (a Tweak in the prototype; ship as a user setting):
- Rail width: compact 256 / regular 296 / comfy 336 px.
- Inspector width: compact 290 / regular 324 / comfy 360 px.
- Top bar height: 60px.

### Motion
- Entrance: a **transform-only** `riseIn` (translateY 10px→0, ~.28s ease-out) — **opacity is never animated to 0 for persistent content** (so content is always visible even if the animation clock stalls). Honor `prefers-reduced-motion`.
- Toggles/segmented controls: .15–.18s ease.
- Toasts: slide-up + fade, auto-dismiss ~1.9s.

---

## Global Layout
Three-zone editor shell, full viewport, no page scroll (each zone scrolls independently):

```
┌─────────────────────────────────────────────────────────────┐
│ TOP BAR (60px)                                                │
├──────────────┬───────────────────────────────┬──────────────┤
│ NAVIGATOR    │ CANVAS                         │ INSPECTOR    │
│ (rail, left) │ (Edit OR LMS Preview)          │ (right,      │
│ scrolls      │ scrolls                        │  collapsible)│
└──────────────┴───────────────────────────────┴──────────────┘
```
- Navigator + Inspector use `--surface-2` with a 1px `--line` divider.
- Canvas background: `--paper` in Edit mode, `--surface-sunk` in Preview mode.
- Inspector is hidden in Preview mode and when the user collapses it.

---

## Screens / Views

### 1. Import screen (app entry)
**Purpose:** First thing the user sees; import a SCORM `.zip` to begin.
**Layout:** Full-viewport centered column (max 560px) on a `--paper` background with a soft radial accent glow at top (`radial-gradient(120% 80% at 50% -10%, var(--accent-soft), transparent 60%)`).
**Components:**
- Logo lockup: 38px rounded-11 accent square with shield-check glyph + "Coursewright" wordmark (display font, 22px).
- H1 (display, 32px, −0.025em): "Import a SCORM package to start editing".
- Subcopy (15.5px `--ink-2`): mentions SCORM 1.2 / 2004 `.zip`.
- **Dropzone:** white card, 2px dashed `--line-strong` border, radius `--r-xl`, 40px padding. On drag-over: border + bg switch to accent / `--accent-soft`. Contains an upload-icon tile (60px, radius 18, `--accent-soft`), "Drag & drop your .zip here", "or click to browse — max 200 MB", and a primary "Choose SCORM file" button.
- Below: "No file handy? **Load the sample course →**" (accent link).
**Behavior (make real):** Accept file drop or file picker (`.zip`). Parse the package (see SCORM Import Requirements). Show a progress card replacing the dropzone with sequential steps: *Unzipping package → Reading imsmanifest.xml → Mapping SCOs to slides → Extracting media assets → Ready to edit*, each row flipping from spinner → green check. On completion, transition into the editor. "Load the sample course" bypasses parsing and loads built-in demo content.

### 2. Top bar
**Purpose:** Course identity + global actions.
**Layout:** Horizontal flex, 60px tall, `--surface` bg, bottom 1px `--line`. Left→right: logo square (32px) + wordmark · vertical divider · **editable course-title input** (display font 15.5/700, transparent until focus → `--surface-2` bg + `--line` border; width `clamp(220px, 30vw, 460px)`) · mono SCORM version badge (`SCORM 1.2`/`SCORM 2004`, `--surface-sunk` pill) · flex spacer · **undo / redo** icon buttons (disabled at history ends, .35 opacity) · **mode segmented control** (Edit | Preview) · inspector-toggle icon button (accent when open) · vertical divider · **Save** soft button (label toggles "Save"/"Saved" by dirty state) · **Export** primary button.

### 3. Navigator (left rail)
**Purpose:** Manage and select slides.
**Layout:** Fixed width (density-based), `--surface-2`, vertical flex. Header row: "Slides" + count "N items · M done" and an "Add" small soft button. Below header: a 5px progress bar (`--surface-sunk` track, gradient `accent→green` fill = % complete slides). Then a scrolling list of slide cards. Footer: a dashed "Add slide" button (hover → accent border + text).
**Slide card:** radius `--r-md`, 1.5px border (accent + `--surface` bg + `--sh-sm` when selected, transparent otherwise; hover → `--surface-2`). Contents: 2-digit mono index (drag handle, `cursor: grab`) · 46×34 rounded-8 thumbnail tinted by slide type (icon in type color on soft-type bg) · name (600, ellipsized) + a meta row (7px status dot · type · "· duration") · hover-revealed action column with **Duplicate** and **Delete** (rose) mini buttons.
**Type → color map:** content=blue, video=rose, quiz=accent, branching=amber, title=green (each with its `-soft` bg).
**Status → dot color:** complete=green, in-progress=amber, not-started=`--line-strong`.
**Behavior:** Click selects (drives canvas; in Preview also drives the player). **Drag to reorder** (show drop indicator: 2px accent outline on the target; dragged card at .4 opacity). Duplicate inserts a copy directly below (name + " (copy)", status reset to not-started). Delete removes (block deleting the last remaining slide — show a toast). "Add" / "Add slide" / "+" open the Add-slide modal; new slide is inserted after the current selection and auto-selected.

### 4. Canvas — Edit mode
**Purpose:** Edit the selected slide's content inline.
**Layout:** Scrolling area, `--paper` bg, content centered, max-width 880px. A white "slide card" (`--surface`, `--surface-2` for title slides) radius `--r-lg`, `--sh-md`, padding 46×52. Card header: a type badge + "Slide X of N" + a clock + duration, divided by a dashed rule. Below: the slide body (see Block types). Clicking empty canvas deselects the active block.
**Selection model:** Hovering an editable block shows a 2px `--accent-soft` ring; the selected block shows a 2px solid accent ring + faint accent wash. Text blocks edit in place via `contentEditable`, committing on blur.

#### Block types (content & title slides)
- **eyebrow** — uppercase accent micro-label (12.5/800, tracking .14em).
- **heading** — display font; 46px on title slides, 34px elsewhere.
- **paragraph** — 17px/1.6 `--ink-2`, max 62ch, `text-wrap: pretty`.
- **list** — custom bullets: each item a 22px rounded-7 `--accent-soft` tile with an accent check, then editable text (16.5px).
- **image** — gradient placeholder (16:9, radius `--r-lg`) with a centered glyph tile + "IMAGE PLACEHOLDER" label; in Edit shows a "Replace" button (top-right) that opens the Replace-image modal. Optional italic caption below (editable, `--ink-3`).
- **callout** — tinted box (info=blue, warning=amber), `-soft` bg + 22%-opacity border, leading icon, editable bold title + body.
- **video** — dark 16:9 poster with a glassy circular play button, a fake scrubber + mono timecode; caption line "▶ title · required".
Title slides center their content (max 720px, centered text); content slides are left-aligned (max 760px).

### 5. Canvas — Quiz slide (Edit + Preview)
**Edit:** Editable prompt (display 34) + instruction. Each question is a card (`--surface`, radius `--r-lg`, 20px): mono "Q1" chip + editable question text + delete-question button (hidden if only one question). Options are rows; the leading control is a **mark-correct toggle** (circle → green check when correct; single-correct radio semantics). Option text is editable; each option past the 2nd has a remove "×". "Add option" and "Add question" buttons. Quiz settings (shuffle, show-feedback, single vs multi-question) live in the Inspector.
**Preview (interactive):** Options are selectable (accent highlight). A "Submit answers" primary button is disabled until all questions answered. On submit: correct options turn green (with check), wrong-chosen turn rose; if feedback is on, a per-question feedback note appears; a score chip shows percent + Pass/Fail against the 80% passing score + a "Retry" button.

### 6. Canvas — Branching scenario (Edit + Preview)
A "Branching scenario" accent pill, an editable setup prompt (display 26, max 40ch), and a list of choice rows (each: letter chip A/B/C + editable text). **Edit:** each choice has an outcome `<select>` (Best / Risky / Unsafe). **Preview:** clicking a choice reveals an outcome panel below it — tinted by outcome (correct=green, partial=amber, incorrect=rose) with an icon, label, and result text.

### 7. Canvas — LMS Preview mode
**Purpose:** Show the slide exactly as a learner's LMS would render it.
**Layout:** Canvas bg `--surface-sunk`. A centered "player" window (max 1080px, radius `--r-xl`, `--sh-lg`, `--surface`):
- **Player top chrome:** accent logo tile + course title + "Lesson X of N · P% complete"; right side a 130px progress bar (green fill) + an "Exit preview" ✕.
- **Content area:** the slide body rendered **non-editable** (reuses the same block/quiz/branching renderers with editing off). Title slides get `--surface-2` bg.
- **Player bottom chrome:** "Previous" (disabled on first), a center dot strip (current = accent elongated pill, visited = green, upcoming = `--line-strong`; click a dot to jump), and "Next" (last slide → "Finish", which exits to Edit).
Navigating the player keeps the rail selection in sync and vice-versa.

### 8. Inspector (right panel)
**Purpose:** Context properties for the current selection.
**Layout:** Density-based width, `--surface-2`, scrolls, sticky header ("Inspector" + collapse button). Sections separated by 1px `--line`:
- **Selected block** (only when a block is selected): type chip + delete-block button; tone toggle for callouts; helper text for image/text blocks.
- **Slide:** editable slide name; read-only type chip; status `<select>`; est-time text; and (content/title only) an "Add block" grid — Heading, Text, List, Image, Callout.
- **Quiz settings** (quiz slides): shuffle toggle, show-feedback toggle, single/multi-question segmented control.
- **Course completion:** completion-rule `<select>` (Completed + Passed / Passed only / Completed only / Visited) with a description line; passing-score slider (0–100 step 5, mono % readout); "Track time spent" toggle; "Allow review after pass" toggle.

### 9. Modals
Shared shell: fixed overlay `rgba(30,26,20,.42)` + 3px blur; centered card (`--surface`, radius `--r-xl`, `--sh-pop`); Esc + backdrop-click close; header with optional accent icon tile, display title, subtitle, close ✕.
- **Add slide:** 2-col grid of 5 type cards (Content / Video / Quiz / Scenario / Title), each with type-tinted icon tile, label, description; hover → accent border + `--sh-md`. Click inserts that slide type.
- **Replace image:** a dropzone (same affordances as import). On drop/click, replace the block's image and toast "Image replaced".
- **Export SCORM:** 3 phases — *config* (package name input with `.zip` suffix; SCORM 1.2/2004 segmented control; options list with toggles: Regenerate imsmanifest.xml, Minify HTML & assets, Include editable source files; Cancel / "Build package") → *building* (spinner + "Building name.zip… · packaging N slides · SCORM v") → *done* (green check, file name + size + version, "Download .zip"). **Make real:** actually generate and download the package.

### 10. Toasts
Bottom-center pill (`--ink` bg, `--paper` text, radius 99, `--sh-pop`), leading check icon, auto-dismiss ~1.9s. Used for: Slide added/deleted/duplicated, Image replaced, Saved, and the "can't delete last slide" guard.

### 11. Settings / Tweaks (prototype-only → ship as real preferences)
The prototype exposes a floating "Tweaks" dev panel controlling: **accent** (Violet/Teal/Coral/Indigo), **dark mode**, **font pairing**, **density** (compact/regular/comfy). In the real app, surface these as a proper **Settings menu / preferences** (persisted to `localStorage`). They map to the CSS-variable theming layer — keep that layer.

---

## Interactions & Behavior (summary)
- **Inline text editing** via `contentEditable`, commit on blur into the course model.
- **Drag-reorder** slides with a visible drop indicator.
- **Add / duplicate / delete** slides and content blocks; insert-after-current semantics; guard against deleting the final slide.
- **Mode switch** Edit ⇄ Preview; Preview is read-only and adds player chrome.
- **Undo / redo** across every course mutation (text edits, structural changes, metadata, quiz/branching edits). History cap ~40 steps.
- **Dirty tracking** → Save button state; **toasts** confirm actions.
- **Keyboard:** Esc closes modals. (Recommended additions for the build: ⌘/Ctrl+Z / ⇧⌘Z undo-redo, ⌘S save, ←/→ to navigate slides in Preview.)
- **Responsive:** Desktop-first tool. Below ~1100px, allow collapsing the inspector and narrowing the rail; a true mobile layout is out of scope for v1.

## State Management
Single course document:
```
Course {
  meta: { title, package, identifier, scormVersion('1.2'|'2004'), edition,
          language, author, duration, passingScore:number, masteryRule,
          trackTime:bool, allowReview:bool, description }
  slides: Slide[]
}
Slide {
  id, type('title'|'content'|'video'|'quiz'|'branching'),
  name, status('complete'|'in-progress'|'not-started'), duration,
  blocks?: Block[],          // content/title/video
  quiz?: { prompt, instruction, kind('single'|'multiple'), shuffle, feedback,
           questions: [{ id, text, options:[{id,text,correct}], feedbackCorrect?, feedbackIncorrect? }] },
  scenario?: { setup, choices:[{ id, text, outcome('correct'|'partial'|'incorrect'), result }] }
}
Block = eyebrow|heading|paragraph|list|image|callout|video (see prototype data.js for shapes)
```
UI state (separate from the document): `imported`, `selectedSlideId`, `selectedBlockId`, `mode`, `inspectorOpen`, `activeModal`, `previewIndex`, `dirty`, `toast`, plus `past[]`/`future[]` history stacks and theme prefs. See `design_reference/data.js` for the full sample document and `design_reference/app.jsx` for the reducer-style mutation handlers (`commit`, `addSlide`, `deleteSlide`, `duplicateSlide`, `reorder`, `addBlock`, `deleteBlock`, `patchSlide`, `patchMeta`).

---

## SCORM Import Requirements (must be real)
1. Accept a `.zip` via drag-drop or picker; unzip with `jszip`.
2. Locate and parse `imsmanifest.xml`. Detect schema version (SCORM 1.2 `adlcp:scormtype` vs 2004 `adlcp:scormType` / schema version element) and set `meta.scormVersion`.
3. Read `<organizations>/<organization>/<item>` tree → map each leaf item (SCO/asset) to a **slide** (`item.title` → `slide.name`, `resource.href` → launch content). Preserve order and any nesting (modules/lessons) for the navigator.
4. Pull course metadata (title, identifier, language, mastery score / completion thresholds where present) into `meta`.
5. Extract referenced media (images, video posters) from the zip into in-memory object URLs for the canvas/preview.
6. Render imported HTML content into the slide model where feasible; for content that cannot be decomposed into editable blocks, show it in a read-only "raw HTML" block (still previewable) and flag it as non-decomposed. **Document this limitation clearly in the UI.**
7. Show the parsing-progress UI; handle malformed packages with a clear error state.

## SCORM Export Requirements (must be real)
1. Re-serialize the edited course to LMS-ready HTML/CSS/JS per slide.
2. Regenerate a valid `imsmanifest.xml` for the chosen target version (1.2 or 2004), including organization/item tree, resource hrefs, and completion/mastery settings from `meta`.
3. Bundle content + media + manifest + required schema files into a `.zip` with `jszip` and trigger download (respect the package-name input and the options toggles).
4. Validate the manifest against the chosen schema before download; surface validation errors.

---

## Assets
- **Icons:** hand-built stroke set in `design_reference/icons.jsx` (port verbatim, or use `lucide-react`). Custom shield-check "logo" mark is defined inline in that file.
- **Course imagery:** the prototype uses CSS-gradient **placeholders** (no real images). Real images come from imported packages or user uploads via the Replace-image flow.
- **Fonts:** Google Fonts (Bricolage Grotesque, Hanken Grotesk, Space Mono; optional Fraunces, Space Grotesk).
- No proprietary/brand assets are used.

## Files in this bundle (`design_reference/`)
| File | Contains |
|---|---|
| `SCORM Editor.html` | Entry; font + script load order |
| `styles.css` | **All design tokens**, theme overrides, component classes, animations |
| `data.js` | Sample course document + completion rules + slide-type list (data shapes) |
| `icons.jsx` | Stroke icon set + custom logo mark |
| `app.jsx` | App shell, top bar, all state + mutation logic, history/undo, theming, Tweaks |
| `navigator.jsx` | Left rail, slide cards, drag-reorder, type/status maps |
| `inspector.jsx` | Right panel, all property sections, Toggle control |
| `slide-render.jsx` | Content block renderer + image placeholder + EditText |
| `slide-interactive.jsx` | Quiz + branching renderers (edit + interactive preview) |
| `slide-stage.jsx` | Shared slide-body renderer + LMS player chrome |
| `modals.jsx` | Import screen, Add-slide, Replace-image, Export modals + modal shell |
| `tweaks-panel.jsx` | Tweak-control primitives (reference for the Settings UI) |

**To run the reference:** open `SCORM Editor.html` in a browser (it loads React + Babel from CDN). It is a prototype, not the build target.
