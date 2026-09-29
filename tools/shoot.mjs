/**
 * Regenerate the README images.
 *
 * Renders the shot pages (`preview-panel.mjs --shot`) and screenshots them at deviceScaleFactor 2
 * with a headless Chrome/Edge, so `assets/preview.png` and `assets/composer-button.png` come from
 * the plugin's own HTML/CSS instead of a hand-taken app screenshot.
 *
 *   node tools/shoot.mjs          (npm run shots)
 *
 * Set DSH_SHOT_BROWSER to an explicit browser path if the usual install locations are empty.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const win = process.env.ProgramFiles;
const winX86 = process.env['ProgramFiles(x86)'];
const local = process.env.LOCALAPPDATA;
const candidates = [
  process.env.DSH_SHOT_BROWSER,
  win && path.join(win, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  winX86 && path.join(winX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  win && path.join(win, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  winX86 && path.join(winX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].filter(Boolean);

const browser = candidates.find((candidate) => fs.existsSync(candidate));
if (!browser) {
  console.error('shoot: no Chrome/Edge found. Set DSH_SHOT_BROWSER to the browser executable.');
  process.exit(1);
}

// 1. Render the shot pages next to this script.
const generate = spawnSync(process.execPath, [path.join(here, 'preview-panel.mjs'), '--shot'], { stdio: 'inherit' });
if (generate.status !== 0) process.exit(generate.status ?? 1);

// 2. Screenshot each page at 2x, which is the size the READMEs show them at.
const shots = [
  { page: 'shot-panel.html', out: path.join(here, '..', 'assets', 'preview.png'), size: '533,505' },
  { page: 'shot-composer.html', out: path.join(here, '..', 'assets', 'composer-button.png'), size: '483,200' }
];
const profile = path.join(os.tmpdir(), 'dsh-shot-profile');

for (const shot of shots) {
  const page = path.join(here, shot.page);
  const out = path.resolve(shot.out);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=2',
    '--virtual-time-budget=2000',
    `--user-data-dir=${profile}`,
    `--window-size=${shot.size}`,
    `--screenshot=${out.split(path.sep).join('/')}`,
    pathToFileURL(page).href
  ];
  fs.rmSync(out, { force: true });
  const result = spawnSync(browser, args, { stdio: 'ignore' });
  if (!fs.existsSync(out)) {
    console.error(`shoot: ${path.basename(out)} was not written (browser exit ${result.status}).`);
    process.exit(1);
  }
  console.log(`wrote ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(1)} kB)`);
}
