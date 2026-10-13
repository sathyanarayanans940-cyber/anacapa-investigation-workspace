# Repeatable verification

## Clean checkout

Use Node 22.13 or newer:

```sh
npm ci
npx playwright install chromium
npm run validate
```

`validate` builds current source, checks formatting and TypeScript, runs the Node suite, and runs Chromium browser tests. A failed check removes the previous passing report and does not produce a new one. Results include a SHA-256 fingerprint of the tested source in `public/validation/report.json` and `.html`.

Individual commands:

```sh
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:browser
npm run benchmark
```

To test the installed Google Chrome with a disposable browser profile, set `ANACAPA_BROWSER_CHANNEL=chrome` before `npm run test:browser` or `npm run validate`. On macOS/Linux:

```sh
ANACAPA_BROWSER_CHANNEL=chrome npm run validate
```

Chrome must already be installed. CI continues to use its downloaded Chromium. Neither option changes the user's Chrome profile or PWA installation. Native scrollbar rendering is enabled in the browser tests rather than hidden by the headless launch flag.

Node tests rebuild the runtime model first. Browser tests require a production build. Each browser workflow starts a disposable server on an OS-assigned loopback port, with fictional data and temporary case folders. They do not reuse port 5173 or the user's workspace. Failure screenshots, traces, and the browser report are ignored by Git.

## PWA manifest and icon smoke check

`npm test` includes manifest defaults, stable identity, selected/stored appearance overrides, safe input fallbacks, served icon dimensions, and all 104 raster icon assets. It starts its own temporary server.

To check an already running app instead:

```sh
npm run test:pwa -- http://127.0.0.1:5173
```

Any loopback port can be passed; `ANACAPA_BASE_URL` is another option. This checks the install metadata and assets. It does **not** automate browser installation, an OS Dock/Start-menu icon refresh, or browser permission dialogs. The editor has no service worker and needs its Node server; the HTML viewer is the standalone offline artifact.

## Browser coverage

The suite verifies:

- Mobile search, clear, Ctrl K, named timeline controls, Chart/List, and returning to the board.
- Nested navigation, pencil editing, autosave, reload, and per-wire style/colour persistence without changing other wires.
- Desktop search, dragging a card, Undo, and switching Pan/Select with current handlers.
- Per-card resizing at board zoom, fixed opposite corners on rotated notes, cancellation, keyboard adjustments, size limits, automatic reset, Undo/Redo, and save/reload. Compact cards retain full notes in the editor, nested cards resize with Simple controls, and HTML snapshots keep individual board sizes without applying them to timeline cards. Model/API checks cover bounded dimensions, layout-only edits in Advanced mode, placement, wire anchors, and editable package round-trips.
- Folder storage totals in the UI without appending a case revision.
- Theme-coloured scrollbars across all four editor palettes, including settings, timeline areas and text fields; light/dark standalone viewer regions; actual horizontal/vertical wheel scrolling; and system colours when forced-colour accessibility mode is active.
- Type-coloured cards and confidence shades on boards and timelines in all four palettes, with title/body/type text contrast of at least 4.5:1 for the tested combinations. Custom names retain their own hues across case folding and Unicode normalization; priority borders do not alter confidence fills. A confidence edit survives reload without changing its type or pin. Offline HTML retains these cues in light/dark mode.
- Standalone HTML viewing with browser networking disabled at 320, 390, 650, and 1280 pixels: all header controls remain on-screen; relationships, branches, timeline, and report work.

Playwright configuration and locators follow its [official test documentation](https://playwright.dev/docs/test-configuration). Formatting is configured through [Prettier's documented configuration](https://prettier.io/docs/configuration).

## CI and limits

`.github/workflows/verify.yml` configures clean-install formatting, TypeScript, Node tests, production build, and Chromium browser tests on Windows and Linux. Configuration is not a passing hosted run: confirm the actual GitHub Actions result after uploading. Failed browser artifacts are retained for inspection.

These are developer regression checks, not proof of zero bugs. Full keyboard/screen-reader review, browser/OS PWA installation, other browser engines, low-end hardware, independent security review, and operational agency approval are separate work. Existing older manual QA results are historical and must not be presented as fresh tests of this source.
