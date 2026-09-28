# SCORM Editor

A standalone web app for L&D and training administrators to import a SCORM package
(`.zip`), trim and edit it, preview it exactly as an LMS would run it, and export an
LMS-ready package again. It works with any SCORM 1.2 or 2004 package, and has deep
support for **Lectora** courses: deleting slides and sections while keeping the
original design and navigation working, editing text in place, and cleaning out
media nothing uses.

Everything runs in the browser. Packages never leave the user's machine.

- [Features](#features)
- [Run locally](#run-locally)
- [Deploy with Docker](#deploy-with-docker)
- [Development](#development)

## Features

### Import
- Drag a `.zip` onto the start screen (or click to browse), or **Load the sample
  course** to explore with demo content.
- Reads `imsmanifest.xml` (SCORM **1.2** and **2004**, manifest at the root or in a
  subfolder) and turns the course into slides. Handles one-SCO-per-item packages,
  single-SCO packages with many pages (each page becomes a slide), and pages that
  authoring tools build at runtime, whose text is recovered from the page's scripts.
- Detects the authoring tool (Lectora, Articulate Storyline / Rise, Adobe Captivate,
  iSpring, Adapt, dominKnow, Elucidat, Gomo, Easygenerator, Camtasia, Dreamweaver, or
  whatever the manifest names) and shows it as a badge in the header.
- **Lectora courses:**
  - Slides are listed in course order: from the page the course opens on, along its
    Next buttons, then pages reached from menus.
  - Slides are grouped into the course's **sections**, taken from its table of
    contents.
  - The table-of-contents panel page isn't listed as a slide.
  - The header shows whether the course **test is encrypted** (Not encrypted /
    Encrypted test / Encrypted test · locked). When the course's own key unlocks it,
    deleted test questions are removed from the test too.
- Anything that can't be turned into editable blocks is kept read-only and the slide
  is flagged **partial import**.

### Slide list
- Slides are grouped by **section**, collapsed to start with, with **Expand all /
  Collapse all**. Each section header can collapse its section, tick all its slides,
  or **delete the whole section** (with confirmation; undoable). Courses without
  sections show a flat list.
- Tick slides to select them: click the tick box, ⌘/Ctrl-click, or shift-click to
  select a range from the last slide you clicked. Then **Delete** from the toolbar or
  with the Delete key.
- Drag to reorder, **Duplicate**, **Add slide** (Content, Video, Quiz, Scenario or
  Title), and a status dot per slide (Not started / In progress / Complete).

### Slide view
Each imported slide has two views:
- **Blocks:** the slide's content as editable blocks (eyebrow, heading, paragraph,
  list, image, callout, video). Text is edited inline. Images can be replaced (PNG,
  JPG, SVG, WebP, GIF) and captioned. Imported HTML that couldn't be converted is
  shown read-only.
- **LMS Preview:** the real imported page, rendered from the original package exactly
  as an LMS would run it: images, narration, layout and scripts. While the course
  plays (Next, narration auto-advance, menus), the slide list and "Slide n of n"
  follow the slide that's playing. The toolbar adds:
  - **Edit text** (Lectora): click any text on the page to edit it in a popover. The
    page updates as you type; multi-paragraph text and lists keep their structure,
    and links laid over the text move with their words (or are disabled if their
    words are deleted). Edits apply to the Faithful-copy export.
  - **Full screen:** the course in a large window, with **Restart course** to play it
    from its start page.
  - **Open in new tab.**

  LMS Preview needs HTTPS or `localhost` (see [Deploy](#deploy-with-docker)).

**Quizzes:** edit the prompt, questions and options, mark the correct option, and
add or remove questions and options. **Scenarios:** edit the setup and each choice,
and rate each choice Best / Risky / Unsafe.

Courses without an imported package (the sample course, or one built from new
slides) get an **Edit / Preview** switch in the header, with a click-through player.

### Inspector
Toggle it from the header. It shows settings for the selected block (callout tone,
delete block), the slide (name, status, estimated time, add block), quizzes (shuffle
questions, show feedback, single or multi-question) and the course (completion rule:
Completed + Passed / Passed only / Completed only / Visited; passing score; track time
spent; allow review after pass).

### Export
**Export** builds a new package and validates it before you download it. Two modes:

- **Faithful copy — original look** (recommended). Re-packages the original course
  with its design, player, images and narration, and applies:
  - text changed with **Edit text**
  - the course title and passing score
  - **deleted slides and sections (Lectora).** The course is rewired so it still
    works: Next/Prev buttons, narration auto-advance and Back actions skip deleted
    pages and never point at their own page (which would replay the slide forever);
    "page X of Y" counters are renumbered; the table of contents drops deleted pages
    and empty sections; deleted question pages come out of the course test;
    and the launcher opens the first remaining page. Table-of-contents pages that
    remaining slides display are always kept.
  - **media cleanup:** images, audio and video used only by deleted slides are
    removed, along with their manifest entries. Files anything else still mentions
    are kept.

  Reordering and new slides aren't applied in this mode, and other authoring tools
  keep every page.
- **Rebuilt — clean simplified course.** Builds a new course from the edited slide
  list (deletions, reordering and new slides applied): one plain page per slide with
  its text, images and narration. It won't look like the original.

Options:
- **Remove unused media** (Faithful copy; on by default for Lectora). Also leaves out
  media that nothing in the course uses, which authoring tools often publish (e.g.
  other modules' narration). The dialog shows how much smaller the package gets
  before you build it. It checks every page, script and data file, including the
  decrypted course test, and is skipped if a test can't be read.
- **Unlock … from the start** (shown when needed). Some Lectora courses lock a feature
  until the learner reaches a page; for example the table of contents unlocks on
  "Module Summary Results". If you delete that page, the dialog warns you and offers
  to start the feature unlocked (on by default) so it isn't locked for good.
- Package name, SCORM version (Rebuilt only; a Faithful copy keeps the original's),
  **Maximum compression**, and **Include editor data** (`course.json`).

Before download, the package is checked: the manifest is present and parses, the
course has a launchable item, every file the manifest references is in the package,
resource types and launch files look right, and the SCORM version is consistent.
Warnings cover things like letter-case mismatches, very large packages, media kept
from deleted slides, and links that would point a page at itself.

### Saving and preferences
- **Autosave:** the course and the original package are saved in the browser
  (localStorage and IndexedDB) shortly after every change, so a page refresh keeps
  your work. **Save** saves immediately; **New** discards it and starts over.
- **Settings:** accent colour, dark mode, font pairing and density, saved per browser.
- The start screen shows the **Build Date & Time** of the running version.

### Keyboard shortcuts
| Keys | Action |
|---|---|
| ⌘/Ctrl+S | Save |
| ⌘/Ctrl+Z | Undo |
| ⇧⌘/Ctrl+Z or Ctrl+Y | Redo |
| Delete / Backspace | Delete the ticked slides |
| Esc | Untick slides / close dialogs |
| ← / → | Previous / next slide (Preview mode) |

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run typecheck
```

## Deploy with Docker
The app is a static single-page app. The image is a multi-stage build: Node builds the
Vite bundle, then nginx serves it on port **8081**.

```bash
docker compose up --build -d        # http://localhost:8081
# or plain docker:
docker build -t scorm-editor .
docker run -d -p 8081:80 --name scorm-editor scorm-editor
```

> **LMS Preview needs a secure context.** It uses a service worker, which browsers only
> allow over **HTTPS** or on **`localhost`**. Over plain `http://<server-ip>`, import,
> editing and export still work but LMS Preview doesn't. For remote users, serve it over
> HTTPS, e.g. with the Cloudflare Tunnel below or any TLS reverse proxy.

[`nginx.conf`](./nginx.conf) never caches `index.html`, `scorm-sw.js` or
`build-info.json`, caches the hashed `/assets/` files forever, and falls back to
`index.html` for other paths.

### Cloudflare Tunnel (HTTPS for remote users)
A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
gives the app a real HTTPS hostname with no port-forwarding or certificates. The
`cloudflared` connector is already in `docker-compose.yml` behind the `tunnel` profile.

One-time Cloudflare setup:
1. Add your domain to Cloudflare.
2. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, name it, and copy the **token**.
3. Add a **Public Hostname**, e.g. `scorm.yourdomain.com`, Service **HTTP**, URL **`scorm-editor:80`**.
4. *(Recommended)* **Access → Applications → Self-hosted** for that hostname, with an email allow-list.

On the server:
```bash
git clone https://github.com/webbermr/scorm-editor.git
cd scorm-editor
echo 'TUNNEL_TOKEN=eyJ...your-tunnel-token...' > .env   # secret; .env is git-ignored
docker compose --profile tunnel up -d --build            # starts app + tunnel
docker compose logs -f cloudflared                       # look for "Registered tunnel connection"
```
Never commit the token; recreate the tunnel if it leaks. Without `--profile tunnel`,
only the app starts and no token is needed.

#### Replacing an older deployment
The containers have fixed names (`scorm-editor`, `scorm-editor-tunnel`), so stop an
older deployment in another folder first, and reuse its `.env`:
```bash
cd /path/to/old/scorm-editor && docker compose --profile tunnel down
#   (or, from anywhere: docker rm -f scorm-editor scorm-editor-tunnel)
git clone https://github.com/webbermr/scorm-editor.git
cd scorm-editor
cp /path/to/old/scorm-editor/.env .
docker compose --profile tunnel up -d --build
```

#### Updating
```bash
cd scorm-editor
git pull
docker compose --profile tunnel up -d --build
```
`docker ps` should show `scorm-editor` as **healthy**, and the start screen shows the
new build date.

#### More than one host behind the same tunnel
A tunnel can have several connectors (machines running this stack with the same
`TUNNEL_TOKEN`), and Cloudflare spreads requests between them. **Every host must run
the same commit.** A page from one host can request its hashed `/assets/index-*.js`
from another; if they run different versions, that file doesn't exist there and the
app fails to load. Update all hosts together, then check they serve the same bundle:
```bash
curl -s localhost:8081/ | grep -o 'assets/index-[^"]*\.js'   # must match on every host
```
The same commit builds the same asset names on any machine, because nothing
build-specific goes into the bundle (the build time lives in a separate
`build-info.json`). Keep it that way.

### Prebuilt package (no build on the server)
To deploy without building on the target machine (or when it has a different CPU type
from yours), make a prebuilt package:
```bash
npm run package:deploy      # -> scorm-editor-deploy-<commit>.zip
```
It contains the built site, `nginx.conf`, and a compose file that serves the site with
the stock `nginx` image, plus [`deploy/DEPLOY.txt`](./deploy/DEPLOY.txt) with
instructions. On the server: stop the old containers, extract the zip, copy in `.env`,
and run `docker compose --profile tunnel up -d`. To update, replace the `site` folder
and run the same command.

## Development
Dev URLs exercise the real pipeline in the browser:
- `…/?demo=roundtrip` — imports the fixture, exports to SCORM 2004 and 1.2, re-imports
  each, and prints a pass/fail report.
- `…/?demo=import` — loads a package from `public/` into the editor
  (`&file=name.zip&slide=N`; defaults to the bundled test package).

The test package lives at [`src/scorm/fixtures/test-scorm.zip`](./src/scorm/fixtures)
(regenerate with `npm run fixture`).

### Stack
- **React 18 + TypeScript + Vite**
- **Zustand** stores; one history-wrapped course document drives undo/redo
- **jszip** + **fast-xml-parser** for SCORM read/write; **crypto-js** for Lectora test decryption
- **@dnd-kit** for drag-reorder
- CSS variables for theming

### Project layout
```
src/
  types/course.ts        course document model
  store/                 courseStore (history), uiStore, prefsStore, previewStore, draft (autosave)
  styles/                design tokens + global styles
  components/
    shell/ navigator/ canvas/ interactive/ preview/ inspector/ modals/ ui/
  scorm/
    import/              unzip, manifest, tool detection, HTML → blocks, text recovery
    export/              packaging, Lectora rewiring (lectoraEdit.ts), media cleanup, validation
    edit/                Lectora in-place text edits, test decryption
    preview/             service-worker file server for LMS Preview, inline text editing
  lib/                   ids, editor actions, keyboard shortcuts
deploy/                  prebuilt-package compose file + instructions
scripts/                 fixture generator, prebuilt-package script
```

Design reference: [`design_handoff_scorm_editor/`](./design_handoff_scorm_editor).
