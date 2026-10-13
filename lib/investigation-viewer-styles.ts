export const styles = String.raw`
:root {
  color-scheme: light;
  --bg: #f4eee6;
  --paper: #fffcf7;
  --ink: #443e36;
  --muted: #958979;
  --line: #dfd5c6;
  --accent: #e8ddcd;
  --primary: #9b7b56;
  --dot: #ded2c1;
  --scrollbar-thumb: var(--primary);
  --scrollbar-thumb-hover: var(--ink);
}
:root.dark {
  color-scheme: dark;
  --bg: #28241f;
  --paper: #353029;
  --ink: #e9dfcf;
  --muted: #b3a692;
  --line: #4c4235;
  --accent: #45392c;
  --primary: #c4a77c;
  --dot: #524638;
}
* {
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
@supports not (scrollbar-color: auto) {
  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  *::-webkit-scrollbar-track,
  *::-webkit-scrollbar-corner {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    background-clip: padding-box;
    border: 2px solid transparent;
    border-radius: 999px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-thumb-hover);
  }
  *::-webkit-scrollbar-button {
    display: none;
  }
}
@media (forced-colors: active) {
  * {
    scrollbar-color: auto !important;
    scrollbar-width: auto !important;
  }
}
body {
  margin: 0;
  font:
    14px "Avenir Next",
    Avenir,
    "Segoe UI",
    sans-serif;
  color: var(--ink);
  background: var(--bg);
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
button,
a {
  touch-action: manipulation;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
button {
  border: 0;
  border-radius: 8px;
  background: none;
  padding: 7px 10px;
}
button:hover {
  background: var(--accent);
}
header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 17px 25px;
  border-bottom: 1px solid var(--line);
}
.brand {
  color: var(--primary);
  font-size: 21px;
  letter-spacing: -0.7px;
}
.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.snapshot {
  font-size: 11px;
  color: var(--muted);
}
nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 24px;
  min-height: 43px;
  overflow: auto;
  white-space: nowrap;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}
nav span {
  color: var(--muted);
}
.views {
  display: flex;
  background: var(--accent);
  padding: 3px;
  border-radius: 9px;
}
.views button[aria-pressed="true"] {
  background: var(--paper);
  color: var(--primary);
}
main {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(var(--dot) 0.7px, transparent 0.8px) 0 0/24px 24px;
}
#board {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}
#scene {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}
#scene > svg {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  z-index: 0;
}
.card {
  position: absolute;
  width: 248px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 17px 19px;
  text-align: left;
  box-shadow: 0 4px 15px #33251408;
  z-index: 1;
  cursor: pointer;
}
.card:hover {
  background: var(--paper);
  box-shadow: 0 5px 20px #33251419;
}
.card.sized-card {
  display: flex;
  flex-direction: column;
  padding: 14px 17px;
}
.sized-card .kind {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sized-card h2 {
  flex-shrink: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.sized-card p {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--preview-lines, 3);
  overflow: hidden;
  min-height: 0;
  margin-bottom: 0;
}
.sized-card .detail,
.sized-card .preview {
  flex-shrink: 0;
}
.sized-card .detail {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card.compact-card {
  padding: 11px 13px;
}
.compact-card .kind,
.compact-card p,
.compact-card .detail,
.compact-card .preview {
  display: none;
}
.compact-card h2 {
  font-size: 17px;
  margin: 0;
  -webkit-line-clamp: 2;
  flex-shrink: 1;
}
.kind {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
h2 {
  font-size: 19px;
  line-height: 1.3;
  letter-spacing: -0.4px;
  font-weight: 450;
  margin: 11px 0 8px;
  overflow-wrap: anywhere;
}
p {
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted);
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}
.card .detail {
  display: block;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.pin {
  position: absolute;
  width: 7px;
  height: 7px;
  top: -4px;
  left: 50%;
  background: var(--primary);
  border-radius: 50%;
}
.label {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 3;
  background: var(--bg);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  max-width: 220px;
  width: max-content;
  overflow-wrap: anywhere;
  cursor: grab;
}
img.preview {
  max-width: 100%;
  max-height: 130px;
  object-fit: cover;
  border-radius: 5px;
  margin-top: 12px;
}
.controls {
  position: absolute;
  bottom: 19px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px;
  z-index: 5;
}
.controls button {
  min-width: 34px;
}
.controls span {
  font-size: 11px;
  min-width: 43px;
  text-align: center;
  color: var(--muted);
}
#timeline {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 24px;
  display: none;
}
.lane {
  margin-bottom: 25px;
}
.lane-heading {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 17px;
}
.lane-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 284px;
  grid-template-rows: auto 58px auto;
  overflow: auto;
  padding: 5px 0 16px;
  scrollbar-width: thin;
}
.event {
  grid-row: 1/4;
  display: grid;
  grid-template-rows: subgrid;
  min-width: 0;
}
.event-axis {
  grid-row: 2;
  position: relative;
}
.event time {
  position: absolute;
  left: 0;
  right: 18px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.event.below time {
  top: 0;
}
.event.above time {
  bottom: 0;
}
.event-line {
  height: 1px;
  background: var(--line);
  position: absolute;
  top: 28px;
  left: 0;
  right: 0;
}
.event-line:before {
  content: "";
  position: absolute;
  top: -3px;
  left: calc((100% - 18px) / 2 - 3px);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--primary);
  outline: 4px solid var(--bg);
  z-index: 1;
}
.event-line:after {
  content: "";
  position: absolute;
  left: calc((100% - 18px) / 2);
  width: 1px;
  height: 46px;
  background: var(--line);
}
.event.above .event-line:after {
  bottom: 0;
}
.event.below .event-line:after {
  top: 0;
}
.context-event {
  display: none;
}
.lane.compact-parent > .lane-track {
  grid-template-rows: 0 58px 0;
}
.lane.compact-parent > .lane-track > .event .event-body,
.lane.compact-parent > .lane-track > .event .event-line:after {
  display: none;
}
.lane.compact-parent > .lane-track > .event time {
  top: 0;
  bottom: auto;
  font-size: 10px;
}
.lane.compact-parent > .lane-track > .event .context-event {
  display: block;
  position: absolute;
  top: 36px;
  left: 0;
  right: 18px;
  width: calc(100% - 18px);
  padding: 0;
  line-height: 18px;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--primary);
}
.event-body {
  margin-right: 18px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--paper);
  overflow: hidden;
  min-width: 0;
}
.event.above .event-body {
  grid-row: 1;
  align-self: end;
  margin-bottom: 18px;
}
.event.below .event-body {
  grid-row: 3;
  align-self: start;
  margin-top: 18px;
}
.event .card {
  position: relative;
  left: 0;
  top: 0;
  display: block;
  width: 100%;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: none;
}
.event .pin {
  display: none;
}
.event h2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.event p {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.event-actions {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 6px 10px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--primary);
}
.event.event-style-compact .event-body {
  border-left: 3px solid var(--primary);
  border-radius: 6px 12px 12px 6px;
}
.event.event-style-compact h2 {
  font-size: 17px;
}
.event.event-style-compact p {
  -webkit-line-clamp: 2;
}
.event.event-style-compact .detail {
  border: 0;
  padding-top: 3px;
}
.event.event-style-note .event-body {
  background: var(--accent);
  border-radius: 3px 13px 13px 13px;
}
.event.event-style-note p {
  font:
    italic 14px/1.6 Georgia,
    serif;
  color: var(--ink);
}
.nested {
  margin: 20px 0 0 12px;
  border-left: 1px solid var(--line);
  padding-left: 20px;
}
.empty {
  padding: 70px 20px;
  text-align: center;
  color: var(--muted);
}
dialog {
  position: fixed;
  margin: 0 0 0 auto;
  inset: 0;
  width: 440px;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  border: 0;
  border-left: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  padding: 25px;
  overflow: auto;
}
.related-path {
  display: block;
  font-size: 10px;
  color: var(--muted);
  overflow-wrap: anywhere;
  padding: 3px 0 8px;
}
dialog::backdrop {
  background: #322b2345;
  backdrop-filter: blur(2px);
}
.close {
  float: right;
}
.field {
  border-top: 1px solid var(--line);
  padding: 13px 0;
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.field b {
  font-weight: 450;
  color: var(--muted);
}
a {
  color: var(--primary);
}
.attachment {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
  font-size: 12px;
}
.attachment img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 7px;
}
footer {
  font-size: 10px;
  color: var(--muted);
  padding: 9px 25px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
#branch {
  background: var(--accent);
  width: 100%;
  color: var(--primary);
  padding: 11px;
  margin-top: 15px;
}
button:disabled {
  cursor: default;
  opacity: 0.4;
}
@media (max-width: 650px) {
  header {
    padding: 12px 15px;
    gap: 8px;
  }
  .snapshot {
    display: none;
  }
  .brand {
    font-size: 18px;
  }
  nav {
    padding: 8px 15px;
  }
  #timeline {
    padding: 18px 15px;
  }
  .views button {
    padding: 7px;
  }
  footer {
    padding: 8px 15px;
  }
  .controls {
    bottom: 12px;
  }
  dialog {
    padding: 20px;
  }
  .field {
    grid-template-columns: 90px 1fr;
  }
}
`;

export const reportStyles = `
#report {
  overflow: auto;
  height: 100%;
  padding: 35px max(24px, calc((100% - 840px) / 2));
  font-size: 14px;
  line-height: 1.8;
}
#report h1 {
  font-size: 30px;
  font-weight: 500;
  line-height: 1.3;
}
#report h2 {
  font-size: 22px;
  line-height: 1.4;
}
#report .report-event {
  padding: 25px 0;
  border-bottom: 1px solid var(--line);
}
#report .field {
  font-size: 13px;
}
#report .field span {
  white-space: pre-wrap;
}
#report small {
  color: var(--muted);
}
.print-report {
  display: block;
  margin: 20px 0;
  background: var(--accent);
  padding: 10px 16px;
}
@media print {
  html,
  body {
    height: auto !important;
    overflow: visible !important;
    background: white !important;
    color: #222 !important;
    --ink: #222;
    --muted: #555;
    --line: #ccc;
    --primary: #222;
  }
  header,
  nav,
  footer,
  .controls,
  #board,
  #timeline,
  dialog,
  .print-report {
    display: none !important;
  }
  main {
    display: block;
    height: auto !important;
    overflow: visible !important;
  }
  #report {
    display: block !important;
    overflow: visible !important;
    height: auto !important;
    padding: 0;
    font-size: 11pt;
  }
  #report .field {
    break-inside: avoid;
  }
  #report h2 {
    break-after: avoid;
  }
}
`;

export const gateStyles = `
.unlock-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg);
  display: grid;
  place-items: center;
  padding: 20px;
}
.unlock-overlay form {
  width: min(400px, 100%);
  padding: 32px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 20px;
  display: grid;
  gap: 15px;
}
.unlock-overlay h1 {
  font-size: 24px;
  font-weight: 500;
  margin: 0;
}
.unlock-overlay p {
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
  color: var(--muted);
}
.unlock-overlay input {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  color: var(--ink);
  padding: 14px;
  font: inherit;
  width: 100%;
}
.unlock-overlay button {
  background: var(--accent);
  padding: 12px;
}
`;

export const responsiveStyles = `
header {
  flex-wrap: wrap;
  flex-shrink: 0;
}
.views {
  flex-shrink: 0;
  flex-wrap: wrap;
}
#theme,
#relationships {
  flex-shrink: 0;
}
@media (max-width: 650px) {
  header .title {
    flex-basis: calc(100% - 100px);
  }
  .views {
    margin-right: auto;
  }
  footer {
    flex-wrap: wrap;
  }
}
`;
