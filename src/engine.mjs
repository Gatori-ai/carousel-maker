// The steps: make a carousel from a topic, revise one from a note, and report where things stand.
// Every prompt lives here. Each step takes a `complete` function, so tests never call a model.
import path from 'node:path';
import * as store from './store.mjs';
import { check, fitIssues } from './check.mjs';
import { render, findChrome, lastFit } from './render.mjs';
import { complete as modelComplete } from './writer.mjs';

const { p, read, REPO } = store;
const rule = (name) => read(path.join(REPO, 'rules', name));

const SHAPE = `Answer with one JSON object and nothing else:
{
  "topic": "the idea in a few words",
  "arc": "the arc id you used",
  "slides": [
    { "type": "hook", "headline": "...", "body": "" },
    { "type": "context", "headline": "...", "body": "..." },
    { "type": "cta", "headline": "...", "body": "..." }
  ],
  "caption": "...",
  "hashtags": ["word", "word"]
}
Slide types: ${store.slideTypes().map((t) => `${t.id} (at most ${t.maxWords} words)`).join(', ')}.
Mark the one or two key phrases on a slide with **double asterisks**. A blank line in "body" starts a new paragraph.
Use only facts found in the context. Where a fact is missing, write [FILL IN: what is needed].`;

function background(brand) {
  const voice = store.voiceText();
  const recent = store
    .listCarousels()
    .filter((c) => c.status === 'approved')
    .slice(0, 5)
    .map((c) => `- ${c.hook}`)
    .join('\n');
  const cta = brand.cta.keyword
    ? `The call to action: the reader comments the keyword "${brand.cta.keyword}" and receives ${brand.cta.promise || 'the promised resource'}. The keyword is drawn on the last slide as a button, so the slide copy asks for "the word below" or names it. The caption names the keyword.`
    : 'No comment keyword is set. The last slide asks for one plain action that fits the context.';
  return [
    `<craft>\n${rule('carousel-craft.md')}\n</craft>`,
    `<caption_craft>\n${rule('caption-craft.md')}\n</caption_craft>`,
    `<ai_tells>\n${rule('ai-tells.md')}\n</ai_tells>`,
    `<context>\n${read(p.context()) || '(empty)'}\n</context>`,
    voice.trim() ? `<voice_rules>\n${voice}\n</voice_rules>` : '',
    read(p.notes()).trim() ? `<standing_notes>\n${read(p.notes())}\n</standing_notes>` : '',
    recent ? `<hooks_already_used>\n${recent}\n</hooks_already_used>` : '',
    `Who it is for: ${brand.name || 'the person described in the context'}${brand.handle ? ` (${brand.handle})` : ''}.`,
    cta,
    `Hashtags: at most ${brand.hashtags.max}, specific to the subject, without the # sign.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function parse(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The writer did not answer with a carousel. Try again.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The writer answered with something that is not valid JSON. Try again.');
  }
}

const describe = (issues) =>
  issues.map((i) => `- ${i.slide === null ? 'Whole carousel' : i.slide === 'caption' ? 'Caption' : `Slide ${i.slide}`}: ${i.message}`).join('\n');

async function fixOnce(carousel, issues, brand, complete) {
  const prompt = `Fix this carousel. Change only what the findings name and keep everything else word for word.

<carousel>
${JSON.stringify({ topic: carousel.topic, arc: carousel.arc, slides: carousel.slides, caption: carousel.caption, hashtags: carousel.hashtags }, null, 2)}
</carousel>

<findings>
${describe(issues)}
</findings>

${background(brand)}

${SHAPE}`;
  return parse(await complete(prompt, brand));
}

async function finish(draft, { id, created, brand, complete, images }) {
  let carousel = store.normalize({ ...draft, id, created, status: 'draft' });
  // A missing fact is the person's to supply, so it never triggers a rewrite.
  let issues = check(carousel, { brand }).filter((i) => i.rule !== 'brand');
  if (issues.some((i) => i.rule !== 'fact')) {
    try {
      const fixed = store.normalize({ ...(await fixOnce(carousel, issues.filter((i) => i.rule !== 'fact'), brand, complete)), id, created, status: 'draft' });
      if (fixed.slides.length) carousel = fixed;
    } catch {
      // Keep the first version; its findings are shown with it.
    }
  }
  carousel = store.saveCarousel(carousel);
  let rendered = null;
  let renderError = '';
  if (images && findChrome()) {
    try {
      rendered = await render(carousel.id, { brand });
    } catch (e) {
      renderError = e.message;
    }
  }
  return { carousel, issues: report(carousel.id, brand), dir: p.dir(carousel.id), rendered: Boolean(rendered), renderError };
}

export function report(id, brand = store.loadBrand()) {
  return [...check(store.loadCarousel(id), { brand }), ...fitIssues(lastFit(id))];
}

export async function make({ topic, arc, complete = modelComplete, images = true } = {}) {
  const brand = store.loadBrand();
  store.init();
  const idea = String(topic || '').trim() || nextIdea();
  if (!idea) throw Object.assign(new Error('Give a topic, or add one to studio/ideas.md.'), { code: 400 });
  const arcs = store.arcs();
  const picked = arcs.find((a) => a.id === arc);
  const arcText = picked
    ? `Use the "${picked.id}" arc (${picked.slides} slides): ${picked.flow.join('; ')}.`
    : `Pick the arc that fits the idea:\n${arcs.map((a) => `- ${a.id} (${a.slides} slides): ${a.flow.join('; ')}`).join('\n')}`;
  const prompt = `Write one Instagram carousel and its caption.

The idea: ${idea}

${arcText}

${background(brand)}

${SHAPE}`;
  const draft = parse(await complete(prompt, brand));
  const result = await finish({ ...draft, topic: draft.topic || idea }, { id: store.newId(draft.topic || idea), created: new Date().toISOString(), brand, complete, images });
  markIdeaDone(idea);
  return result;
}

export async function revise({ id, note, remember = false, complete = modelComplete, images = true } = {}) {
  const brand = store.loadBrand();
  const current = store.loadCarousel(id);
  const text = String(note || '').trim();
  if (!text) throw Object.assign(new Error('Say what to change.'), { code: 400 });
  if (remember) store.remember(text);
  const prompt = `Rewrite this carousel from the person's note. Keep what the note leaves alone.

<carousel>
${JSON.stringify({ topic: current.topic, arc: current.arc, slides: current.slides, caption: current.caption, hashtags: current.hashtags }, null, 2)}
</carousel>

<note>
${text}
</note>

${background(brand)}

${SHAPE}`;
  const draft = parse(await complete(prompt, brand));
  return finish({ ...draft, topic: draft.topic || current.topic }, { id, created: current.created, brand, complete, images });
}

export function approve(id) {
  const c = store.loadCarousel(id);
  return store.saveCarousel({ ...c, status: 'approved' });
}

function nextIdea() {
  const line = read(p.ideas()).split('\n').find((l) => /^\s*-\s*\[\s\]\s*\S/.test(l));
  return line ? line.replace(/^\s*-\s*\[\s\]\s*/, '').trim() : '';
}

function markIdeaDone(idea) {
  const text = read(p.ideas());
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^\s*-\s*\[\s\]/.test(l) && l.replace(/^\s*-\s*\[\s\]\s*/, '').trim() === idea);
  if (at < 0) return;
  lines[at] = lines[at].replace('[ ]', '[x]');
  store.write(p.ideas(), lines.join('\n'));
}

export function status() {
  const brand = store.loadBrand();
  const list = store.listCarousels();
  return {
    studio: store.home(),
    setUp: Boolean(brand.name),
    name: brand.name,
    handle: brand.handle,
    theme: brand.theme,
    accent: brand.accent,
    keyword: brand.cta.keyword,
    contextWritten: read(p.context()).replace(/^#.*$/gm, '').replace(/Short answers are fine.*$/m, '').trim().length > 0,
    voiceRules: Boolean(store.voiceText().trim()),
    browser: Boolean(findChrome()),
    carousels: list.length,
    drafts: list.filter((c) => c.status === 'draft').map((c) => c.id),
    nextIdea: nextIdea(),
  };
}
