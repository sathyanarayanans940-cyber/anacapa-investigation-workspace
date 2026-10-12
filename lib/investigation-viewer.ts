import { script } from './investigation-viewer-runtime.ts';
import {
  styles,
  gateStyles,
  reportStyles,
  responsiveStyles,
} from './investigation-viewer-styles.ts';
import type { InvestigationPackage, EncryptedPackage } from './investigation-package.ts';

export function createInvestigationViewer(bundle: InvestigationPackage | EncryptedPackage) {
  const data = JSON.stringify(bundle)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'"><title>Anacapa investigation</title><style>${styles}${gateStyles}${reportStyles}${responsiveStyles}</style></head><body><header><span class="brand">anacapa</span><span class="title" id="case-title"></span><span class="snapshot">Shared investigation</span><div class="views"><button data-view="board" aria-pressed="true">Board</button><button data-view="timeline" aria-pressed="false">Timeline</button><button data-view="report" aria-pressed="false">Report</button></div><button id="relationships">Relationships</button><button id="theme" aria-label="Toggle light or dark appearance">◐</button></header><nav aria-label="Investigation branches"></nav><main><div id="board"><div id="scene"></div></div><div id="timeline"></div><article id="report" style="display:none"></article><div class="controls" role="toolbar" aria-label="Board view"><button id="zoom-out" aria-label="Zoom out">−</button><span id="zoom-value">100%</span><button id="zoom-in" aria-label="Zoom in">+</button><button id="fit">Fit</button></div></main><footer><span id="export-date"></span><span>View-only snapshot · included evidence only</span></footer><dialog aria-label="Evidence details"><button class="close" id="close" aria-label="Close details">✕</button><div id="detail-content"></div><button id="branch" hidden></button></dialog><script id="investigation-data" type="application/json">${data}</script><script>${script}</script></body></html>`;
}
