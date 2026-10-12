# Anacapa 0.3.1 feature check

Checked on 10 October 2026 on macOS, in the Codex browser and the installed Brave PWA. Browser changes used fictional investigations in a separate temporary registry and case folders. The user's investigation was not edited.

## Bugs reproduced and fixed

- **Evidence editor could not scroll:** the form's `fieldset` was also its scroll container. Its content overflowed but wheel input left `scrollTop` at zero. A separate, focusable scrolling region now surrounds the disabled/enabled fieldset, while the header and Save footer remain fixed.
- **Advanced Undo lost Redo:** approving the required change reason treated an undo as a new edit and cleared the redo stack. The pending action now keeps its edit/undo/redo identity through the reason dialog.
- **New-evidence shortcut inserted `n`:** the shortcut's default input reached the newly focused Name field. The shortcut now prevents that default and ignores modified N shortcuts.
- **Calendar could exceed a short window:** the popover now uses both the viewport and the available popover height and scrolls internally when necessary.

## Browser checks

| Feature | Observed result |
| --- | --- |
| Evidence editor | Wheel scrolling reaches the last fields; Save stays visible. All accordions expanded at 1024 × 600: content 2647 px, scrolling area 347 px, final scroll position 2300 px, footer bottom 579 px. |
| Narrow editor | All sections expanded at 390 × 600: scrolling reaches the bottom, and the document remains 390 px wide. |
| Installed PWA | Reloaded the existing PWA, opened the unchanged evidence draft, reached the lower sections with keyboard scrolling, opened Appearance, then closed without saving. |
| Evidence and notes | Created, edited, reopened, and deleted fictional items. Normal-mode Undo restored a deleted note; Undo/Redo restored a new sub-event. |
| Custom types and headlines | Saved an Interview type, an Exhibit field, field-based card headline, tags, confidence, and pin state. Reopened values persisted. |
| Citations | Saved source name, exhibit reference, page, supported statement, collector, collection date/zone, and collection method. Reopened values persisted. |
| Attachments | Uploaded a fictional text original through the file chooser; its preserved-original label and SHA-256 were displayed. |
| Dates and time | Typed and picked dates; navigated calendar months; used Today, time input, and Done. End-before-start was rejected. UTC offset, approximate precision, and original timestamp persisted. Time numbers were centered. |
| Short-window calendar | Popover fit inside the viewport and scrolled internally to its lower controls. |
| Nested timelines | Navigated three nested levels, created a deeper child, and returned through the compact ancestor lines. |
| Timeline center stage | Chart and List opened; cards could be placed above/below the line and use a note style. Horizontal event navigation and chronological scrolling worked. |
| Cross-timeline relationships | Shared-field suggestions found common container identifiers. Created a cited, dashed relationship between different branches and reopened it. |
| Relationship editor | A long citation form scrolled to Save. Existing connections could be edited. |
| Board tools | Dragged a card, panned the board, connected two cards, changed tilt by 1°, reset tilt, zoomed, and fitted the board. |
| Movable connection labels | Dragged a label and moved it with an arrow key; its offsets changed and persisted. |
| Search and filters | Search by custom field returned the matching item; clear, pinned-only, and connecting-thread visibility controls worked. |
| Appearance | Light, Dark, and System controls worked. Tested palette and icon changes, automatic dark icon selection, and explicit light-icon override. Settings scrolled at 390 px width. |
| New case | Name and folder were required. Created a Normal case through the folder picker, added its first note, and changed its description. Advanced setup scrolled to its final fields. |
| Case records | History scrolled; integrity checks passed; recorded a fictional custody transfer; created a complete folder backup; restored an older version as a new revision with a reason. |
| Advanced editing | Wrong credentials rejected; existing administrator unlocked. A material edit required a reason. Edit → Undo → Redo worked, with a distinct recorded reason for each action. |
| Lock and Viewer | Manual Lock hid case contents. Existing Viewer credentials opened read-only content: write tools were disabled, sub-event creation hidden, and the disabled evidence form still scrolled. |
| Sharing selection | Clearing selection disabled export. Selected one item, omitted Notes, and downloaded editable and HTML exports. Independent export checks confirmed omitted notes/history and retained attachment bytes. |
| Protected sharing | Advanced exports required encryption. Invalid sharing passphrases were rejected; encrypted editable and HTML downloads completed. |
| Reopening an investigation | Opened an encrypted `.anacapa` through the real file chooser, unlocked it, chose a folder, and created an independent case with its 11 nodes. |
| Standalone HTML | Wrong passphrase rejected; correct passphrase opened the local viewer. Board, details, nested branch, Timeline, and Report worked. The long Report scrolled. |
| Help | Tutorial links and the expanded tools reference were present; the long help dialog scrolled. |
| N shortcut | Opened New evidence with an empty Name field after the fix. |

## Automated checks

`npm test`: **42 passed, 0 failed**. `npm run typecheck`: **passed**. Production build and shareable-folder packaging: **passed**.

The automated suite covers data validation, timeline placement, thread-label geometry, relationships, date handling, appearance/PWA assets, portable packages, and the local server. Security tests cover encrypted case contents and originals, wrong credentials, restart locking, required reasons, Viewer write rejection, expired sessions, account revocation, authenticated history, corrupt snapshots, version restore, complete backups reopened in a fresh registry, protected exports, and imported custody/history.

Local account creation/revocation and simulated session expiry were checked by automated store/API tests; the browser pass used pre-created fictional accounts. The ten-minute idle timer was not observed by waiting ten real minutes. System preference changes are covered by mocked appearance tests; the browser check verified the System setting against the current device preference. All icon assets loaded.

## Scope limits

This pass does not verify Windows/Linux launchers, physical printing, instant changes to OS-managed installed-app icons, or maximum-size investigations. It is a functional regression pass, not an independent security audit or agency certification.

The temporary practice registry and browser tabs were removed after the pass. The main local server was left running.

## Settings and editor styling follow-up

The settings window now uses the palette's input border instead of inheriting the text colour. The editor footer uses a 59 px row, an inset divider, compact 34 px controls, Cancel beside Save, and a subdued Delete action.

Checked in a separate fictional registry: settings border colours matched Dusk and Linen; Save persisted an edit; Cancel discarded a changed draft; Delete opened its existing confirmation; Add evidence created an item. At 390 × 600, both new-evidence actions stayed inside the dialog, the footer stayed visible at 587 px, and the form still scrolled. Typecheck and production packaging passed. The user's open evidence draft was left untouched.


## Fresh audit — 11 October 2026, version 0.3.2

All work used fictional practice cases in an isolated local registry. The user's investigation was not edited.

### Issues found and fixed

- Starting a connection and switching cases could crash rendering because the selected source belonged to the previous case. Case transitions now clear tool selections; rendering also tolerates a source removed by undo or deletion.
- Correcting an invalid typed date with the calendar kept an old browser validation error. Valid typed dates could also be lost when pressing Enter. Calendar corrections reset validation, valid typing updates the draft immediately, and invalid clock times cannot close the picker. Imported timestamps retain their explicit zone and untouched seconds when edited.
- Stored date validation accepted impossible calendar dates such as 30 February. Imports and saves now reject calendar overflow, duplicate connection IDs, and duplicate source IDs. Evidence fields are checked before an invalid draft can enter the workspace.
- A stale save left Retry ineffective and prevented exporting the unsaved version. Conflict recovery now offers a download of this window's current cards and attachments, followed by an explicit discard-and-load confirmation. Advanced recovery copies remain encrypted. Recovery exports exclude server history and custody.
- Timeline type/pin filters hid matching descendants under non-matching parents. Both Chart and List show matching items from the relevant branch. Board Fit now fits the displayed search/filter results.
- Native hidden form controls escaped the editor's scroll container and pulled the whole dialog upward when focusing lower fields. They now have local positioning anchors. Verified that the inner form scrolls while dialog scroll stays zero and header/actions remain visible.
- In HTML exports, the generic card class also applied absolute board positioning to timeline event containers. Cards overlapped and controls could open a covered card's branch. Timeline styles now have distinct names. Seven root events occupied seven separate columns, and opening the delivery's two sub-events showed the delivery branch, then the container branch.
- HTML Fit now measures actual card heights, rotation, and placed labels. Report and detail views retain end dates and time-zone information.
- The restore API accepted an omitted reason. Reasons are now required, trimmed, and bounded at the store boundary.
- A missing/corrupt case folder blocked the entire workspace. It now appears as an unavailable, read-only case while other cases remain usable. A moved folder can be reattached when its old location is missing; intact originals and history are preserved.
- Save requests now share an in-flight promise so actions waiting for a save do not fail just because autosave is already running. Keyboard shortcuts respect dialogs and modifier keys. Protected relationship changes no longer announce success before their reason is applied.

### Browser workflows checked

- Normal case creation and folder choice; editable import into a new folder; custom evidence type, configurable headline, tags, pinning, file upload and source citation; nested sub-events through four levels; deletion and Undo; cancellation.
- Case switching while a connection source is selected; Chart/List document filtering including nested matches; parent collapse into lines; Above/Compact arrangements; tilt; relationship label movement; Undo/Redo; search and Fit.
- Shared-detail suggestions and a saved relationship between two separate subtimelines; file attachment and hash persisted through editable export/import.
- Concurrent windows: one saved a source change; the second retained its conflicting draft, downloaded a recovery copy, and loaded the latest saved source after confirmation.
- Plain HTML: Board, Timeline, nested branches, details, custom headline, sources, attachment link, Relationships, Report, and absence of edit controls. Protected HTML decrypted using a fictional pre-existing sharing passphrase.
- Advanced case unlock, required edit reason, discarded protected Undo, enforced encryption in sharing, history, integrity verification, custody transfer, restore as a new revision, and complete encrypted backup. A pre-created Viewer account could inspect evidence while Add, Undo, fields and Save were disabled.
- Settings: light/dark/system, palette selection, icon selection, automatic dark variant and explicit light override. Editor focus/scroll checked at the actual 760 × 832 browser surface: dialog scroll 0, content scroll 631 px, header visible at 21 px, footer inside the dialog at 752–811 px.

### Automated checks and limits

`npm test`: **50 passed, 0 failed**. `npm run typecheck`: **passed**. Production build/package and whitespace checks passed. Tests include expired/revoked accounts, encrypted originals, corrupt snapshots, stale writes, missing/moved folders, sharing redactions, strict dates and restore reasons.

The requested responsive viewport override was not reflected by this browser provider, so this audit does not claim a fresh 390 px viewport check. The earlier responsive audit remains recorded above. Windows/Linux launchers, physical printing, maximum-size cases, OS-managed PWA icon refresh and a ten-real-minute idle wait remain outside this pass. This is functional regression testing, not an independent security certification.

Proof images: `output/qa/editor-scroll-fixed.png`, `output/qa/html-timeline-fixed.png`, and `output/qa/save-conflict-recovery.png`.

## Windows and boundary audit — 11 October 2026, version 0.3.3

Used only the authorized Parallels VM **Windows 11 - Main**, Windows 11 ARM64, with its existing Node.js 24.14.0 and Chrome. All guest investigations and downloads were fictional, under a dedicated temporary QA directory. The user's real investigation was not edited. VM networking and host folder sharing were left unchanged.

### Issues fixed

- Correcting an invalid calendar clock by typing the original valid timestamp could leave stale validation behind. Typed corrections now synchronize the clock and clear its invalid state; reproduced and retested on Windows.
- A save awaited by export, case switching, or locking could finish before edits made during that request were saved. The save queue now drains subsequent changes, and retains the dirty draft if any request fails.
- Large valid investigations exceeded the local API's old 4 MiB workspace request cap. It now permits up to 80 MiB while retaining schema limits, including 3,000 cards and 6,000 connections per case. A 6.4 MB workspace saved and reloaded in tests; an extra card was rejected without overwriting the saved case.
- Deep parent validation and repeated branch-path searches caused multi-second stalls. Indexed iterative traversal now supports the full 3,000-level hierarchy, rejects cycles and missing parents, and preserves complete branch labels. Relationship suggestions avoid computing every full path for an empty search.
- Date-only events could sort incorrectly; explicit source zones could disagree with displayed dates or separately stored UTC offsets. Chronology, ribbon, timeline, editor and HTML labels now preserve source dates, precision, and zones consistently.
- Export names such as `CON` are reserved Windows device names. Downloads now use safe names such as `Case-CON.anacapa`; trailing dots/spaces and other reserved names are handled too. Attachment download headers correctly encode apostrophes and Unicode.
- Evidence validation now keeps invalid drafts open, enforces the 3,000-card limit before creation, and checks attachment counts before uploading. HTML reports are built when requested instead of during initial board loading.
- Windows startup now checks the supported Node version, handles working directories with spaces, preserves failures, and disables inherited delayed expansion to protect paths containing `!`.
- New cards previously reused the same position and could cover existing evidence. They now find a free gap using measured sibling card sizes when available, account for rotation, and keep existing manual positions. New-card sizing is checked again when saving. A regression test covers tall cards, rotated cards, populated boards and empty branches. The final placement change passed the suite on both platforms; a fresh physical UI check of this last change could not complete after computer-use access became unavailable.

### Windows UI workflows observed

| Workflow | Result |
| --- | --- |
| Portable launch | Unzipped package launched from a directory containing spaces and an ampersand, without installing application dependencies. |
| Evidence editing | Inner form scrolled with its header/actions visible. Invalid `25:99` blocked saving; a corrected timestamp saved and survived reload. |
| Nested timelines | Created a child inside Shipping manifest, opened its branch, observed the compact parent line, and switched center-stage Chart/List. |
| Editable export | Downloaded `Case-CON.anacapa` through Chrome with all 11 fictional cards, including nested evidence. |
| Editable import | Opened the downloaded file through the Windows file chooser, selected a local case folder, and created an independent investigation. Renamed imported evidence, saved it, and reloaded; the edit persisted. |
| HTML export | Downloaded `Case-CON.html`, opened it from Windows Downloads, and observed Board, staggered Timeline, nested branches, Relationships, Report and dark appearance. Editing controls were absent. Long content scrolled. |
| Export chronology | Dates, UTC offsets, undated evidence and nested events were retained in the local HTML viewer. |

### Automated results

**macOS: 60 passed, 0 failed. Windows 11 - Main: 60 passed, 0 failed.** Typecheck, production build and portable packaging passed. The same functional/security suite ran on both platforms; it includes encrypted case contents and originals, wrong credentials, restart locking, roles, stale saves, expired/revoked sessions, history integrity, restore, backup, sharing, hostile text and malformed imports.

Additional boundary checks cover the full card/thread limits, deep hierarchies, large workspace requests, save races, exact 10 MiB attachment preservation, empty/oversized attachment rejection, date-only chronology, zone precedence and Windows-safe names. These are data/API checks, not a claim that a maximum-size board was rendered interactively.

### Remaining verification limits

Linux execution, UNC/network-share startup, physical printing, instant OS-managed PWA icon refresh, a ten-real-minute idle wait, and maximum-size interactive rendering remain unverified. Advanced security had automated coverage on Windows and the earlier macOS UI checks above; this pass did not create new Windows credentials or repeat every Advanced UI workflow. Browser/computer-use restrictions prevented the maximum-size browser check and the last physical card-placement check. No alternate browser automation was used to bypass those restrictions.

No test failures remain in the checked paths. This audit cannot establish that every possible bug is absent or provide independent security certification. Proof image: `output/qa/windows-html-timeline.png`.
