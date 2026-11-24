#!/usr/bin/env node
// A stand-in writer for the demo. It reads the prompt and prints a canned
// carousel, so the page can be tried with no model and no account.
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (prompt += d));
process.stdin.on('end', () => {
  const idea = (prompt.match(/^The idea: (.+)$/m) || [])[1] || '';
  const rewrite = prompt.startsWith('Rewrite this carousel');
  const carousel = {
    topic: idea || 'What a home pottery setup costs in the first year',
    arc: 'step-by-step',
    slides: [
      { type: 'hook', headline: rewrite ? 'You can start throwing at home for less than **one class term**.' : 'A home pottery setup costs less than you think.', body: '' },
      { type: 'context', headline: 'People price a kiln first and give up.', body: 'A kiln comes last. For the first year your studio can fire your pots for you.' },
      { type: 'step', headline: 'A used wheel', body: 'Look for one a school or a studio is replacing. It will be ugly and it will run for **twenty more years**.' },
      { type: 'step', headline: 'One bag of clay', body: 'A single bag is around forty bowls, counting the flops you wedge back in.' },
      { type: 'step', headline: 'Six tools', body: 'A wire, a sponge, a rib, a needle, a trimming loop and a bucket. Everything else can wait.' },
      { type: 'proof', headline: 'My own first setup', body: 'It lived in a corner of the garage on a **shower curtain**. I threw there for 14 months before I bought anything else.' },
      { type: 'cta', headline: 'Want the six-week beginner plan?', body: 'Comment the word below and I will send it to you.' },
    ],
    caption:
      'A student asked me last Tuesday whether she needed a spare room before she could practice at home.\n\nI showed her a photo of my garage corner. A wheel, a bucket and a shower curtain on the floor.\n\nComment WEDGE and I will send you the plan I hand every beginner on night one.',
    hashtags: ['pottery', 'wheelthrowing', 'homestudio'],
  };
  process.stdout.write(JSON.stringify(carousel, null, 2));
});
