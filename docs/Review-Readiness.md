# GitHub and portfolio review — 0.4.1

The responsive and verification findings have been addressed. This is a local investigation workspace suitable to present as a software portfolio project with its documented limitations. It is not independently approved for operational evidence handling.

| Review finding                                   | Result                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main search disappears below 700 px              | A labelled search button opens a compact input using the same query. Ctrl/⌘ K works on narrow screens. Nested matches are included; Clear restores the branch.                                                                                                                                                                               |
| Timeline icon controls lack accessible names     | Back to board and Add event have permanent `aria-label` values. The mobile timeline route has a visible label; Chart/List remain available.                                                                                                                                                                                                  |
| Exported viewer header clips                     | The header and controls wrap. Offline browser tests verify Board, Timeline, Report, and Relationships stay on-screen at 320, 390, 650, and 1280 px.                                                                                                                                                                                          |
| Authored source is compressed and tangled        | Prettier formatting is repeatable and checked. Persistence, navigation, gestures, scene callbacks, scene rendering, cards, search, and connection editing have focused modules. Viewer runtime and styles are separate readable sources. TypeScript rejects unused imports and parameters.                                                   |
| PWA smoke and browser workflows are manual       | Manifest/icon checks run in `npm test` on an isolated server; the separate smoke command accepts a base URL. Twenty-two browser workflows cover mobile/desktop search, nested editing, custom types, autosave/reload, per-wire choices, drag/undo/pan, resizing, storage, theme colours, and offline HTML viewing. |
| Scale is claimed without measurement             | Repeatable benchmarks cover 100, 500, 1,000, and 3,000 cards in nested and flat shapes with two links/card. Host details, workload, timings, source fingerprint, and limitations are published. Indexed lookup and memoized scene updates reduce redundant work. Flat maximum-size boards still have a documented performance limit.         |
| Snapshot/original disk use is invisible          | Case records → Storage shows case-folder bytes by category, revision count, and separate checkpoint journal bytes. It is read-only and excludes external backups and app registry/signing keys.                                                                                                                                              |
| Installation language overstates offline editing | README explicitly states that the PWA is an app window/shortcut with no service worker and needs the local Node server. The exported HTML viewer is the standalone offline surface.                                                                                                                                                          |

## Verification evidence

Release validation passed on macOS using the advertised minimum **Node 22.13.0**: **103 Node/API/model tests, 22 Google Chrome browser workflows, TypeScript, formatting, and production build**. The current validation fingerprint includes the storage-accounting correction, theme-coloured scrollbars, per-card resizing, type/confidence colours, and board zoom controls described below. Performance measurements retain their earlier, explicitly recorded source fingerprint and were not rerun for these interface changes. Browser workflows use fictional temporary cases and do not modify the user's investigations.

### Card activation and sub-event arrows - 18 October 2026

Editable board, compact, timeline-chart, and timeline-list card bodies open their evidence editor. The former pencil is a double-arrow for opening the card's sub-events; existing child-count and Add sub-event actions remain available. Enter/Space follow the same behavior. Connect, Tilt, Pan, card dragging, and corner resizing retain their own actions. Read-only accounts open a disabled details view and can still navigate with the arrow. Three browser workflows verify these distinctions and preserve the case data. Help, README, and the 28-page guide use the new instructions; guide screenshots retain their labelled historical interface visuals.

### Board zoom and workspace — 18 October 2026

Board controls now accept exact zoom percentages at 5–400%, accumulate rapid +/− clicks, and prevent delayed automatic framing from overriding manual zoom. A persistent device switch locks the scale across branches, filters, timeline navigation, window resizing, and reopening, with panning and centring still available. Native non-passive wheel handling prevents trackpad pinch from also changing browser page zoom. Expanded board view removes the header/ribbon while preserving the camera scale. Fit measures rotated cards and visible labels, centres them in usable space, and uses measured label bounds rather than assuming every label is 220 px wide. Three isolated Chrome workflows and four Node tests cover these paths without changing evidence or card positions.

### Type and confidence colours — 14 October 2026

The six built-in types have separate muted colour families; custom types have stable colours derived from normalized names. Confidence changes the strength of the fill, while priority retains an independent pin, label, and border. Board, compact-card, timeline, and newly exported HTML presentations use these cues. Existing case data and editable package formats remain unchanged. Two Chrome workflows verify all four editor palettes, text contrast, custom-name consistency, independent priority, save/reload, and light/dark HTML offline. An older timeline body-text rule was corrected after the contrast checks exposed it.

### Card resizing — 13 October 2026

Each editable board card has a corner grip in Select. Width and height save independently per card; compact previews preserve the full evidence, and larger cards reveal more notes. Double-click, the Home key, or the editor’s Reset card size action restores automatic sizing. Keyboard adjustments and Undo/Redo are supported. Connections, label offsets, Fit board, placement, `.anacapa` files, and newly exported HTML honour saved sizes; timeline card styles stay separate. Resizing is a layout change in Advanced cases. Preview text is bounded so a card does not render an entire long record just to clip it.

Four additional Chrome workflows cover resize/save/reload/undo/reset, zoom and rotation, cancellation, nested cards with Simple controls, compact-card navigation, and HTML layout preservation. Model/API tests cover dimension validation, protected-case layout changes, placement, wire anchors, and editable sharing. The existing full suite was rerun on Node 22.13.0. The application and packaged release still use port 5173 by default.

### Scrollbars and Chrome checks — 13 October 2026

The editor and newly exported HTML viewers use thin scrollbars with the active palette's accent colour and transparent tracks. One consistent rule covers timelines, nested regions, dialogs, panels, dropdowns, and text fields, with an older WebKit fallback and system colours for forced-colour accessibility mode. Browser checks verify all four editor palettes, light/dark viewer regions, and actual horizontal and vertical wheel scrolling. The latest validation used the installed Google Chrome with a disposable profile; the user's Chrome profile, cases, and PWA installation were not modified. Existing HTML snapshots need re-exporting to receive new embedded styles. Chrome is the user's current browser and PWA host.

### Storage-accounting correction — 12 October 2026

The external recheck correctly reproduced a seven-byte root file named `constructor` reporting zero bytes. Storage categorization now uses `Object.hasOwn`, so inherited object-property names are counted under `other`. A regression test covers `constructor`, `toString`, `__proto__`, `hasOwnProperty`, `valueOf`, and an inherited-name directory containing a nested `snapshots` directory. Generated storage categories and symbolic-link exclusion remain covered by the existing tests.

GitHub Actions passed on Windows and Linux for commit `b253fc822d4cd5477c33e186e09fba26e6874858` (board zoom). That hosted result predates the card activation changes; confirm the next run after uploading them. The current Google Chrome runs are not fresh Safari/Firefox, Windows VM, screen-reader, or installed-OS-PWA tests.

## Suggested portfolio description

> Built a local investigation workspace with React, TypeScript, and Node.js, supporting nested evidence timelines, configurable relationships, encrypted case folders, signed revision checkpoints, and editable case / standalone HTML exports. Added repeatable model/API and browser regression tests, a Windows/Linux CI workflow, and documented scale and storage measurements.

Mention the features as implemented software capabilities. Avoid “forensic-grade,” “federal-agency ready,” “zero bugs,” or guaranteed low-resource/3,000-card responsiveness on ordinary laptops. Advanced protection has a documented local threat boundary; independent security review and agency approval remain separate.

## Handoff for the upload chat

Read `README.md`, `docs/Architecture.md`, `docs/Verification.md`, and `docs/Performance.md`. Include the new hooks, components, tests, scripts, and `.github` workflow when preparing the commit. Keep case folders, `.anacapa-data`, generated test artifacts, release ZIPs, guide-build caches, and credentials out of Git. The native `desktop/` prototype is a separate experiment; the distributed release is the web app. The resizing/scrollbar update was published as commit `55b107a3b2a3930c7f1460780f540a1d13591e0b`; no résumé was edited.
