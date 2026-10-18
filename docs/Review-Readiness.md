# Anacapa 0.4.1 review notes

This release improves mobile controls, case storage reporting, board navigation, and automated checks. Anacapa runs locally; independent validation for operational evidence handling remains outside the scope of these checks.

| Review finding                                   | Result                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main search disappears below 700 px              | A labelled search button opens a compact input using the same query. Ctrl/⌘ K works on narrow screens. Nested matches are included; Clear restores the branch.                                                                                                                                                                               |
| Timeline icon controls lack accessible names     | Back to board and Add event have permanent `aria-label` values. The mobile timeline route has a visible label; Chart/List remain available.                                                                                                                                                                                                  |
| Exported viewer header clips                     | The header and controls wrap. Offline browser tests verify Board, Timeline, Report, and Relationships stay on-screen at 320, 390, 650, and 1280 px.                                                                                                                                                                                          |
| Authored source is compressed and tangled        | Prettier formatting is repeatable and checked. Persistence, navigation, gestures, scene callbacks, scene rendering, cards, search, and connection editing have focused modules. Viewer runtime and styles are separate readable sources. TypeScript rejects unused imports and parameters.                                                   |
| PWA smoke and browser workflows are manual       | Manifest/icon checks run in `npm test` on an isolated server; the separate smoke command accepts a base URL. Twenty-two browser workflows cover mobile/desktop search, nested editing, custom types, autosave/reload, per-wire choices, drag/undo/pan, resizing, storage, theme colours, and offline HTML viewing. |
| Scale measurements were missing                  | Repeatable benchmarks cover 100, 500, 1,000, and 3,000 cards in nested and flat shapes with two links/card. Host details, workload, timings, source fingerprint, and limitations are published. Indexed lookup and memoized scene updates reduce redundant work. Flat maximum-size boards still have a documented performance limit.         |
| Snapshot/original disk use is invisible          | Case records → Storage shows case-folder bytes by category, revision count, and separate checkpoint journal bytes. It is read-only and excludes external backups and app registry/signing keys.                                                                                                                                              |
| Installation language overstates offline editing | README explicitly states that the PWA is an app window/shortcut with no service worker and needs the local Node server. The exported HTML viewer is the standalone offline surface.                                                                                                                                                          |

## Verification evidence

Release validation passed on macOS using the advertised minimum **Node 22.13.0**: **103 Node/API/model tests, 22 Google Chrome browser workflows, TypeScript, formatting, and production build**. The current validation fingerprint includes the storage-accounting correction, theme-coloured scrollbars, per-card resizing, type/confidence colours, and board zoom controls described below. Performance measurements retain their earlier, explicitly recorded source fingerprint and were not rerun for these interface changes. Browser workflows use fictional cases in temporary folders.

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

The editor and newly exported HTML viewers use thin scrollbars with the active palette's accent colour and transparent tracks. One consistent rule covers timelines, nested regions, dialogs, panels, dropdowns, and text fields, with an older WebKit fallback and system colours for forced-colour accessibility mode. Browser checks verify all four editor palettes, light/dark viewer regions, and actual horizontal and vertical wheel scrolling. Validation used Google Chrome with a disposable profile, separate from existing cases and PWA installations. Existing HTML snapshots need re-exporting to receive new embedded styles.

### Storage-accounting correction — 12 October 2026

The external recheck correctly reproduced a seven-byte root file named `constructor` reporting zero bytes. Storage categorization now uses `Object.hasOwn`, so inherited object-property names are counted under `other`. A regression test covers `constructor`, `toString`, `__proto__`, `hasOwnProperty`, `valueOf`, and an inherited-name directory containing a nested `snapshots` directory. Generated storage categories and symbolic-link exclusion remain covered by the existing tests.

GitHub Actions passed on Windows and Linux for commit `98b03d8fc9a2fe009c28461af929fa0097db7d4e`, including the card activation changes: [workflow run](https://github.com/sathyanarayanans940-cyber/anacapa-investigation-workspace/actions/runs/39121776305). The current Google Chrome runs do not cover Safari/Firefox, a Windows VM, screen readers, or OS-level PWA installation.

## Scope

Anacapa supports nested evidence timelines, configurable relationships, encrypted case folders, signed revision checkpoints, editable case files, and standalone HTML exports. Model/API tests, browser workflows, Windows/Linux CI, and performance measurements cover the behaviors described in the linked verification documents.

Advanced protection has a local threat boundary described in the README. The performance results apply to the recorded hardware and workloads; responsiveness on slower devices and independent security review remain unverified.

## Packaging

`npm run package` builds the web app and local server using an explicit file allowlist. Case folders, `.anacapa-data`, generated test artifacts, release ZIPs, guide-build caches, and credentials are excluded from Git. The native desktop prototype is a separate experiment and is not distributed here. See [verification](Verification.md), [architecture](Architecture.md), and [performance](Performance.md) for development details.
