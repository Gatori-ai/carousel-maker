# AI tells

<!-- anti-ai-lint: off. This file quotes the banned words and patterns as its subject. -->

Readers recognize machine writing by a small set of habits. Every slide and caption avoids all of them. A person's own `studio/VOICE.md` wins any conflict: a tell listed under its "Allowed exceptions" heading is allowed for that person.

The same list lives in `ai-tells.json` for the mechanical check (`node bin/carousel.mjs check <id>`).

## Punctuation

- Em dashes. Use a period, a comma, a colon or parentheses.
- Ellipses used for drama ("It's just... different").
- Exclamation marks.
- Curly quotes. The mechanical check converts them to straight quotes.

## Words

delve, tapestry, landscape, realm, crucial, pivotal, nuanced, multifaceted, intricate, paradigm, leverage, robust, comprehensive, seamless, frictionless, foster, facilitate, underscore, encompass, embark, unlock, unleash, game-changing, game-changer, fast-paced, revolutionary, transform, empower, elevate, supercharge, resonate, moreover, furthermore, indeed, notably

## Phrases

"at its core", "in essence", "the heart of", "it's worth noting", "it's important to note", "in conclusion", "in today's world", "that said", "here's what I learned", "here's the thing", "let's dive in"

## Sentence shapes

A string match cannot find these. They take a read of every sentence.

- Binary contrast: "Not X. Not Y. Just Z." State what the thing is and move on.
- "Not X, but Y" reframes.
- Three-beat lists: "Faster. Cleaner. Yours." With three items, put one inside a longer sentence or cut one.
- Mirrored pairs: "Same tool. Different future."
- A rhetorical question answered by the very next sentence.
- Naming the emotion the reader is supposed to feel.
- An ending built to land ("And that changes everything."). A piece can stop on its last fact.
- An opening that sets up before it says anything ("In a world where", "I'm reaching out").
- Every sentence the same length. Follow a long sentence with a short one.

## What reads as a person

- Odd, specific detail: "the bench by the fountain that squeaks" in place of "a park".
- A thought left partly open.
- A word choice that is correct and slightly unexpected.

## The check, every carousel

1. Mechanical pass: punctuation, words and phrases above. The script does this.
2. Reading pass: the sentence shapes. Read each sentence against the list. A clean mechanical pass says nothing about this one.
