// The mechanical pass on wording: string matches only. Sentence shapes need a reader.
import path from 'node:path';
import { REPO, read, sectionBullets, voiceText } from './store.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Terms a rule line names: `backticked` or "quoted". A short bare line counts as one term.
export function termsIn(bullets) {
  const out = [];
  for (const b of bullets) {
    const marked = [...b.matchAll(/`([^`]+)`|"([^"]+)"/g)].map((m) => (m[1] || m[2]).trim());
    if (marked.length) out.push(...marked);
    else if (b.split(/\s+/).length <= 3) out.push(b.replace(/[.,;:]+$/, '').trim());
  }
  return out.filter(Boolean);
}

export function loadTells() {
  return JSON.parse(read(path.join(REPO, 'rules', 'ai-tells.json')));
}

export function lint(text, voice = voiceText()) {
  const tells = loadTells();
  const allowed = new Set(termsIn(sectionBullets('Allowed exceptions', voice)).map((t) => t.toLowerCase()));
  const found = [];
  const body = String(text);

  for (const rule of tells.punctuation) {
    if (allowed.has(rule.id.toLowerCase())) continue;
    const hits = body.match(new RegExp(rule.pattern, 'g'));
    if (hits) found.push({ kind: 'punctuation', term: rule.id, count: hits.length, fix: rule.fix });
  }
  const wordCheck = (term, kind) => {
    if (allowed.has(term.toLowerCase())) return;
    // Match the word and its plain endings: transform, transforms, transformed, transforming.
    const stem = esc(term).replace(/e$/, 'e?');
    const tail = kind === 'phrase' ? '' : "(?:s|es|d|ed|ing|'s)?";
    const re = new RegExp(`(?<![A-Za-z])${kind === 'phrase' ? esc(term) : stem}${tail}(?![A-Za-z])`, 'gi');
    const hits = body.match(re);
    if (hits) found.push({ kind, term, count: hits.length, fix: `Replace "${hits[0]}" with a plainer choice.` });
  };
  for (const w of tells.words) wordCheck(w, 'word');
  for (const ph of tells.phrases) wordCheck(ph, 'phrase');

  for (const term of termsIn(sectionBullets('Words I never use', voice))) {
    if (found.some((f) => f.term.toLowerCase() === term.toLowerCase())) continue;
    const re = new RegExp(`(?<![A-Za-z])${esc(term)}(?![A-Za-z])`, 'gi');
    const hits = body.match(re);
    if (hits) found.push({ kind: 'personal ban', term, count: hits.length, fix: `"${term}" is listed under Words I never use.` });
  }
  return found;
}
