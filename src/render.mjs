// Slides as one self-contained HTML file, and that file as PNG images.
// The images are taken by the Chrome (or Edge, Brave, Chromium) already on the computer,
// run hidden. No browser is downloaded and no package is installed.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, home, p, read, write, loadBrand, loadCarousel } from './store.mjs';

export const WIDTH = 1080;
export const HEIGHT = 1350;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Non-ASCII characters become numeric entities, so the file survives any copy and paste.
const ascii = (s) => s.replace(/[\u0080-\u{10FFFF}]/gu, (ch) => `&#${ch.codePointAt(0)};`);
const rich = (s) => ascii(esc(s)).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\*\*/g, '');
const paragraphs = (s) =>
  String(s)
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${rich(x).replace(/\n/g, '<br>')}</p>`)
    .join('');

const FONTS = [
  ['CM Display', 800, 'Poppins-ExtraBold.ttf', 'font/ttf'],
  ['CM Text', 400, 'Inter-400.woff2', 'font/woff2'],
  ['CM Text', 700, 'Inter-700.woff2', 'font/woff2'],
  ['CM Serif', 400, 'EBGaramond-400.woff2', 'font/woff2'],
  ['CM Serif', 700, 'EBGaramond-700.woff2', 'font/woff2'],
];
let fontCss = null;
function fonts() {
  if (fontCss) return fontCss;
  fontCss = FONTS.map(([family, weight, file, type]) => {
    const data = fs.readFileSync(path.join(REPO, 'templates', 'fonts', file)).toString('base64');
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:${type};base64,${data})}`;
  }).join('\n');
  return fontCss;
}

const PHOTO_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
function photo(brand) {
  if (!brand.photo) return '';
  const file = path.resolve(home(), brand.photo);
  // The photo has to sit inside the studio folder.
  if (!file.startsWith(home() + path.sep)) return '';
  const type = PHOTO_TYPES[path.extname(file).toLowerCase()];
  try {
    if (!type || fs.statSync(file).size > 3_000_000) return '';
    return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return '';
  }
}

export const accentOf = (brand) => (/^#[0-9a-f]{6}$/i.test(brand.accent) ? brand.accent.toLowerCase() : '#e0553a');
export function onAccent(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#141312' : '#fffdf9';
}

// Runs in the page. Shrinks each slide's type until its words fit, and records the result
// where the check can read it back.
const FIT = `(function(){
  var q = new URLSearchParams(location.search), one = parseInt(q.get('slide'), 10);
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  if (one) { document.documentElement.className = 'one'; if (slides[one - 1]) slides[one - 1].classList.add('on'); }
  function fit() {
    slides.forEach(function (s) {
      if (one && !s.classList.contains('on')) return;
      var c = s.querySelector('.c'), inner = s.querySelector('.in'), k = 1;
      s.style.setProperty('--k', k);
      while (inner.scrollHeight > c.clientHeight && k > 0.7) { k = Math.round((k - 0.04) * 100) / 100; s.style.setProperty('--k', k); }
      s.setAttribute('data-k', k);
      s.setAttribute('data-over', inner.scrollHeight > c.clientHeight || inner.scrollWidth > c.clientWidth ? '1' : '0');
    });
    document.documentElement.setAttribute('data-ready', '1');
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();
})();`;

export function buildHtml(carousel, brand = loadBrand()) {
  const theme = ['night', 'paper', 'color'].includes(brand.theme) ? brand.theme : 'night';
  const accent = accentOf(brand);
  const img = photo(brand);
  const initial = esc((brand.name || '?').trim().charAt(0).toUpperCase());
  const who =
    brand.name || brand.handle
      ? `<div class="who">${img ? `<img class="ph" src="${img}" alt="">` : `<div class="ph">${ascii(initial)}</div>`}<div>${
          brand.name ? `<div class="nm">${ascii(esc(brand.name))}</div>` : ''
        }${brand.handle ? `<div class="hd">${ascii(esc(brand.handle))}</div>` : ''}</div></div>`
      : '';
  let step = 0;
  const slides = carousel.slides
    .map((s, i) => {
      const last = i === carousel.slides.length - 1;
      const keyword = s.type === 'cta' && last ? s.keyword || brand.cta.keyword : '';
      const parts = [];
      if (s.type === 'step') parts.push(`<div class="num">${++step}</div>`);
      if (s.headline) parts.push(`<div class="h">${rich(s.headline).replace(/\n/g, '<br>')}</div>`);
      if (s.body) parts.push(`<div class="b">${paragraphs(s.body)}</div>`);
      if (keyword) parts.push(`<div class="key">${ascii(esc(keyword))}</div>`);
      return `<section class="slide ${theme} ${s.type}" id="s${i + 1}">${who}<div class="c"><div class="in">${parts.join('')}</div></div></section>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:">
<title>${ascii(esc(carousel.topic || 'Carousel'))}</title>
<style>
${fonts()}
${read(path.join(REPO, 'templates', 'slides.css'))}
:root { --accent: ${accent}; --on-accent: ${onAccent(accent)}; }
</style></head>
<body>
${slides}
<script>${FIT}</script>
</body></html>
`;
}

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'],
};

export function findChrome() {
  if (process.env.CHROME_PATH) return fs.existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  for (const c of CANDIDATES[process.platform] || CANDIDATES.linux) {
    if (path.isAbsolute(c)) {
      if (fs.existsSync(c)) return c;
    } else {
      const r = spawnSync('which', [c], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
  }
  return null;
}

function chrome(bin, args, profile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
        '--force-device-scale-factor=1', `--user-data-dir=${profile}`, '--virtual-time-budget=4000', ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('The browser took more than 60 seconds on one slide.'));
    }, 60_000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start the browser: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`The browser exited with code ${code}: ${err.trim().slice(-300)}`));
      else resolve(out);
    });
  });
}

export function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG image.`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Writes slides.html and slide-01.png ... into the carousel's folder.
export async function render(id, { brand = loadBrand() } = {}) {
  const carousel = loadCarousel(id);
  if (!carousel.slides.length) throw new Error('This carousel has no slides.');
  const dir = p.dir(id);
  const htmlFile = path.join(dir, 'slides.html');
  write(htmlFile, buildHtml(carousel, brand));
  const bin = findChrome();
  if (!bin) {
    throw new Error(
      `No Chrome, Edge, Brave or Chromium was found, so no images were made. Install one, or set CHROME_PATH to its program file. The slides are in ${htmlFile}.`,
    );
  }
  const url = pathToFileURL(htmlFile).href;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-chrome-'));
  try {
    const dom = await chrome(bin, ['--dump-dom', url], profile);
    const fit = [...dom.matchAll(/id="s(\d+)"[^>]*?data-k="([\d.]+)"[^>]*?data-over="([01])"/g)].map((m) => ({
      slide: Number(m[1]),
      k: Number(m[2]),
      over: m[3] === '1',
    }));
    for (const old of fs.readdirSync(dir)) if (/^slide-\d\d\.png$/.test(old)) fs.rmSync(path.join(dir, old));
    const files = [];
    for (let i = 1; i <= carousel.slides.length; i++) {
      const file = path.join(dir, `slide-${String(i).padStart(2, '0')}.png`);
      await chrome(bin, [`--window-size=${WIDTH},${HEIGHT}`, '--default-background-color=00000000', `--screenshot=${file}`, `${url}?slide=${i}`], profile);
      const size = pngSize(file);
      if (size.width !== WIDTH || size.height !== HEIGHT) {
        throw new Error(`Slide ${i} came out ${size.width} x ${size.height}; it should be ${WIDTH} x ${HEIGHT}.`);
      }
      files.push(file);
    }
    write(path.join(dir, '.fit.json'), JSON.stringify(fit) + '\n');
    return { dir, files, fit };
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

export function lastFit(id) {
  try {
    return JSON.parse(read(path.join(p.dir(id), '.fit.json')) || '[]');
  } catch {
    return [];
  }
}
