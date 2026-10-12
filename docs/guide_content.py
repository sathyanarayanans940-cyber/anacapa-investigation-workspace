"""Task-based chapters for the illustrated local-edition guide."""

pages = [
 dict(id='contents', title='Start here', lede='Start with a practice case. Each chapter teaches one task, with the controls and rules you need.', special='contents'),
 dict(id='run', title='Run Anacapa locally', lede='The downloaded folder contains the app. Your case folders contain the investigations.', diagram='storage', blocks=[
  ('steps', [
   'Install <b>Node.js 22.13 or newer</b> once. Unzip Anacapa into a folder you can write to.',
   'On macOS open <b>Start Anacapa.command</b>; on Windows open <b>Start Anacapa.bat</b>; on Linux run <b>sh start-anacapa.sh</b>.',
   'Open <b>http://127.0.0.1:5173</b> if the browser does not open. Keep the launcher running while you work.']),
  ('h', 'Keep these locations together'),
  ('p', 'New investigations live in folders you choose. The hidden <b>.anacapa-data</b> folder inside the app keeps the workspace registry and older cases. Preserve both the registry and your case folders when moving or updating the app.'),
  ('note', ('An app shortcut still needs the launcher', 'A PWA or browser shortcut opens a window; it does not start the server. The built release needs no internet or external account after Node.js is installed. Appearance preferences belong to the browser on that device.'))]),
 dict(id='map', title='Find your way around', lede='The board takes most of the screen. Use this map to find the controls.', figure='workspace', maxfig=300, caption='A fresh native-resolution capture of the fictional Harbor Tutorial workspace.', blocks=[
  ('table', [
   ['Area', 'What it does'],
   ['Header', 'Case files, global search, Case records (shield), Share, Settings, and Add evidence.'],
   ['Top line', 'Open an event or use the expand arrow for a full timeline chart. Ancestor timelines become thin lines inside a branch.'],
   ['Board path', 'Return to All evidence or an ancestor. Relationships reviews links across the whole case.'],
   ['Cards', 'Click the body to explore inside; use the pencil to edit. Drag in Select mode to move a card.'],
   ['Bottom tools', 'Select, Pan, Connect, Tilt, Add evidence, Add note, Undo, and Redo. The small hint below the tools explains the current action.'],
   ['Lower corners', 'Zoom, Fit board, save status, and Help.']]),
  ('note', ('Check the path first', 'New cards normally go inside the branch you are viewing. Return to All evidence when adding a main case event.'))]),
 dict(id='cases', title='Create and open cases', lede='Choose a case name, controls, protection, and a location before you start.', diagram='storage', blocks=[
  ('steps', [
   'Click the case name or Anacapa brand. Choose <b>New case</b> and enter a name and optional description.',
   'Choose <b>Simple</b>, <b>Normal</b>, or <b>Advanced</b>. Select <b>Choose folder</b>, navigate inside the app picker, and choose <b>Choose this folder</b>. An existing absolute path can also be entered with <b>Go</b>.',
   'For Advanced, enter the local administrator name and confirm a passphrase of at least 12 characters. Choose <b>Create case</b>.',
   'To practise, download <b>Harbor Tutorial</b> from Help. Use <b>Case files > Open .anacapa file</b>, choose the downloaded file, then choose the mode and folder for its new copy.']),
  ('p', 'An editable import adds a separate case. <b>Open case folder</b> opens an existing Anacapa folder containing <b>case.json</b>. Use <b>Edit current case</b> to rename the active investigation.'),
  ('note', ('An older case can move forward safely', 'Case records offers Save to a case folder for an older workspace case. This creates a new folder copy and leaves the older investigation in place. All examples in this guide are fictional.'))]),
 dict(id='security', title='Choose the protection level', lede='Simple reduces the controls. Normal gives you the full tools. Advanced adds protection around access, saving, and sharing.', blocks=[
  ('table', [
   ['Mode', 'How it behaves'],
   ['Simple', 'Normal protection with fewer visible controls. Core cards, dates, connections, sub-events, and attachments stay available. Reveal optional fields when needed.'],
   ['Normal', 'Opens without a password. Case folders support sources, permanent history, originals, verification, custody, and backups. Passphrase protection for exports is optional.'],
   ['Advanced', 'Encrypts case contents, originals and their metadata, history, and snapshots. Uses local accounts; requires reasons for evidence changes; locks after 10 minutes without activity. Exports are always protected.']]),
  ('h', 'Use Advanced deliberately'),
  ('p', 'Unlock with the local account name and passphrase. Case records offers <b>Lock</b>; browser refresh or a server restart may require unlocking again. A reason of at least five characters is required when saving evidence changes; rearranging the presentation is separate from changing evidence.'),
  ('table', [
   ['Role', 'Access within the app'],
   ['Administrator', 'Edits the case and manages local accounts through Case records > Accounts.'],
   ['Editor', 'Changes evidence and uses the case records tools; cannot manage accounts.'],
   ['Viewer', 'Inspects the case and can export a protected copy; cannot edit evidence.']]),
  ('note', ('Keep the passphrase and an independent backup', 'There is no online reset or recovery account. Account names, roles, folder identifiers, and checkpoint metadata remain visible. An unlocked case can still be copied. These local safeguards are not independent forensic validation or approval for agency production use.'))]),

 dict(id='simple', title='Start with Simple controls', lede='Keep the workspace calm while retaining the same investigation data.', blocks=[
  ('table', [
   ['Choice', 'Controls and protection'],
   ['Simple at creation', 'Fewer board tools; Normal protection. No password, automatic lock, or required reason.'],
   ['Normal at creation', 'Full board tools and optional evidence fields; Normal protection.'],
   ['Advanced at creation', 'Full tools with encryption, local roles, locking, and evidence-change reasons.']]),
  ('steps', [
   'Choose <b>Simple</b> when creating or importing a case. Give it a name, choose its folder, and create it.',
   'Use <b>Add evidence</b> for a name, type, notes, date, and attachments. Click a card to explore inside; use its pencil to edit.',
   'Choose <b>More fields &amp; sources</b> in the card editor to reveal citations, timeline placement, confidence, tags, and colours. Choose Show fewer fields to collapse them again.',
   'The toolbar keeps <b>Select</b>, <b>Pan</b>, <b>Connect</b>, Add evidence, Undo, and Redo. Create a Note through the evidence Type list.',
   'For filters, pins, Tilt, Add note, and the Relationships browser, open <b>Settings > Case controls > Full</b>. Return to Simple at any time.']),
  ('p', 'Changing controls preserves all cards, fields, sources, links, and presentation choices. Simple hides optional tools; it does not remove data. Relationship source sections remain available, and a Viewer can reveal optional card fields without editing them.'),
  ('note', ('Usability does not downgrade protection', 'An Advanced case can use Simple controls from Settings while keeping its encryption, local accounts, locking, and reason requirements. Changing controls never changes the case protection mode. To change protection, create a new folder copy deliberately.'))]),
 dict(id='cards', title='Add and edit a card', lede='Start with a name. Use the pencil for changes and the card body to explore its contents.', figure='custom-type', maxfig=320, caption='Choose Custom type and supply a label such as Interview.', blocks=[
  ('steps', [
   'Choose <b>Add evidence</b>, press <b>N</b>, or use the toolbar plus. Enter a required <b>Name</b> and choose a <b>Type</b>.',
   'Choose Person, Event, Location, Digital, Document, or Note. <b>Custom type...</b> adds your own category, such as Interview or Transaction.',
   'Write a short summary in <b>Notes</b>. Add a date or optional details when useful, then choose <b>Add evidence</b>.',
   'Use the existing card\'s <b>pencil</b> to edit it. Choose <b>Save changes</b>. Cancel or close leaves the editor\'s unsaved edits out of the case.']),
  ('note', ('Keep editing and exploring separate', 'Clicking a card opens its inner evidence board, even if it has no children yet. The small footer plus adds a sub-event. Deleting a card also deletes its descendants and connected threads; review the confirmation. Recent deletion can be undone.'))]),
 dict(id='details', title='Details, titles, and tags', lede='Store each fact as a labelled field so you can read, search, and compare it.', figure='details', maxfig=315, caption='Fields remain separate from the card name and summary.', blocks=[
  ('steps', [
   'Open the pencil editor and expand <b>Details & attachments</b>. Choose <b>Add field</b> and enter a label and value. The bin beside a field removes it.',
   'Use separate fields for a phone, address, website, IP, email, or reference. For this exercise, enter <b>Container ID = HBR-2048</b>.',
   'Open <b>Card appearance & labels</b>. <b>Show as the card title</b> chooses Name or one of the field values. The original name remains in the record.',
   'Add comma-separated tags, choose a pin colour, and set Confidence to <b>Confirmed</b>, <b>Likely</b>, or <b>Unverified</b>. Save changes.']),
  ('note', ('Labels matter when comparing records', 'Write field labels consistently. Shared details compares labelled values and tags; it does not read Notes or recognise text inside attachments. Card confidence and relationship uncertainty are separate decisions.'))]),
 dict(id='attachments', title='Attach pictures and documents', lede='Keep source files with the card they explain. The saved original is different from a thumbnail.', figure='attachments', maxfig=325, caption='An attachment name, preview, and recorded SHA-256 hash in the editor.', blocks=[
  ('steps', [
   'Expand <b>Details & attachments</b> and choose <b>Add images or documents</b>. Select one or more files and wait for the upload to finish.',
   'Save the card. PNG, JPEG, WebP, and GIF receive previews; other files appear by name. The first supported image can appear on the board card.',
   'Open an attachment from the editor to view or download its file. Remove its card reference with the bin, then save. Preserved originals may remain in the case folder for history and recovery.']),
  ('p', 'Case folders record the original bytes, size, SHA-256 hash, intake time, and operator. Intake time is when Anacapa received the file; it does not establish when the evidence was first created. Anacapa does not extract text from files. Enter important identifiers as fields.'),
  ('note', ('Share the bytes with the investigation', 'The limit is 10 MB per attachment and 50 MB of attachment bytes per shared case. Editable and HTML exports include selected attachments. Workspace JSON contains references, not the original file bytes.'))]),
 dict(id='sources', title='Record sources and citations', lede='A citation says where a statement came from and which part of the source supports it.', figure='citations', maxfig=315, caption='A fictional seal-register citation with a record number, page, and supported statement.', blocks=[
  ('steps', [
   'In a card editor or relationship editor, expand <b>Sources & citations</b> and choose <b>Add source</b>.',
   'Enter the <b>Source name</b>. Add the record or exhibit reference and the precise page, section, or recording timestamp.',
   'Use <b>Statement supported</b> for the specific fact or connection you are relying on. Add a source URL when useful; URLs use HTTP or HTTPS.',
   'Record <b>Collected by</b>, <b>Collection date & zone</b>, and <b>Collection method</b> when known. Save the card or connection.']),
  ('note', ('Keep observation and interpretation distinct', 'A source on a card supports that card. A source on a thread supports the proposed relationship. A hash detects file changes; a citation records your source. Neither proves that the source or your interpretation is true. Up to 100 citations can be stored on each card or thread.'))]),
 dict(id='dates', title='Set dates, times, and zones', lede='Keep the source timestamp, the interpreted time, and its precision clear.', figure='calendar', maxfig=320, caption='The themed calendar uses a centred 24-hour time input.', blocks=[
  ('steps', [
   'Type <b>YYYY-MM-DD HH:mm</b> in Date & time, such as <b>2026-09-18 23:40</b>, then leave the field. Or open the calendar, choose a day and time, and choose <b>Done</b>.',
   'Expand <b>Timeline placement</b>. Enter a <b>UTC offset</b>, such as <b>+05:30</b>, for consistent ordering across computers. A blank offset uses the computer\'s local zone.',
   'Choose <b>Exact</b>, <b>Approximate</b>, or <b>Date only</b> under Time precision. Preserve the source wording in <b>Original timestamp</b>.',
   'Add an optional <b>End date</b> for an interval. It cannot precede the start. Clear the date when the event is undated.']),
  ('note', ('The chart shows sequence, not elapsed scale', 'Events are equally spaced. Date-only records sort at the start of that date in the selected zone; approximate times remain estimates. Undated cards remain evidence and follow dated events in the expanded view. An interval is recorded, not drawn as a duration bar. Invalid clocks such as 25:99 must be corrected before saving.'))]),
 dict(id='arrange', title='Arrange the evidence board', lede='Select changes the position of evidence. Pan changes where you are looking.', figure='tilt-controls', maxfig=95, blocks=[
  ('table', [
   ['Control', 'Use it for'],
   ['Select / V', 'Drag a card or thread label. Click the card body to explore; the pencil edits its details.'],
   ['Pan / H', 'Drag the board, including over cards, to move the view without moving evidence.'],
   ['Tilt', 'Select the rotation tool, choose a card, and use the arrows for one-degree steps. Reset straightens it. The limit is 15 degrees each way.'],
   ['Zoom / Fit / F', 'Plus and minus change zoom. Fit includes the visible cards, images, tilt, and moved labels.'],
   ['Add note', 'Creates a Note for an observation or question. Notes can also have fields, attachments, and children.'],
   ['Undo / Redo', 'Recovers up to 40 recent actions in this session. Reloading clears this temporary action history.']]),
  ('p', 'New cards look for free space. Existing manual positions stay yours to arrange. Fit is useful after adding cards or clearing a filter. Presentation changes travel with an editable investigation.'),
  ('note', ('Pins mark focus', 'Pin this evidence in Card appearance & labels marks a key card. The pin beside the view controls filters to pinned cards. A pin does not prevent dragging.'))]),
 dict(id='threads', title='Draw and label relationships', lede='Name the connection so it reads clearly from the source card to the target card.', figure='new-relationship', maxfig=330, blocks=[
  ('steps', [
   'Choose <b>Connect</b> or press <b>C</b>. Click the first card, then the second visible card.',
   'In <b>Connect the details</b>, check <b>From</b> and <b>To</b>. Enter a label such as delivered to, documents, or shares a reference.',
   'Choose a thread colour. Use <b>Uncertain connection (dashed)</b> for a lead that needs checking. Add sources when appropriate, then save.',
   'Return to <b>Select</b> and drag the text label clear of cards. A focused label also responds to arrow keys; Shift moves it in larger steps.']),
  ('p', 'The line follows its endpoints when cards move. A saved label is your wording; changing a field does not automatically rewrite the label. Click the label or the pencil in Relationships to edit or remove the thread.'),
  ('note', ('Links can span branches', 'Use Relationships > New link, or Choose from any timeline in Connect mode, when the other endpoint is in another branch. A card cannot link to itself. Removing a link keeps both cards.'))]),
 dict(id='nested', title='Build nested sub-timelines', lede='Every card can contain its own evidence and timeline. Repeat the same pattern as deeply as your case needs.', diagram='hierarchy', blocks=[
  ('steps', [
   'Use the small <b>plus</b> in the card footer. The editor identifies <b>Sub-event inside</b>. Save to create that child.',
   'Click the parent card body. Its inner board shows the child cards and their timeline. For an empty branch, choose <b>Add sub-event</b>.',
   'Repeat on a child to create another level. The previous timelines become thin lines with circles, leaving room for the active branch.',
   'Use the breadcrumb or a ribbon\'s close button to go back. The pencil editor\'s <b>Sub-timeline</b> section also provides <b>Add sub-event</b> and <b>Open</b>.']),
  ('note', ('One parent for each card', 'Timeline placement > Inside changes the parent or returns a card to Main case timeline. A card cannot be placed inside itself or a descendant. Reparenting keeps its own child branch and saved relationships.'))]),
 dict(id='timeline', title='Bring the timeline centre stage', lede='Use time as the main workspace, then return to the evidence board whenever you need it.', figure='timeline-nested', maxfig=310, caption='A parent lane collapses while the Container unloaded sub-timeline opens beneath it.', blocks=[
  ('steps', [
   'Choose <b>Timeline only</b>, or use the expand arrow on a ribbon. The other view buttons are <b>Board and timeline</b> and <b>Board only</b>.',
   'Choose <b>Chart</b> or <b>List</b>. Chart alternates cards above and below the line; List helps read longer summaries and expand child rows.',
   'Use each chart card\'s <b>sliders</b> to choose Above line or Below line, and Card, Compact, or Note. This arrangement does not change the date.',
   'Click a chart card with children to open its nested lane. The parent becomes a labelled line; <b>Expand parent timeline</b> restores it. Use <b>Board</b> to enter a card\'s inner board or <b>Back to board</b> to return.']),
  ('note', ('The arrangements stay independent', 'Board positions and tilt are separate from chart side and style. The chart still sorts by date. Use lane arrows or horizontal scrolling for later events. These presentation choices are saved in the editable file.'))]),
 dict(id='cross', title='Connect different sub-timelines', lede='Choose any two cards in the same case, even when they live many levels apart.', figure='new-relationship', maxfig=330, caption='The branch paths distinguish the two endpoints.', blocks=[
  ('steps', [
   'Open <b>Relationships</b> near the board view controls and choose <b>New link</b>.',
   'Open <b>From</b> and search for <b>Vehicle enters the gate</b>. Choose the result under Case timeline / The midnight delivery.',
   'Open <b>To</b> and search for <b>Seal comparison</b>. Choose the result under Case timeline / Records review.',
   'Enter <b>shares Container ID: HBR-2048</b>. Keep it dashed while checking the source material, then save.']),
  ('p', 'The pickers search names, paths, and details. They show up to 80 candidates at a time; type more to narrow a long list. Connect mode also offers <b>Choose from any timeline</b> after you pick a source card.'),
  ('note', ('A relationship joins its chosen endpoints', 'Connect two parent cards to relate their sub-timelines as a whole. That does not automatically connect every descendant or move cards. Live links belong to one case; separate investigations do not share a live graph.'))]),
 dict(id='shared', title='Find common details', lede='Use matching facts to suggest a link, then review the evidence before recording it.', figure='shared-details', maxfig=280, caption='Cross-branch suggestions match the shipping manifest to cards sharing Container ID HBR-2048.', blocks=[
  ('steps', [
   'Use a fresh Harbor Tutorial copy if you already saved the exercise link: connected pairs are omitted from suggestions.',
   'Give cards in different branches the same labelled field or tag. The starter already includes <b>Container ID = HBR-2048</b> and a common phone number.',
   'Open <b>Relationships > Shared details</b>. Search by name, path, label, or value; <b>Phone</b> narrows this example.',
   'Check both paths and the matched facts. Choose <b>Create relationship</b>, review the prefilled endpoints and label, then save deliberately.']),
  ('p', 'Text ignores case and extra spaces. Phone aliases ignore spacing and punctuation, without guessing country codes. Website, URL, and Link compare parsed URLs; URL path case remains significant. IP and email labels have common aliases.'),
  ('note', ('A match is a lead', 'Matching does not read Notes or attachment text and does not prove identity or causation. Same-branch pairs and already linked pairs are omitted. Up to 200 cross-branch pairs are suggested; you can always choose endpoints manually.'))]),
 dict(id='outside', title='Follow links outside a branch', lede='The small link badge helps you follow evidence into another timeline.', figure='focused-links', maxfig=290, blocks=[
  ('steps', [
   'After saving the gate-to-seal link, open either endpoint\'s parent branch. Its card shows a <b>1 link</b> badge.',
   'Click the badge to open Relationships focused on that card. <b>Focus relationships</b> chooses another card; <b>Entire case</b> returns to every saved link.',
   'Select an endpoint name to reveal its board and breadcrumb. Its pencil opens the evidence editor.',
   'The relationship pencil changes the label, colour, uncertainty, sources, or endpoints. Changing an endpoint clears the old manual label offset. Save changes.']),
  ('p', 'The board draws a thread only when both endpoints are visible together. Relationships remains available for links spanning branches or hidden by filters; it reviews the case regardless of the current board filter.'),
  ('note', ('Review the link as well as the card', 'Confirmed evidence can still have an uncertain relationship. Saving a suggestion moves that pair into Saved links and removes it from Shared details.'))]),
 dict(id='search', title='Search and focus a case', lede='Narrow the view without deleting evidence or moving it out of its timeline.', figure='filters', maxfig=300, blocks=[
  ('steps', [
   'Use <b>Find a detail</b>, or <b>Cmd/Ctrl + K</b>. Search part of a name, note, date, tag, or field value.',
   'Results come from all branches. Clear the search to return to the branch you were viewing.',
   'Open <b>Filters</b>. Choose a type, including your custom categories, or enable <b>Pinned evidence only</b>. Choose <b>Apply filters</b>.',
   'Use <b>Show connecting threads</b> to show or hide lines and labels. The separate pin beside the view controls also toggles the pin filter.']),
  ('p', 'Search and filters combine. In the expanded timeline, branches containing matching descendants remain available so you can reach the result. The slim ribbons retain broader context. Fit frames the visible results.'),
  ('note', ('When the board looks empty', 'Check the path, search text, type, and pin filter before assuming a card is missing. Clear the filters and use Fit. Use Relationships to review links whose endpoints are not visible together.'))]),
 dict(id='appearance', title='Choose themes and icons', lede='Appearance is saved for this browser and device, independently of the investigation.', figure='settings', maxfig=135, caption='The theme controls in Light mode. Icon choices and automatic colour follow below.', blocks=[
  ('steps', [
   'Open <b>Settings</b>. Choose Light, Dark, or <b>System</b>. System follows later changes in your device\'s appearance.',
   'Choose <b>Linen</b> or <b>Chalk</b> for light mode; <b>Dusk</b> or <b>Slate</b> for dark mode. The light and dark choices are remembered separately.',
   'Choose one of the 13 icons. <b>Icon colour > Automatic</b> follows the workspace. Light icon or Dark icon is an explicit override.']),
  ('p', 'The header and tab icon update immediately. Settings save automatically where browser storage is available. Opening a case on another computer does not overwrite that computer\'s appearance settings.'),
  ('note', ('Installed icons are controlled by the browser', 'A new installation uses the selected icon. Updating an existing Dock or home-screen icon can require the browser\'s app-update review or reinstalling the shortcut. Anacapa cannot force the OS icon to update instantly. The installed-icon section offers a PNG download.'))]),
 dict(id='share', title='Save, share, and reopen', lede='Share the app folder for the tool. Share an investigation file for the case.', figure='share', maxfig=280, blocks=[
  ('table', [
   ['Format', 'Use'],
   ['Editable .anacapa', 'Share > Download to edit. Includes the selected cards, child timelines, relationships, presentation choices, and attachment bytes. Import through Case files > Open .anacapa file to create a separate case.'],
   ['View-only .html', 'Share > Download to view. A self-contained snapshot opened in a modern browser, without Anacapa, Node.js, or an external account.'],
   ['Full case backup', 'Case records > Make a complete backup. Preserves originals, all snapshots, history, and local accounts; see the backup chapter.']]),
  ('p', 'Expand <b>Choose cards & remove private details</b> to exclude cards or field values, notes, attachments, citations, or the case description. Only links between included cards survive; a selected child whose parent is excluded moves to the top level. Reduced copies omit history and custody.'),
  ('p', 'Normal exports can use a separate sharing passphrase of at least 12 characters. Advanced exports always require it. Recipients need that passphrase for both formats. Local account passwords and folder paths are excluded.'),
  ('p', 'Import checks every recorded attachment hash and size against the included bytes, including files used by several cards. A mismatch rejects the import before creating a case folder. Ask the sender for a fresh copy rather than changing its recorded hash.'),
  ('note', ('A snapshot is a separate copy', 'HTML has Board, Timeline, Relationships, details, attachments, theme controls, and a printable Report. Protected HTML asks for the passphrase first. View-only removes editing controls; it does not prevent copying. Review titles, labels, filenames, pictures, and remaining text. Recipient edits do not sync back.'))]),
 dict(id='records', title='History, integrity, and custody', lede='Open the shield in the header to review the records around a case folder.', figure='case-integrity', maxfig=290, caption='The tutorial case passed an integrity check and can download a checkpoint receipt.', blocks=[
  ('table', [
   ['Section', 'Task'],
   ['History', 'Review saved revisions, operator, action, reason, and hash. The latest 100 entries are shown. Each saved revision has a recovery snapshot.'],
   ['Integrity', 'Choose Verify case integrity to check originals, history, and recovery snapshots. Advanced also checks authenticated encryption and keyed history signatures. Download the receipt and keep it separately.'],
   ['Custody', 'Enter From, To, transfer time and zone, method, and purpose. The app adds the recording time and signed-in operator. These entries describe reported handling.']]),
  ('p', 'History refreshes after handling settings, account changes, custody entries, and backups. A later revision clears the earlier integrity result; run Verify again for a current receipt. Original hashes detect changes against preserved files. Imported earlier history is labelled as source history, outside the new folder\'s local chain; it cannot be restored as a local snapshot.'),
  ('note', ('What verification establishes', 'A successful check confirms consistency with the available records. It does not prove truthful evidence, an accurate original timestamp, or a physical transfer. Separate signed checkpoints detect changes to the case folder against trusted records outside it. Compromise of the whole computer or signing key remains outside that protection.'))]),

 dict(id='checkpoints', title='Keep separate checkpoints', lede='Compare a case with signed records kept outside its editable folder.', blocks=[
  ('p', 'New folder-backed cases create a signed checkpoint for every saved revision. By default the journal and pinned public key records live in <b>.anacapa-data</b>, separately from the chosen case folder. The private signing key stays in that app data too.'),
  ('steps', [
   'Open <b>Case records > Review > Separate checkpoints</b>. The path and signing-key fingerprint identify the configured journal.',
   'An Administrator can choose a separate drive or folder. Anacapa creates its own journal subfolder and retains the existing chain and signing identity. An older or imported folder can enable a baseline at its current revision without losing earlier evidence or history.',
   'Open <b>Integrity</b>, run <b>Verify case integrity</b>, and download the receipt. Keep its copy and the fingerprint on separately controlled storage.',
   'In <b>Review</b>, choose <b>Compare a saved receipt</b>. An older receipt may match a prior revision in the current history. A changed signature, other case, missing chain, or newer receipt is rejected.']),
  ('h', 'When storage disappears'),
  ('p', 'Writes stop when checkpoint storage is unavailable or the folder differs from its pinned record. Reconnect the same storage and retry. Keep unsaved edits open. Valid signed pending saves, including account updates, can recover after an interruption. Damaged staged records cannot be committed automatically; restarting does not reset a case\'s trusted identity.'),
  ('h', 'Comparing on a different computer'),
  ('p', 'A full backup includes a signed receipt, but not the private signing key or pinned journal. On a fresh installation, compare that receipt and confirm its fingerprint with the sender before setting up new checkpoints. The new baseline uses a new signing identity; older receipts then require their original trusted key. A baseline does not independently authenticate earlier history.'),
  ('note', ('The boundary matters', 'Replacing only the case folder can be detected. Replacing the case, journal, trusted key records, and signing key together can defeat local checks. There is no external trusted timestamp or independent witness. A receipt verifies a revision, not the truth of evidence.'))]),
 dict(id='review', title='Review handling and readiness', lede='Document responsibility and procedures without making the everyday board more complicated.', blocks=[
  ('steps', [
   'Open <b>Case records > Review > Case handling</b>. An Administrator records the responsible person or team.',
   'Add an optional procedure or approval reference and a review date in <b>YYYY-MM-DD</b> format. Set a backup interval from 1 to 365 days.',
   'Use <b>Retention hold</b> and handling instructions to document what must be preserved and the approved storage, access, or transfer workflow.',
   'Choose <b>Save handling settings</b>. The app records the operator and review time as a new history revision. Editors and Viewers can read these settings but cannot change them.',
   'Choose <b>Make a complete backup</b> to copy a verified folder. The active case records the backup time and revision afterward. Viewers use protected exports instead.',
   'Choose <b>Download case review</b> for the current integrity result, checkpoint fingerprint, source and time-zone coverage, handling settings, and backup status.']),
  ('table', [
   ['Report item', 'How to interpret it'],
   ['Source coverage', 'Counts cards with at least one citation; it does not assess citation accuracy or sufficiency.'],
   ['Time-zone coverage', 'Counts dated cards with explicit UTC offsets; review the source zone and daylight saving yourself.'],
   ['Backup due', 'No recorded backup, no handling policy, or the configured interval has elapsed. This is status, not a scheduled backup.'],
   ['Release test results', 'Developer automated checks of the release source. Visual checks, independent security review, and agency approval are stated separately.']]),
  ('p', 'Open <b>View release test results</b> for the check date, test count, and source fingerprint. Release 0.4.0 passed 80 tests on Mac and the same 80 in Windows 11 - Main. Interactive checks of the current screens remain pending. From source, <b>npm run validate</b> rebuilds the model, checks TypeScript, and runs the tests. It clears earlier results, including the separate Windows report, and writes a new report only after success.'),
  ('note', ('Rules remain yours to enforce', 'Dates and retention flags document decisions; they do not schedule jobs, prevent deletion outside the app, or delete evidence automatically. The app cannot obtain organisational approval or an independent review. Validate it against your actual procedures before operational use.'))]),
 dict(id='backup', title='Back up and restore a case', lede='Use revision restore for a past state and a complete folder backup for disaster recovery.', figure='case-history', maxfig=280, caption='Restore appends a new revision; it keeps the earlier record trail.', blocks=[
  ('steps', [
   'In <b>Case records > History</b>, choose <b>Restore</b> on the revision you need. Enter a reason of at least five characters.',
   'Choose <b>Restore as a new revision</b>. Evidence returns to that snapshot; earlier history and current custody records remain.',
   'For a full backup, choose <b>Make a complete backup</b>, then choose a location outside the active case folder. Anacapa verifies and copies the full folder with a checkpoint.',
   'Keep independent copies. A complete backup preserves originals, every snapshot, history, encryption, and local accounts. An editable export is a portable case copy, with at most 100 exported history entries, rather than a complete folder archive.']),
  ('h', 'Recovering a complete folder'),
  ('p', 'Preserve the affected folder. A prior backup intentionally differs from the latest separate checkpoint; do not replace the current folder to silence that warning. For disaster recovery, open the backup in a fresh app workspace, unlock if needed, and compare its supplied receipt with an independently retained fingerprint. Then set up new checkpoints. Use History restore for ordinary mistaken edits.'),
  ('note', ('Workspace JSON is not a complete backup', 'Case files > Workspace backup downloads records and references. It does not contain original attachment bytes or replace Advanced folder backups. Preserve the hidden .anacapa-data registry, chosen case folders, and their complete backups.'))]),
 dict(id='shortcuts', title='Shortcuts and working rules', lede='Use these after the controls feel familiar. Shortcuts do not replace careful saving.', blocks=[
  ('table', [
   ['Shortcut', 'Action'],
   ['N / C / F', 'New evidence / Connect / Fit board'],
   ['V / H', 'Select / Pan'],
   ['Cmd/Ctrl + K', 'Focus search'],
   ['Cmd/Ctrl + Z', 'Undo; add Shift for Redo'],
   ['Escape', 'Closes the active menu or dialog. On the board, returns to Select and clears a pending connection or search.'],
   ['Label arrow keys', 'Move a focused thread label; Shift makes the step larger.']]),
  ('h', 'The current limits'),
  ('table', [
   ['Item', 'Limit'],
   ['Workspace', '100 registered cases; 3,000 cards and 6,000 relationships per case.'],
   ['Card details', '200 fields, 100 tags, and 100 attachment references per card.'],
   ['Sources', '100 citations per card or relationship.'],
   ['File sizes', '10 MB per attachment; 50 MB attachment bytes per portable case. Import limits: 75 MB plain, 100 MB protected.'],
   ['Matching', '200 suggested cross-branch pairs. Endpoint pickers show 80 candidates; narrow with search.']]),
  ('note', ('Saving has two histories', 'Undo holds 40 recent actions in the current session. Case-folder History is permanent revision recovery. Each card has one parent; cycles, self-links, missing endpoints, invalid dates, and oversized entries are rejected. Wait for All changes saved before closing the launcher.'))]),
 dict(id='recovery', title='Recover without losing work', lede='Read the save status before reloading or replacing files.', blocks=[
  ('table', [
   ['What you see', 'What to do'],
   ['Connection refused', 'Reopen the launcher and check that it stays running. The PWA shortcut does not start the local server. Use the same local address and port.'],
   ['Changes pending / not saved', 'Keep the window open. Check the launcher and writable case folder. Use the save-status retry. Correct a validation error or supply the Advanced change reason when requested.'],
   ['Another window saved', 'Use the save-status recovery dialog and Download recovery copy before Load latest. Export each case changed in this window. The copy preserves this window\'s unsaved cards and attachment bytes, excluding server history and custody. Advanced recovery remains protected.'],
   ['Load latest confirmation', 'Discard & load latest discards this window\'s unsaved changes. Use it only after saving the recovery copies you need. Reopen a recovery .anacapa file as a separate case.'],
   ['Missing or moved folder', 'Keep the existing data. Use Open case folder at its current location. The same case must be absent at its old registered path; existing checkpoint identity is retained. For an older backup, follow the Back up and restore chapter using a fresh app workspace.'],
   ['Integrity failure', 'Preserve the affected folder and compare an independent receipt. An older backup cannot replace a newer pinned revision. Follow the backup chapter; do not edit hashes or snapshot files to silence the check.'],
   ['Missing or hidden evidence', 'Clear search, type and pin filters; check the breadcrumb; then Fit. For a missing attachment, recover its bytes from a full backup or an export that included it.']]),
  ('h', 'A routine that makes recovery easier'),
  ('p', 'Work in one editing window when possible. Keep complete folder backups outside the active case folder, export portable copies when sharing, and retain independent integrity receipts. A protected export does not encrypt an earlier plain copy; those copies keep their original protection.'),
  ('note', ('Before sharing or handing over', 'Review what is included, open the exported file yourself, and confirm the recipient can access the app and any required passphrase. HTML is for viewing; .anacapa is for editing; the full case folder is for complete recovery. There is no live cloud synchronisation.'))]),
]

contents_groups = [
 ('Getting started', ['run', 'map', 'cases', 'security', 'simple']),
 ('Evidence and time', ['cards', 'details', 'attachments', 'sources', 'dates', 'arrange', 'threads', 'nested', 'timeline']),
 ('Connecting and focusing', ['cross', 'shared', 'outside', 'search', 'appearance']),
 ('Sharing and recovery', ['share', 'records', 'checkpoints', 'review', 'backup', 'shortcuts', 'recovery']),
]
