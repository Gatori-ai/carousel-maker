#!/usr/bin/env node
// The command line. One case per command.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as store from '../src/store.mjs';

const HELP = `Carousel Maker. Brought to you by Gatori.ai

  carousel demo                          The page with a sample person and a canned writer
  carousel serve [--port 4748]           The page for your own studio folder
  carousel init --name "Your Name" --handle yourhandle
                                         Create the studio folder
  carousel new --topic "..." [--arc id]  Write one carousel and make its images
  carousel list                          Every carousel, newest first
  carousel show <id>                     One carousel as JSON
  carousel check <id>                    The findings for one carousel
  carousel render <id>                   Make slide-01.png ... from carousel.json
  carousel revise <id> --note "..." [--remember]
                                         Rewrite from a note; --remember keeps the note for every carousel
  carousel approve <id>                  Mark a carousel as posted or ready to post
  carousel remember "..."                Add a standing preference to studio/notes.md
  carousel arcs                          The arcs a carousel can follow
  carousel status                        Where things stand, as JSON

Arcs: problem-solution, step-by-step, belief-shift, story-lesson. Leave --arc out and one is picked.
Your files live in studio/ (or the folder named by CAROUSEL_HOME).`;

function args(list) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--')) {
      const next = list[i + 1];
      if (next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else flags[a.slice(2)] = list[++i];
    } else rest.push(a);
  }
  return { flags, rest };
}

const print = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));
const where = (i) => (i.slide === null ? 'Whole carousel' : i.slide === 'caption' ? 'Caption' : `Slide ${i.slide}`);
function findings(issues) {
  if (!issues.length) return print('No findings.');
  for (const i of issues) print(`${where(i)}: ${i.message}`);
}
function made(r) {
  print(`${r.carousel.id}: ${r.carousel.slides.length} slides`);
  print(r.rendered ? `Images and caption.txt are in ${r.dir}` : `Saved to ${r.dir}${r.renderError ? `\n${r.renderError}` : ''}`);
  findings(r.issues);
}

const [command, ...tail] = process.argv.slice(2);
const { flags, rest } = args(tail);

try {
  switch (command) {
    case 'demo': {
      // A copy of the sample studio in a temporary folder, with a writer that needs no model.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carousel-demo-'));
      fs.cpSync(path.join(store.REPO, 'demo', 'studio'), dir, { recursive: true });
      process.env.CAROUSEL_HOME = dir;
      const brand = store.loadBrand();
      brand.writer = { provider: 'command', model: '', command: `"${process.execPath}" "${path.join(store.REPO, 'demo', 'writer.mjs')}"` };
      store.saveBrand(brand);
      const { serve } = await import('../src/server.mjs');
      const { findChrome, render } = await import('../src/render.mjs');
      if (findChrome()) for (const c of store.listCarousels()) await render(c.id);
      serve({ port: flags.port || 4749 });
      break;
    }
    case 'serve': {
      const { serve } = await import('../src/server.mjs');
      serve({ port: flags.port });
      break;
    }
    case 'init': {
      const brand = store.init({ name: flags.name === true ? '' : flags.name, handle: flags.handle === true ? '' : flags.handle });
      print(`Studio folder: ${store.home()}`);
      print(brand.name ? `Set up for ${brand.name}${brand.handle ? ` (${brand.handle})` : ''}.` : 'Add your name with: carousel init --name "Your Name"');
      break;
    }
    case 'new': {
      const { make } = await import('../src/engine.mjs');
      made(await make({ topic: flags.topic === true ? '' : flags.topic, arc: flags.arc === true ? '' : flags.arc }));
      break;
    }
    case 'revise': {
      const { revise } = await import('../src/engine.mjs');
      made(await revise({ id: rest[0], note: flags.note === true ? '' : flags.note, remember: Boolean(flags.remember) }));
      break;
    }
    case 'list':
      for (const c of store.listCarousels()) print(`${c.id}  ${c.status}  ${c.slides} slides  ${c.rendered ? 'images' : 'no images'}  ${c.hook.slice(0, 60)}`);
      break;
    case 'show':
      print(store.loadCarousel(rest[0]));
      break;
    case 'check': {
      const { report } = await import('../src/engine.mjs');
      const issues = report(rest[0]);
      findings(issues);
      if (issues.length) process.exitCode = 1;
      break;
    }
    case 'render': {
      const { render } = await import('../src/render.mjs');
      const { fitIssues } = await import('../src/check.mjs');
      // Saving first writes caption.txt beside the images, also for a hand-written carousel.json.
      store.saveCarousel(store.loadCarousel(rest[0]));
      const out = await render(rest[0]);
      print(`${out.files.length} images in ${out.dir}`);
      findings(fitIssues(out.fit));
      break;
    }
    case 'approve': {
      const { approve } = await import('../src/engine.mjs');
      print(`${approve(rest[0]).id} is approved.`);
      break;
    }
    case 'remember':
      store.init();
      store.remember(rest.join(' '));
      print(`Added to ${store.p.notes()}`);
      break;
    case 'arcs':
      for (const a of store.arcs()) print(`${a.id} (${a.slides} slides)\n  ${a.flow.join('\n  ')}`);
      break;
    case 'status': {
      const { status } = await import('../src/engine.mjs');
      print(status());
      break;
    }
    default:
      print(HELP);
      if (command && !['help', '--help', '-h'].includes(command)) process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
