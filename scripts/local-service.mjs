// User-level macOS service for the local-only Anacapa workspace.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const label = 'local.anacapa.workspace';
const target = `gui/${process.getuid()}/${label}`;
const plist = path.join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
const action = process.argv[2];
function run(args, required = true) {
  const result = spawnSync('/bin/launchctl', args, { stdio: 'inherit' });
  if (required && result.status !== 0) process.exit(result.status || 1);
  return result.status;
}
if (action === 'status') {
  run(['print', target]);
} else if (action === 'stop') {
  run(['bootout', target]);
  console.log('Anacapa stopped until next login or start.');
} else if (action === 'start') {
  if (!existsSync(plist)) throw Error('Run install first.');
  const found = spawnSync('/bin/launchctl', ['print', target], { stdio: 'ignore' });
  if (found.status === 0) run(['kickstart', target]);
  else run(['bootstrap', `gui/${process.getuid()}`, plist]);
} else if (action === 'install') {
  const escape = (s) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const logs = path.join(root, '.runtime/local-service');
  mkdirSync(logs, { recursive: true });
  mkdirSync(path.dirname(plist), { recursive: true });
  const args = [process.execPath, path.join(root, 'runtime/server.mjs')];
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args.map((a) => `<string>${escape(a)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${escape(path.dirname(process.execPath))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer>
<key>StandardOutPath</key><string>${escape(path.join(logs, 'stdout.log'))}</string>
<key>StandardErrorPath</key><string>${escape(path.join(logs, 'stderr.log'))}</string>
</dict></plist>`;
  const existing = spawnSync('/bin/launchctl', ['print', target], { stdio: 'ignore' });
  if (existing.status === 0) run(['bootout', target]);
  writeFileSync(plist, config, { mode: 0o600 });
  run(['bootstrap', `gui/${process.getuid()}`, plist]);
  console.log('Anacapa service installed. Local only: http://127.0.0.1:5173/');
  console.log('Starts at login and restarts if the server exits. Logs: ' + logs);
} else throw Error('Use install, start, stop, or status.');
