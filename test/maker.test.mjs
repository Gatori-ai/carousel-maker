// The whole path against a stand-in writer: no model, no network.
// Images are made only when a browser is found; everything else runs anywhere.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-test-'));
process.env.CAROUSEL_HOME = dir;
delete process.env.VOICE_HOME;

const store = await import('../src/store.mjs');
const { check, fitIssues, contrast } = await import('../src/check.mjs');
const { lint } = await import('../src/lint.mjs');
const { buildHtml, findChrome, render, pngSize, onAccent } = await import('../src/render.mjs');
const engine = await import('../src/engine.mjs');
const { createServer } = await import('../src/server.mjs');

const good = () => ({
  topic: 'First bowls',
  arc: 'belief-shift',
  slides: [
    { type: 'hook', headline: 'Your first twenty bowls are supposed to **collapse**.', body: '' },
    { type: 'context', headline: 'Most beginners quit in week two.', body: 'They pull a wall and watch it fold.' },
    { type: 'statement', headline: 'A flop shows you **where it went thin**.', body: '' },
    { type: 'step', headline: 'Cut it in half', body: 'Slice the flop from rim to base.' },
    { type: 'proof', headline: 'I kept count.', body: '**61 flops** before one bowl reached the kiln.' },
    { type: 'cta', headline: 'Want the beginner plan?', body: 'Comment the word below.' },
  ],
  caption: 'Every new class goes quiet around minute forty.\n\nComment WEDGE and I will send you the plan.',
  hashtags: ['pottery'],
});
const canned = (carousel) => async () => JSON.stringify(carousel);

let server;
let base;
before(async () => {
  store.init({ name: 'Maya Okafor', handle: 'maya.sample' });
  const brand = store.loadBrand();
  brand.cta = { keyword: 'WEDGE', promise: 'the plan' };
  store.saveBrand(brand);
  server = createServer({ complete: canned(good()) });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('init writes the studio folder and cleans the handle', () => {
  assert.equal(store.loadBrand().handle, '@maya.sample');
  for (const f of ['brand.json', 'context.md', 'ideas.md', 'notes.md']) assert.ok(fs.existsSync(path.join(dir, f)), f);
});

test('a carousel id never reaches outside the carousels folder', () => {
  for (const bad of ['../x', 'a/b', '..', '', 'UPPER', 'a b', null]) assert.throws(() => store.safeId(bad));
  assert.equal(store.safeId('2026-11-24-first-bowls'), '2026-11-24-first-bowls');
});

test('normalize gives any input one shape', () => {
  const c = store.normalize({ slides: [{ type: 'nonsense', headline: 5 }, null, { type: 'cta', body: ' x ', keyword: ' GO ' }], hashtags: ['#one', 7, ''], status: 'whatever' });
  assert.deepEqual(c.slides.map((s) => s.type), ['body', 'body', 'cta']);
  assert.equal(c.slides[0].headline, '');
  assert.equal(c.slides[2].keyword, 'GO');
  assert.deepEqual(c.hashtags, ['one']);
  assert.equal(c.status, 'draft');
});

test('a sound carousel has no findings', () => {
  assert.deepEqual(check(store.normalize(good())), []);
});

test('the check names each structural problem', () => {
  const c = good();
  c.slides[0].type = 'body';
  c.slides[1].headline = 'So most beginners quit.';
  c.slides[2].headline = '**One** and **two** and **three** bold phrases.';
  c.slides[3].body = 'word '.repeat(70);
  c.slides[4].body = '**This entire sentence has been put in bold for no reason at all.**';
  c.slides[5].type = 'body';
  const rules = check(store.normalize(c)).map((i) => `${i.slide}:${i.rule}`);
  for (const want of ['1:order', '2:slide-2', '3:bold', '4:length', '5:bold', '6:order']) assert.ok(rules.includes(want), `${want} in ${rules}`);
  assert.ok(check(store.normalize({ ...good(), slides: good().slides.slice(0, 3) })).some((i) => i.rule === 'count'));
});

test('the check reads the caption against the slides and the keyword', () => {
  const c = good();
  c.caption = 'They pull a wall and watch it fold.\n\nThat is the whole story.';
  const found = check(store.normalize(c)).filter((i) => i.slide === 'caption').map((i) => i.rule);
  assert.ok(found.includes('caption'), 'copied sentence');
  assert.ok(found.includes('cta'), 'keyword missing from caption');
  assert.ok(check(store.normalize({ ...good(), caption: '' })).some((i) => i.message === 'The caption is empty.'));
  assert.ok(check(store.normalize({ ...good(), hashtags: ['a', 'b', 'c', 'd', 'e', 'f'] })).some((i) => i.rule === 'hashtags'));
});

test('the wording check catches AI tells and respects the person\'s own rules', () => {
  assert.ok(lint('We delve into a robust landscape — at its core.', '').length >= 5);
  const voice = '## Allowed exceptions\n- `!`\n\n## Words I never use\n- `journey`\n';
  const found = lint('What a journey!', voice).map((f) => f.term);
  assert.deepEqual(found, ['journey']);
  const c = good();
  c.slides[1].body = 'This will transform your practice.';
  assert.ok(check(store.normalize(c)).some((i) => i.slide === 2 && i.rule === 'wording'));
});

test('a missing fact and a weak accent color are reported', () => {
  const c = good();
  c.slides[4].body = '[FILL IN: how many flops]';
  assert.ok(check(store.normalize(c)).some((i) => i.rule === 'fact'));
  assert.ok(check(store.normalize(good()), { brand: { ...store.loadBrand(), theme: 'night', accent: '#101010' } }).some((i) => i.rule === 'brand'));
  assert.ok(contrast('#000000', '#ffffff') > 20);
  assert.equal(onAccent('#ffee00'), '#141312');
  assert.equal(onAccent('#3a1cc2'), '#fffdf9');
});

test('fit findings come from the rendered slides', () => {
  const found = fitIssues([{ slide: 1, k: 1, over: false }, { slide: 2, k: 0.74, over: false }, { slide: 3, k: 0.7, over: true }]);
  assert.deepEqual(found.map((i) => i.slide), [2, 3]);
});

test('slide HTML escapes everything a person or a model typed', () => {
  const c = store.normalize({
    topic: '</title><script>alert(1)</script>',
    slides: [{ type: 'hook', headline: '<img src=x onerror=alert(1)> **bold** café', body: '"quoted" & <b>raw</b>' }, { type: 'cta', headline: 'Go', body: '', keyword: '<i>K</i>' }],
  });
  const html = buildHtml(c, { ...store.loadBrand(), name: '<script>x</script>', accent: 'red;}</style><script>' });
  assert.ok(!/<script>alert|<img src=x|<b>raw|<i>K|<script>x/.test(html));
  assert.ok(html.includes('<b>bold</b>'));
  assert.ok(html.includes('caf&#233;'));
  assert.ok(html.includes('--accent: #e0553a'));
  assert.ok(!/[^\x00-\x7F]/.test(html), 'ASCII only');
  assert.equal((html.match(/<section class="slide /g) || []).length, 2);
});

test('a photo outside the studio folder is never read', () => {
  const html = buildHtml(store.normalize(good()), { ...store.loadBrand(), photo: '../../../../etc/hosts.png' });
  assert.ok(html.includes('<div class="ph">M</div>'));
});

test('make writes, repairs once from the findings, and saves', async () => {
  const flawed = good();
  flawed.slides[1].headline = 'So most beginners quit.';
  const calls = [];
  const complete = async (prompt) => {
    calls.push(prompt);
    return JSON.stringify(calls.length === 1 ? flawed : good());
  };
  const r = await engine.make({ topic: 'First bowls', complete, images: false });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].startsWith('Write one Instagram carousel'));
  assert.ok(calls[0].includes('WEDGE') && calls[0].includes('<craft>'));
  assert.ok(calls[1].includes('Slide 2:'));
  assert.deepEqual(r.issues, []);
  assert.match(r.carousel.id, /^\d{4}-\d\d-\d\d-first-bowls$/);
  assert.ok(fs.readFileSync(path.join(r.dir, 'caption.txt'), 'utf8').includes('#pottery'));
});

test('make takes the next idea and marks it done; a bad answer is an error', async () => {
  store.write(store.p.ideas(), '# Ideas\n\n- [x] old\n- [ ] Why centering takes a month\n');
  const r = await engine.make({ complete: canned({ ...good(), topic: '' }), images: false });
  assert.equal(r.carousel.topic, 'Why centering takes a month');
  assert.ok(store.read(store.p.ideas()).includes('- [x] Why centering takes a month'));
  await assert.rejects(engine.make({ topic: 'x', complete: async () => 'Sorry, no.', images: false }), /did not answer with a carousel/);
  await assert.rejects(engine.make({ complete: canned(good()), images: false }), /Give a topic/);
});

test('revise keeps the id, and remember saves a standing note', async () => {
  const first = await engine.make({ topic: 'Revise me', complete: canned(good()), images: false });
  const changed = good();
  changed.slides[0].headline = 'Twenty flops come first.';
  const r = await engine.revise({ id: first.carousel.id, note: 'Say flop in the hook.', remember: true, complete: canned(changed), images: false });
  assert.equal(r.carousel.id, first.carousel.id);
  assert.equal(r.carousel.slides[0].headline, 'Twenty flops come first.');
  assert.ok(store.read(store.p.notes()).includes('- Say flop in the hook.'));
  assert.equal(engine.approve(first.carousel.id).status, 'approved');
});

test('the page refuses other sites, other hosts and anything but JSON', async () => {
  const post = (headers, body = '{}') => fetch(`${base}/api/setup`, { method: 'POST', headers, body });
  assert.equal((await post({ 'Content-Type': 'application/json', Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post({ 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post({ 'Content-Type': 'application/x-www-form-urlencoded' }, 'name=x')).status, 415);
  const foreign = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/state', headers: { Host: 'evil.example' } }, (r) => resolve(r.statusCode)).on('error', reject);
  });
  assert.equal(foreign, 403);
  assert.equal((await fetch(`${base}/api/state`, { method: 'DELETE' })).status, 405);
  for (const id of ['../../etc', '..%2F..%2Fbrand', 'nope']) {
    const r = await fetch(`${base}/api/carousel?id=${id}`);
    assert.ok([400, 404].includes(r.status), `${id} gave ${r.status}`);
  }
  assert.equal((await fetch(`${base}/image?id=..%2F..&n=1`)).status, 400);
  assert.equal((await fetch(`${base}/web/index.html`)).status, 404);
});

test('the page serves, makes a carousel, saves an edit and shows its slides', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.ok((home.headers.get('content-security-policy') || '').includes("default-src 'none'"));
  const json = { 'Content-Type': 'application/json' };
  const made = await (await fetch(`${base}/api/new`, { method: 'POST', headers: json, body: JSON.stringify({ topic: 'From the page' }) })).json();
  const id = made.carousel.id;
  const edit = { ...made.carousel, slides: made.carousel.slides.map((s, i) => (i ? s : { ...s, headline: 'Edited hook.' })) };
  const saved = await (await fetch(`${base}/api/save`, { method: 'POST', headers: json, body: JSON.stringify({ id, carousel: edit }) })).json();
  assert.equal(saved.carousel.slides[0].headline, 'Edited hook.');
  const slides = await (await fetch(`${base}/slides?id=${id}&slide=1`)).text();
  assert.ok(slides.includes('Edited hook.'));
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.ok(state.carousels.some((c) => c.id === id));
  assert.equal(state.status.setUp, true);
});

test('render makes one 1080 x 1350 image per slide', { skip: findChrome() ? false : 'no Chrome, Edge, Brave or Chromium on this computer' }, async () => {
  const made = await engine.make({ topic: 'Render me', complete: canned(good()), images: false });
  const out = await render(made.carousel.id);
  assert.equal(out.files.length, 6);
  for (const f of out.files) assert.deepEqual(pngSize(f), { width: 1080, height: 1350 });
  assert.equal(out.fit.length, 6);
  assert.ok(out.fit.every((f) => !f.over));
  const long = good();
  long.slides[3].body = 'Slice the flop from rim to base and look closely at the wall. '.repeat(14);
  const big = store.saveCarousel({ ...long, id: 'too-long' });
  const fit = (await render(big.id)).fit;
  assert.ok(fitIssues(fit).some((i) => i.slide === 4));
});
