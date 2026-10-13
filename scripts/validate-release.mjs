import { execFileSync } from 'node:child_process';
import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
// A failed run must not leave an earlier passing result as the current report.
await Promise.all(
  ['report.json', 'report.html', 'windows-report.json'].map((name) =>
    rm('public/validation/' + name, { force: true }),
  ),
);
// Always validate the current source and rebuild the Node model used by the tests.
execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], {
  stdio: 'inherit',
});
const tests = (await readdir('tests'))
  .filter((n) => n.endsWith('.test.mjs'))
  .sort()
  .map((n) => 'tests/' + n);
let tap;
try {
  tap = execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--test', '--test-reporter=tap', ...tests],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
} catch (error) {
  process.stdout.write(error.stdout || '');
  process.stderr.write(error.stderr || '');
  throw Error('Release validation failed. No passing report was generated.');
}
const number = (name) => Number(tap.match(new RegExp('^# ' + name + ' (\\d+)$', 'm'))?.[1] || 0);
if (number('fail') || number('cancelled') || !number('tests'))
  throw Error('The test suite did not complete successfully.');
execFileSync(process.execPath, ['node_modules/prettier/bin/prettier.cjs', '--check', '.'], {
  stdio: 'inherit',
});
let browser;
try {
  browser = JSON.parse(
    execFileSync(
      process.execPath,
      ['node_modules/@playwright/test/cli.js', 'test', '--reporter=json'],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    ),
  );
} catch (error) {
  process.stdout.write(error.stdout || '');
  process.stderr.write(error.stderr || '');
  throw Error(
    'Browser validation failed. Install Chromium with npx playwright install chromium. No passing report was generated.',
  );
}
if (
  !browser.stats.expected ||
  browser.stats.unexpected ||
  browser.stats.skipped ||
  browser.stats.flaky
)
  throw Error('Browser checks did not complete cleanly.');
const fingerprint = await sourceFingerprint();
const report = {
  format: 'anacapa-release-validation',
  version: 1,
  appVersion: version,
  generatedAt: new Date().toISOString(),
  sourceSha256: fingerprint.sha256,
  runtime: process.version,
  platform: process.platform,
  sourceFiles: fingerprint.sourceFiles,
  typecheck: 'passed',
  automated: {
    tests: number('tests'),
    passed: number('pass'),
    failed: number('fail'),
    skipped: number('skipped'),
    files: tests.map((n) => n.replace('tests/', '')),
  },
  browser: {
    engine: process.env.ANACAPA_BROWSER_CHANNEL === 'chrome' ? 'Google Chrome' : 'Chromium',
    channel: process.env.ANACAPA_BROWSER_CHANNEL || 'bundled-chromium',
    passed: browser.stats.expected,
    failed: browser.stats.unexpected,
    skipped: browser.stats.skipped,
    scope:
      'Desktop editing and reload, mobile search and timeline, drag/resize/undo/pan, compact previews, nested resizing in Simple controls, case storage, offline HTML at 320/390/650/1280px, theme-coloured scrollbars, and type/custom/confidence/priority colours with board/timeline text contrast across editor/viewer palettes.',
  },
  interactiveVisualCheck:
    'Automated browser workflows passed. Complete manual accessibility and device review remains pending.',
  independentSecurityReview: 'Not performed or established by this report.',
  agencyApproval: 'Not established by this report.',
  scope: [
    'Manifest identity, appearance overrides, all 104 PNG icon assets, and case storage growth.',
    'Case validation, nested timelines, links, source records, placement, and save conflict recovery.',
    'Per-card sizes, zoom/rotation resize geometry, cancellation, compact previews, and portable layout preservation.',
    'Type and custom-type colours, confidence shades, independent priority, theme changes, and readable board/timeline text.',
    'Portable packages, protected sharing, redaction, and local API session restrictions.',
    'Advanced encryption, account roles, original hashes, history, custody, and folder backups.',
    'Simple controls data preservation, signed checkpoint chains, rollback detection, missing storage, and interrupted save recovery.',
  ],
  limits: [
    'These developer tests are not a penetration test, forensic validation, security certification, or approval for operational evidence use.',
    'Local roles and signatures cannot protect against compromise of the operating system, unlocked case, or private signing key.',
    'A separate checkpoint can detect a changed case folder only while its signing identity and trusted external records remain trustworthy.',
    'Complete manual accessibility, installed PWA/browser-OS behavior, and low-end hardware checks remain necessary. Windows/Linux CI is configured but a passing hosted CI run must be checked separately.',
  ],
};
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const items = (values) =>
  '<ul>' + values.map((v) => '<li>' + escape(v) + '</li>').join('') + '</ul>';
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anacapa · Release validation</title><style>body{margin:0;background:#f6f2eb;color:#383329;font:17px/1.65 Georgia,serif}main{max-width:820px;margin:48px auto;padding:0 28px 48px}h1{font-size:42px;line-height:1.15;margin-bottom:16px}h2{font-size:25px;margin-top:34px}small{color:#665e50}code{font-size:13px;overflow-wrap:anywhere}section{padding:24px;border:1px solid #ddd2c1;border-radius:16px;margin:24px 0;background:#fffcf6}a{color:#785d38}li{margin:8px 0}.result{font-size:25px}dd{margin:0 0 14px}dt{font-weight:bold}@media(prefers-color-scheme:dark){body{background:#28251f;color:#e8dfd1}small{color:#c6b8a3}section{background:#332e26;border-color:#5b4e3b}a{color:#d5b784}}</style><main><small>anacapa / DEVELOPER VALIDATION</small><h1>Release ${escape(version)} test results</h1><p>This records automated checks of the current source. It does not establish independent security review or approval for official evidence handling.</p><section><div class="result">${report.automated.passed} / ${report.automated.tests} tests passed</div><p>TypeScript and formatting checks passed. ${report.browser.passed} ${escape(report.browser.engine)} browser workflows passed. ${report.automated.skipped} tests skipped.</p><dl><dt>Generated</dt><dd>${escape(report.generatedAt)}</dd><dt>Runtime</dt><dd>${escape(report.runtime)} · ${escape(report.platform)}</dd><dt>Source SHA-256</dt><dd><code>${report.sourceSha256}</code></dd></dl><a href="report.json">Download the JSON report</a></section><h2>What was checked</h2>${items(report.scope)}<h2>Still needs review</h2><p>${escape(report.interactiveVisualCheck)}</p>${items(report.limits)}<h2>Test files</h2>${items(report.automated.files)}<p><a href="/">Back to Anacapa</a></p></main></html>`;
await mkdir('public/validation', { recursive: true });
await writeFile('public/validation/report.json', JSON.stringify(report, null, 2));
await writeFile('public/validation/report.html', html);
console.log(
  `Release ${version}: ${report.automated.passed}/${report.automated.tests} tests passed; ${report.browser.passed} browser workflows passed; typecheck and formatting passed.\nReport: public/validation/report.html\nVisual and independent review remain pending.`,
);
