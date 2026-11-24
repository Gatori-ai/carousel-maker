// The mechanical check on a carousel: structure, length, emphasis, the call to action,
// the caption and the wording. Each finding names the slide and says what to change.
// What a reader has to judge (does the hook stop the scroll?) is in rules/carousel-craft.md.
import { loadBrand, slideTypes, voiceText } from './store.mjs';
import { lint } from './lint.mjs';

const words = (s) => (String(s).replace(/\*\*/g, '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []);
const plain = (s) => words(s).join(' ').toLowerCase();
const sentences = (s) => String(s).replace(/\*\*/g, '').split(/(?<=[.?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const shingles = (s, n = 4) => {
  const w = plain(s).split(' ').filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};

const CONTINUES = /^(so|first|firstly|second|and|but|then|because|also|next|now|plus|or)\b/i;

// WCAG contrast ratio between two #rrggbb colors.
export function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function check(carousel, { brand = loadBrand(), voice = voiceText() } = {}) {
  const issues = [];
  const add = (slide, rule, message) => issues.push({ slide, rule, message });
  const types = Object.fromEntries(slideTypes().map((t) => [t.id, t]));
  const slides = carousel.slides || [];
  const n = slides.length;

  if (n < 5 || n > 10) add(null, 'count', `The carousel has ${n} slides. Use 5 to 10.`);
  if (n && slides[0].type !== 'hook') add(1, 'order', 'Slide 1 is the hook. Set its type to "hook".');
  if (n > 1 && slides[n - 1].type !== 'cta') add(n, 'order', 'The last slide is the call to action. Set its type to "cta".');

  slides.forEach((s, i) => {
    const at = i + 1;
    const text = [s.headline, s.body].filter(Boolean).join('\n');
    const type = types[s.type] || types.body;
    if (!text.trim()) return add(at, 'empty', 'This slide has no words.');
    const count = words(text).length;
    if (count > type.maxWords) {
      add(at, 'length', `${count} words on a ${type.id} slide. Keep it to ${type.maxWords} so it reads at phone size.`);
    }
    if (i > 0 && i < n - 1 && (s.type === 'hook' || s.type === 'cta')) {
      add(at, 'order', `A ${s.type} slide belongs at the ${s.type === 'hook' ? 'start' : 'end'}. Give this slide another type.`);
    }
    const bolds = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]);
    if (bolds.length > 2) add(at, 'bold', `${bolds.length} bold phrases. Bold one or two per slide.`);
    for (const b of bolds) {
      if (words(b).length > 7) add(at, 'bold', `"${b.slice(0, 50)}" is a whole sentence in bold. Bold the key phrase only.`);
    }
    if ((text.match(/\*\*/g) || []).length % 2) add(at, 'bold', 'A bold marker (**) is opened and never closed.');
    if (/\[FILL IN/i.test(text)) add(at, 'fact', 'A fact is missing here. Replace the [FILL IN] marker.');
    for (const hit of lint(text, voice)) add(at, 'wording', `${hit.kind}: "${hit.term}". ${hit.fix}`);
  });

  if (n > 1) {
    const second = (slides[1].headline || slides[1].body || '').replace(/\*\*/g, '').trim();
    if (CONTINUES.test(second)) {
      add(2, 'slide-2', `Slide 2 opens with "${second.split(/\s+/)[0]}". Instagram shows slide 2 first to people who skipped slide 1, so it has to make sense alone.`);
    }
  }

  const keyword = n && slides[n - 1].type === 'cta' ? slides[n - 1].keyword || brand.cta.keyword : '';
  if (keyword) {
    const k = keyword.toLowerCase();
    if (carousel.caption && !carousel.caption.toLowerCase().includes(k)) {
      add('caption', 'cta', `The caption never names the keyword "${keyword}". Slide and caption ask for the same word.`);
    }
  }

  const caption = carousel.caption || '';
  if (!caption.trim()) add('caption', 'caption', 'The caption is empty.');
  else {
    const slideText = slides.map((s) => `${s.headline}\n${s.body}`).join('\n');
    const inSlides = new Set(sentences(slideText).map(plain));
    for (const s of sentences(caption)) {
      if (words(s).length >= 5 && inSlides.has(plain(s))) add('caption', 'caption', `"${s.slice(0, 70)}" is copied from a slide. The caption adds a second angle.`);
    }
    const cap = shingles(caption);
    const sl = shingles(slideText);
    const shared = [...cap].filter((x) => sl.has(x)).length;
    if (cap.size >= 12 && shared / cap.size > 0.35) add('caption', 'caption', 'More than a third of the caption repeats the slides. Write it from a second angle.');
    if (/\[FILL IN/i.test(caption)) add('caption', 'fact', 'A fact is missing in the caption. Replace the [FILL IN] marker.');
    for (const hit of lint(caption, voice)) add('caption', 'wording', `${hit.kind}: "${hit.term}". ${hit.fix}`);
  }

  const max = Number(brand.hashtags.max) || 5;
  if ((carousel.hashtags || []).length > max) add('caption', 'hashtags', `${carousel.hashtags.length} hashtags. Keep it to ${max}.`);

  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent) ? brand.accent : null;
  if (!accent) add(null, 'brand', 'The accent color in brand.json is not a #rrggbb color.');
  else if (brand.theme === 'night' && contrast(accent, '#0b0b0c') < 3) add(null, 'brand', `The accent ${accent} is hard to read on the night theme. Pick a lighter color.`);
  else if (brand.theme === 'paper' && contrast(accent, '#f2ece0') < 3) add(null, 'brand', `The accent ${accent} is hard to read on the paper theme. Pick a darker color.`);

  return issues;
}

// Findings from the rendered slides: text that had to shrink a lot, or that still spills.
export function fitIssues(fit) {
  const issues = [];
  for (const f of fit || []) {
    if (f.over) issues.push({ slide: f.slide, rule: 'fit', message: 'The words do not fit on this slide, even at the smallest size. Cut some.' });
    else if (f.k < 0.8) issues.push({ slide: f.slide, rule: 'fit', message: 'The type had to shrink a lot to fit. Cut a line so it reads at phone size.' });
  }
  return issues;
}
