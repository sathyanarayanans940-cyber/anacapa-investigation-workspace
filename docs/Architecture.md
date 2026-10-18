# Anacapa source map

Anacapa is a local web app. React renders the workspace; a loopback-only Node server owns case folders, originals, accounts, encryption, revisions, and checkpoint journals. Browser appearance preferences stay on the device. There are no cloud accounts or external APIs.

| Location                                                                       | Responsibility                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `app/workspace.tsx`                                                            | Orchestrates current case, views, editing drafts, undo, and protected changes.     |
| `hooks/use-workspace-persistence.ts`                                           | Autosave queue, revision checks, save conflicts, retry, and unload protection.     |
| `hooks/use-case-navigation.ts`                                                 | Branch, board/timeline mode, and transient selection when navigating.                     |
| `hooks/use-board-gestures.ts`                                                  | Pointer capture, drag/cancel, pan, and drag undo boundaries.                 |
| `hooks/use-board-camera.ts`, `lib/board-camera.ts`, `components/board-zoom.tsx` | View framing, pointer-anchored zoom, percentage input, persistent device zoom lock, and viewport resizing. |
| `hooks/use-board-actions.ts`                                                   | Stable scene callbacks that read the current case and tool.                        |
| `components/board-contents.tsx`                                                | Memoized card/wire scene; dialog typing and camera changes can skip its rendering. |
| `components/evidence-card.tsx`, `evidence-editor.tsx`, `connection-editor.tsx` | Card presentation and separate edit dialogs.                                       |
| `components/evidence-search.tsx`                                               | Desktop input and mobile search dialog share one query.                            |
| `components/timeline-*.tsx`, `relationships.tsx`                               | Nested chronology and links between branches.                                      |
| `lib/validation.ts`, `case-data.ts`, `provenance.ts`                           | Shared model, bounded schema, and material-versus-layout change rules.             |
| `lib/card-size.ts` | Per-card resize bounds, rotated/zoomed geometry, compact previews, and anchors. |
| `lib/card-type-tone.ts` | Named type families and stable custom-type hues, shared by editor and exported viewer. |
| `lib/connection-path.ts`, `thread-layout.ts`                                   | Per-wire geometry, endpoint lookup, and label placement.                           |
| `lib/investigation-package.ts`                                                 | Portable case format, original bytes, import validation, and filename rules.       |
| `lib/investigation-viewer*.ts`                                                 | Standalone HTML packaging, readable viewer script, and viewer styles.              |
| `runtime/api.mjs`, `case-store.mjs`, `crypto.mjs`, `checkpoints.mjs`           | Local API, folder persistence, protection, and signed revision records.            |
| `runtime/storage.mjs`, `components/case-storage.tsx`                           | Read-only byte totals; symbolic links are excluded.                                |
| `tests/*.test.mjs`, `tests/browser`                                            | Node/API/model checks and isolated browser workflows.                              |
| `scripts/benchmark.mjs`, `tests/fixtures/scale-case.mjs`                       | Repeatable synthetic performance measurements.                                     |

## Editing and saving

The editor holds a draft until Save. Applying an edit validates the workspace and records an undo boundary. Advanced cases require a reason for material evidence changes. Position, board size, colour, wire shape, and label offsets are layout changes. Dashed uncertainty remains a material relationship property.

`lib/card-size.ts` owns bounded resize geometry, preview density, and wire anchors. Optional `Evidence.boardSize` preserves old automatic layouts, while explicit sizes are validated at 160–720 px wide and 100–640 px tall. Pointer movement is converted through board zoom and card rotation; adjusting position keeps the opposite corner fixed. A completed drag creates one undo entry, and cancellation restores its starting state. Compact previews hide content rather than modifying evidence. Editable packages and shared HTML retain board dimensions; timeline layouts remain separate.

Board viewing state is separate from evidence and case history. Framing uses measured, rotated card bounds and relationship labels with margins for floating controls. Automatic framing waits for font metrics and is cancelled when the user changes the view. Percentage buttons use functional camera updates so rapid clicks accumulate. Non-passive wheel handling prevents a pinch from also zooming the browser page. A device preference stores the locked scale; entering another branch or case centres at that scale, while unlocking restores zoom gestures. Window resizing keeps the world point at the viewport centre without changing scale. Expanded board view hides surrounding app chrome and retains the same zoom.

Autosave sends a workspace revision. A stale revision produces a conflict and keeps the local draft for recovery. One queue drains later edits made while a save is in flight. Case history is permanent; session undo is separate and retains the latest 40 actions. Full revision snapshots and original files occupy disk space over time.

Card fills derive from existing type and confidence values, with no additional persisted colour field. CSS blends each type's palette ink into the base card surface at three confidence strengths. Custom labels use an NFKC-normalized, case-folded name hash for stable hue, saturation, and lightness variation. The viewer embeds the same pure helper. Priority uses the existing pin and a labelled border, independently of confidence. Colour changes follow the four editor palettes and the viewer's light/dark appearance; they do not alter case records.

## Distribution

`npm run package` produces built assets, the Node runtime, and launchers. Users need Node installed, but no npm dependencies or internet after setup. The PWA manifest supplies browser installation and icons. There is no service worker; stopping the local server stops the editor. An exported HTML snapshot embeds its data and viewer, has no server dependency, and cannot modify the source case.

The experimental `desktop/` prototype is separate from the web app and is not included in this release.

## Current design limits

The scene uses ordinary DOM/SVG and is not virtualized. Indexed endpoints and child counts avoid repeated full-case scans; memoization skips unrelated scene updates. A maximum-size flat board still creates many elements. Workspace saves and undo use full copies, and saved history uses full snapshots. See the performance measurements before making scale or hardware claims.

Advanced protection does not establish independent forensic validation or agency approval. See the README and release validation report for the security boundary.
