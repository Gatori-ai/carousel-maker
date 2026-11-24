// Every read and write of the studio folder: the brand, the context and the carousels.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const home = () => path.resolve(process.env.CAROUSEL_HOME || path.join(REPO, 'studio'));

export const p = {
  brand: () => path.join(home(), 'brand.json'),
  context: () => path.join(home(), 'context.md'),
  voice: () => path.join(home(), 'VOICE.md'),
  notes: () => path.join(home(), 'notes.md'),
  ideas: () => path.join(home(), 'ideas.md'),
  carousels: () => path.join(home(), 'carousels'),
  dir: (id) => path.join(home(), 'carousels', safeId(id)),
  file: (id) => path.join(home(), 'carousels', safeId(id), 'carousel.json'),
};

export function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

// Write to a temporary file and rename, so a crash never leaves half a file.
export function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

const template = (name) => read(path.join(REPO, 'templates', name));
export const arcs = () => JSON.parse(template('arcs.json'));
export const slideTypes = () => JSON.parse(template('slide-types.json'));
export const themes = () => ['night', 'paper', 'color'];

const DEFAULT_BRAND = {
  name: '',
  handle: '',
  theme: 'night',
  accent: '#e0553a',
  photo: '',
  cta: { keyword: '', promise: '' },
  hashtags: { max: 5 },
  writer: { provider: 'auto', model: '', command: '' },
  port: 4748,
};

export function loadBrand() {
  let saved = {};
  try {
    saved = JSON.parse(read(p.brand()) || '{}');
  } catch {
    throw new Error(`${p.brand()} is not valid JSON. Fix it or delete it and run init again.`);
  }
  return {
    ...DEFAULT_BRAND,
    ...saved,
    cta: { ...DEFAULT_BRAND.cta, ...(saved.cta || {}) },
    hashtags: { ...DEFAULT_BRAND.hashtags, ...(saved.hashtags || {}) },
    writer: { ...DEFAULT_BRAND.writer, ...(saved.writer || {}) },
  };
}

export function saveBrand(brand) {
  write(p.brand(), JSON.stringify(brand, null, 2) + '\n');
}

export const hasBrand = () => Boolean(loadBrand().name);

export function init({ name, handle } = {}) {
  fs.mkdirSync(p.carousels(), { recursive: true });
  const brand = loadBrand();
  if (typeof name === 'string' && name.trim()) brand.name = name.trim().slice(0, 80);
  if (typeof handle === 'string' && handle.trim()) brand.handle = cleanHandle(handle);
  if (!fs.existsSync(p.brand()) || name || handle) saveBrand(brand);
  if (!fs.existsSync(p.context())) write(p.context(), template('context.template.md'));
  if (!fs.existsSync(p.ideas())) write(p.ideas(), template('ideas.template.md'));
  if (!fs.existsSync(p.notes())) write(p.notes(), template('notes.template.md'));
  return brand;
}

export const cleanHandle = (h) => '@' + String(h).trim().replace(/^@+/, '').replace(/[^\w.]/g, '').slice(0, 40);

// The voice rules. A VOICE.md made by AI Copy Trainer works as it is:
// copy it into the studio folder, or point VOICE_HOME at the folder that holds it.
export function voiceText() {
  const own = read(p.voice());
  if (own.trim()) return own;
  return process.env.VOICE_HOME ? read(path.join(path.resolve(process.env.VOICE_HOME), 'VOICE.md')) : '';
}

export function sectionBullets(heading, text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) inside = line.replace(/^#+\s*/, '').trim().toLowerCase() === heading.toLowerCase();
    else if (inside && /^\s*[-*]\s+/.test(line)) out.push(line.replace(/^\s*[-*]\s+/, '').trim());
  }
  return out;
}

export function remember(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!text) return;
  const notes = read(p.notes()) || template('notes.template.md');
  write(p.notes(), notes.trimEnd() + `\n- ${text}\n`);
}

// A carousel id is its folder name. Nothing else reaches the file system.
export function safeId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,90}$/.test(id)) {
    throw Object.assign(new Error('That is not a carousel id.'), { code: 400 });
  }
  return id;
}

const slug = (s) =>
  String(s || 'carousel')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-')
    .slice(0, 48) || 'carousel';

export function newId(topic, date = new Date()) {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const base = `${day}-${slug(topic)}`;
  let id = base;
  for (let n = 2; fs.existsSync(path.join(p.carousels(), id)); n++) id = `${base}-${n}`;
  return id;
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

// Whatever comes in (a model's answer, the page, a hand-written file) leaves in one shape.
export function normalize(input) {
  const c = input && typeof input === 'object' ? input : {};
  const known = slideTypes().map((t) => t.id);
  const slides = (Array.isArray(c.slides) ? c.slides : []).slice(0, 20).map((s) => {
    const slide = s && typeof s === 'object' ? s : {};
    const out = {
      type: known.includes(slide.type) ? slide.type : 'body',
      headline: str(slide.headline, 400),
      body: str(slide.body, 1200),
    };
    const keyword = str(slide.keyword, 40);
    if (keyword) out.keyword = keyword;
    return out;
  });
  return {
    id: str(c.id, 91),
    topic: str(c.topic, 300),
    arc: str(c.arc, 40),
    status: c.status === 'approved' ? 'approved' : 'draft',
    created: str(c.created, 40) || new Date().toISOString(),
    slides,
    caption: str(c.caption, 4000),
    hashtags: (Array.isArray(c.hashtags) ? c.hashtags : [])
      .map((h) => str(h, 60).replace(/^#+/, ''))
      .filter(Boolean)
      .slice(0, 30),
  };
}

export function saveCarousel(input) {
  const c = normalize(input);
  safeId(c.id);
  write(p.file(c.id), JSON.stringify(c, null, 2) + '\n');
  const tags = c.hashtags.map((h) => `#${h}`).join(' ');
  write(path.join(p.dir(c.id), 'caption.txt'), [c.caption, tags].filter(Boolean).join('\n\n') + '\n');
  return c;
}

export function loadCarousel(id) {
  const text = read(p.file(id));
  if (!text) throw Object.assign(new Error(`No carousel named "${id}".`), { code: 404 });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${p.file(id)} is not valid JSON.`);
  }
  return { ...normalize(data), id };
}

export function images(id) {
  try {
    return fs
      .readdirSync(p.dir(id))
      .filter((f) => /^slide-\d\d\.png$/.test(f))
      .sort();
  } catch {
    return [];
  }
}

export function listCarousels() {
  let names = [];
  try {
    names = fs.readdirSync(p.carousels());
  } catch {
    return [];
  }
  const out = [];
  for (const id of names) {
    if (!/^[a-z0-9][a-z0-9-]{0,90}$/.test(id) || !fs.existsSync(p.file(id))) continue;
    try {
      const c = loadCarousel(id);
      out.push({
        id,
        topic: c.topic,
        status: c.status,
        created: c.created,
        slides: c.slides.length,
        hook: c.slides[0] ? c.slides[0].headline || c.slides[0].body : '',
        rendered: images(id).length,
      });
    } catch {
      out.push({ id, topic: '(unreadable carousel.json)', status: 'draft', created: '', slides: 0, hook: '', rendered: 0 });
    }
  }
  return out.sort((a, b) => (a.created < b.created ? 1 : -1));
}
