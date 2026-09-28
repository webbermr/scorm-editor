# SCORM Editor

A standalone web app for L&D / training administrators to import a SCORM package
(`.zip`), edit every slide (text, images, quizzes, branching scenarios), manage
course structure and completion rules, preview each slide exactly as an LMS would
render it, and re-export an LMS-ready package.

Built to the spec and visual reference in [`design_handoff_scorm_editor/`](./design_handoff_scorm_editor).

## Stack
- **React 18 + TypeScript + Vite**
- **Zustand** stores — one history-wrapped course document drives undo/redo
- **CSS variables + global primitives** for the theming layer (dark mode + 4 accents + 4 font pairings + 3 densities, persisted to `localStorage`)
- **jszip** + **fast-xml-parser** for real SCORM read/write (1.2 and 2004)
- **@dnd-kit** for slide drag-reorder · `contentEditable` for inline editing

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run typecheck
npm run fixture    # regenerate the test SCORM package
```
On launch you land on the **Import** screen — drop a SCORM `.zip`, or click
**“Load the sample course”** to explore with built-in demo content.

## Docker
The app is a static SPA; the image is a multi-stage build (Node builds the Vite
bundle → nginx serves it).

```bash
# build + run with compose (serves on http://localhost:8081)
docker compose up --build -d

# …or with plain docker
docker build -t scorm-editor .
docker run -d -p 8081:80 --name scorm-editor scorm-editor
```

Then open **http://localhost:8081**. (The published port is set in `docker-compose.yml`.)

> **Heads-up — the “View Original” feature needs a secure context.** It relies on a
> service worker + Cache API, which browsers only allow over **HTTPS** or
> **`localhost`**. Accessing the container via `http://localhost:8081` works; over a
> plain `http://<server-ip>` it won't (import/edit/export still work, but “View
> Original” shows a fallback message). For remote/production use, put the container
> behind a TLS-terminating reverse proxy (Caddy, Traefik, nginx, a load balancer, …).

nginx is configured ([`nginx.conf`](./nginx.conf)) to never cache `index.html` /
`scorm-sw.js` (with `Service-Worker-Allowed: /`), cache hashed `/assets/` immutably,
and fall back to `index.html`. Build context excludes `node_modules`, `dist`, and
sample `.zip`s via [`.dockerignore`](./.dockerignore).

### Deploying with Cloudflare Tunnel (trusted HTTPS for remote users)
Because **“View Original” needs a secure context** (HTTPS or `localhost`), serving the
container to other devices over plain `http://<ip>` disables it. A
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
gives you a real HTTPS hostname with no port-forwarding and no certificates to install.
The `cloudflared` connector is already defined in `docker-compose.yml` behind a
`tunnel` profile.

One-time Cloudflare setup:
1. Add your domain to Cloudflare (set its nameservers to the ones Cloudflare assigns).
2. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, name it, and copy the **token**.
3. Add a **Public Hostname**: e.g. `scorm.yourdomain.com`, Service **HTTP**, URL **`scorm-editor:80`** (the app's container name + internal port).
4. *(Recommended)* **Access → Applications → Self-hosted** for that hostname with an email allow-list, so only your people can open it.

On the server:
```bash
git clone https://github.com/webbermr/scorm-editor.git
cd scorm-editor
echo 'TUNNEL_TOKEN=eyJ...your-tunnel-token...' > .env   # secret; .env is git-ignored
docker compose --profile tunnel up -d --build            # starts app + tunnel
docker compose logs -f cloudflared                       # look for "Registered tunnel connection"
```
Your users then open `https://scorm.yourdomain.com`. The token lives only in `.env`
(git-ignored) — never commit it; rotate it by recreating the tunnel if it leaks.
Plain local runs (`docker compose up -d`, no profile) don't start the tunnel and need
no token.

#### Replacing an older deployment
The containers have fixed names (`scorm-editor`, `scorm-editor-tunnel`), so a new
clone can't start while an older deployment in another folder is still running.
Stop the old one first, and reuse its `.env`:
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
Check the result with `docker ps` (`scorm-editor` should be **healthy**); the start
screen shows the **Build Date & Time** of the build you're running.

#### Running more than one host behind the same tunnel
A tunnel can have several connectors (e.g. two machines each running this compose
stack with the same `TUNNEL_TOKEN`); Cloudflare then spreads requests between them.
**Every host must run the same commit.** A page served by one host can request its
hashed `/assets/index-*.js` from another, and if the hosts are on different versions
that file doesn't exist there and the app fails to load. So update every host
together (`git pull` + rebuild on each), then check they serve the same bundle:
```bash
curl -s localhost:8081/ | grep -o 'assets/index-[^"]*\.js'   # must print the same name on every host
```
Builds are reproducible — the same commit produces the same asset names on any
machine — because nothing build-specific goes into the bundle (the build timestamp
lives in a separate, uncached `build-info.json`). Keep it that way: don't inject
per-build values into the bundle.

## What's real (not mocked)
- **SCORM import** — genuine unzip → parse `imsmanifest.xml` → detect 1.2 vs 2004 →
  map the organization/item tree to slides → extract media to object URLs →
  decompose HTML into editable blocks (nav/header/footer chrome stripped). Handles
  three real-world package shapes: per-item SCOs, **single-SCO multi-page** packages
  (content pages enumerated as `<file>`s or pulled in via `<dependency>` resources —
  each becomes its own slide), and **runtime-rendered** tool output (e.g. Lectora),
  where readable text is recovered from the page's scripts and shared player
  boilerplate is filtered out. Anything that still can't be decomposed is kept as a
  read-only, previewable **raw-HTML block** and flagged. Progress + error states
  included. See [`src/scorm/import/`](./src/scorm/import).
- **SCORM export** — two modes ([`src/scorm/export/`](./src/scorm/export)):
  - **Faithful copy — original look** (default): re-packages the imported source with
    every asset and its original design, patching the manifest title / passing score.
    For **Lectora** courses, pages you deleted are actually removed by rewiring the
    course — each removed page's `trivNextPage`/`trivPrevPage` neighbors are re-pointed
    past it, the `PageInChapter`/`PagesInChapter` counters renumbered, the
    table-of-contents `NewLink` and manifest `<file>` entries pruned, and the file
    dropped — so the trimmed course still looks and works like the original. (See
    [`src/scorm/export/lectoraEdit.ts`](./src/scorm/export/lectoraEdit.ts).) Reordering
    isn't applied; non-Lectora courses are kept whole.
  - **Rebuilt — clean simplified course**: builds a brand-new, LMS-importable course
    from the *edited* slide list — deletions and reordering applied — one page + manifest
    item per remaining slide, with each slide's recovered text plus media (content images
    + narration audio) extracted from its source page; shared UI chrome (logos/buttons)
    filtered out. A plain, simplified layout (not the original design). The manifest is
    regenerated for the chosen version (1.2 or 2004) and validated.

**LMS Preview** — because runtime-rendered packages (e.g. Lectora) can only be
*decomposed* to text, each imported slide also offers a **Blocks / LMS Preview**
toggle, with **Full screen** and **Open in new tab** buttons. These render the real imported
page(s) in an iframe served by an in-app file server (a service worker backed by the
Cache API, see [`src/scorm/preview/`](./src/scorm/preview) + [`public/scorm-sw.js`](./public/scorm-sw.js)),
so you see the source course with full fidelity — images, layout, scripts — exactly
as the LMS would run it.

Everything else (navigator, inline editing, inspector, quiz/branching editors,
LMS preview, undo/redo, theming, modals, toasts) is fully working app logic.

## Verifying import/export
A small real SCORM 2004 package lives at
[`src/scorm/fixtures/test-scorm.zip`](./src/scorm/fixtures) (regenerate with
`npm run fixture`). Two dev hooks exercise the real pipeline in the browser:

- `…/?demo=roundtrip` — imports the fixture, exports to **both** 2004 and 1.2,
  re-imports each, and prints a pass/fail report (round-trip verification).
- `…/?demo=import` — loads the fixture straight into the editor.

## Project layout
```
src/
  types/course.ts        # the course document model + all action types
  store/                 # courseStore (history), uiStore, prefsStore (theming)
  styles/                # tokens.css + globals.css (ported design tokens)
  components/
    shell/ navigator/ canvas/ interactive/ preview/ inspector/ modals/ ui/
  scorm/import/  scorm/export/  scorm/fixtures/
  lib/                   # ids, type maps, editor actions, keyboard shortcuts
```

## Keyboard shortcuts
`⌘/Ctrl+Z` undo · `⇧⌘/Ctrl+Z` (or `Ctrl+Y`) redo · `⌘/Ctrl+S` save ·
`←/→` navigate slides in Preview · `Esc` close modals. Honors
`prefers-reduced-motion`.
