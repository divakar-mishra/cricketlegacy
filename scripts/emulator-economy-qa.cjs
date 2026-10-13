/* global __dirname */
/* Local emulator evidence capture. Does not clear data or make purchases. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(process.env.QA_EVIDENCE_DIR || path.join(__dirname, '../test-artifacts/emulator-economy-2026-10-11'));
const serial = process.env.QA_DEVICE_SERIAL || 'emulator-5554';
if (!/^emulator-\d+$/.test(serial)) throw new Error('This QA helper only targets emulators.');
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8' });
const [action, ...args] = process.argv.slice(2);
if (action === 'tap') adb('shell', 'input', 'tap', ...args);
else if (action === 'swipe') adb('shell', 'input', 'swipe', ...args);
else if (action === 'back') adb('shell', 'input', 'keyevent', '4');
else if (action === 'tap-label') {
  const dump = adb('shell', 'uiautomator', 'dump', '/sdcard/qa-window.xml');
  if (!/UI hierchary dumped to|UI hierarchy dumped to/.test(dump)) throw new Error('No fresh hierarchy available.');
  const xml = adb('shell', 'cat', '/sdcard/qa-window.xml');
  const label = args[0];
  const matches = [...xml.matchAll(/<node[^>]+>/g)].map((match) => match[0]).filter((node) => {
    const text = node.match(/text="([^"]*)"/)?.[1] ?? '';
    const description = node.match(/content-desc="([^"]*)"/)?.[1] ?? '';
    return text === label || description === label;
  });
  const node = matches.find((match) => match.includes('clickable="true"')) ?? matches[0];
  const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!bounds || node.includes('enabled="false"')) throw new Error('Enabled label not found: ' + label);
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  if (bottom <= top || right <= left) throw new Error('Label is offscreen: ' + label);
  adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
}
else if (action === 'snapshot' || action === 'screen') {
  fs.mkdirSync(output, { recursive: true });
  const name = args[0] || 'window';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid evidence name');
  let xml = '';
  if (action === 'snapshot') {
    // A live countdown can prevent UIAutomator from reaching an idle state.
    // Never treat the previous dump as coordinates for the current screen.
    const dump = adb('shell', 'uiautomator', 'dump', '/sdcard/qa-window.xml');
    if (/UI hierchary dumped to|UI hierarchy dumped to/.test(dump)) {
      xml = adb('shell', 'cat', '/sdcard/qa-window.xml');
      fs.writeFileSync(path.join(output, name + '.xml'), xml);
    } else console.log('Current UI XML unavailable; inspect the screenshot, not stale coordinates.');
  }
  adb('shell', 'screencap', '-p', '/sdcard/qa-screen.png');
  adb('pull', '/sdcard/qa-screen.png', path.join(output, name + '.png'));
  for (const match of xml.matchAll(/<node[^>]+>/g)) {
    const node = match[0];
    const text = node.match(/text="([^"]*)"/)?.[1] ?? '';
    const description = node.match(/content-desc="([^"]*)"/)?.[1] ?? '';
    const bounds = node.match(/bounds="([^"]*)"/)?.[1] ?? '';
    if (text || description) {
      const label = (text || description).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]');
      console.log(label, bounds);
    }
  }
} else throw new Error('Allowed actions: tap, tap-label, swipe, back, snapshot, screen');
