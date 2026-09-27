#!/usr/bin/env node
/**
 * Renders the static image assets that a crawler or a launcher expects to be
 * real files: the Open Graph share image and the PWA / apple touch icons.
 *
 * Why a headless browser instead of shipping binaries: the artwork is defined in
 * `og-image.html` and `icon.html` next to this script, so it is reviewable in a
 * diff and re-renderable on any machine. A checked-in PNG is not.
 *
 * Run with `npm run gen:images`. It only needs to be re-run when the artwork
 * changes — the output is committed, because `public/` has to contain real
 * files at deploy time and a build machine is not guaranteed to have a browser.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** Candidate browsers, in order of preference. */
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findBrowser() {
  const found = BROWSERS.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      'No Chrome or Chromium found. Set CHROME_PATH to a browser executable, or\n' +
        'render scripts/og-image.html and scripts/icon.html by hand and save them to\n' +
        'public/ with the sizes listed in TARGETS.',
    );
  }
  return found;
}

const TARGETS = [
  { file: 'og-image.png', source: 'og-image.html', width: 1200, height: 630 },
  { file: 'apple-touch-icon.png', source: 'icon.html', width: 180, height: 180 },
  { file: 'icon-512.png', source: 'icon.html', width: 512, height: 512 },
  { file: 'icon-maskable-512.png', source: 'icon.html?maskable=1', width: 512, height: 512 },
];

function render(browser, target) {
  const source = path.join(HERE, target.source);
  const out = path.join(PUBLIC_DIR, target.file);
  const url = `file:///${source.replace(/\\/g, '/')}`;

  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      // Belt and braces: a stray default margin or a scrollbar would change the
      // output dimensions and quietly resize the image.
      '--default-background-color=0a0d14',
      `--window-size=${target.width},${target.height}`,
      `--screenshot=${out}`,
      url,
    ],
    { stdio: 'ignore' },
  );

  if (!existsSync(out)) throw new Error(`Chrome produced no output for ${target.file}`);
  const { size } = statSync(out);
  if (size < 512) throw new Error(`${target.file} is only ${size} bytes — rendering failed`);
  console.log(`  ${target.file.padEnd(24)} ${target.width}x${target.height}  ${size} bytes`);
}

const browser = findBrowser();
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

console.log(`Rendering image assets with ${path.basename(browser)}:`);
for (const target of TARGETS) render(browser, target);
console.log('Done.');
