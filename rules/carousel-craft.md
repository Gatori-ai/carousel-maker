# Carousel craft

<!-- anti-ai-lint: off. This file quotes weak hooks and banned patterns as its subject. -->

How a carousel is planned and written here. Read this before the first word. `ai-tells.md` applies to every slide, and the person's own `studio/VOICE.md` wins any conflict.

A carousel makes one argument. The reader arrives with a problem and leaves seeing it more clearly, and every slide moves that argument forward by one step.

## The standard

A carousel is ready when all of these hold.

- **Hook.** Slide 1 stops the scroll by naming something specific the reader already feels and has never put into words.
- **Voice.** Read every slide aloud. Each line sounds like this person talking to one reader.
- **Flow.** Each slide earns the next swipe. Take any slide out and the argument breaks.
- **One point per slide.** A slide can have layers (a headline, a supporting detail, a closing line) as long as all of them serve the same point.
- **Slide 2.** It makes sense to someone who never saw slide 1.
- **A slide worth saving.** At least one slide is useful enough to screenshot.
- **Call to action.** The last slide asks for one action, and that action is the obvious next step.
- **Caption.** It adds a second angle. See `caption-craft.md`.
- **Wording.** Nothing from `ai-tells.md`.

`node bin/carousel.mjs check <id>` tests what a machine can test: slide count, length, emphasis, the opening of slide 2, the keyword, the caption against the slides, and the wording. The hook, the voice and the flow need a reader.

## Arcs

Pick one arc. The slide counts are ranges; use as many slides as the idea needs.

**Problem to solution** (5 to 7 slides)
1. Hook: name the pain or the tension
2. Context: what it costs if nothing changes
3. Statement: the shift in how to see it
4. One to three slides on what to do
5. Call to action

**Step by step** (7 to 10 slides)
1. Hook: the outcome the reader gets
2. Context: why this matters now
3. Three to six steps, one per slide, each building on the last
4. Call to action

**Belief shift** (5 to 7 slides)
1. Hook: the common belief
2. Context: what that belief costs, with a specific
3. Statement: the principle that holds up
4. Proof: a personal example or a specific detail
5. Body: what changes in practice
6. Call to action

**Story to lesson** (6 to 8 slides)
1. Hook: open in the middle of the story
2. Two or three slides of story, one beat per slide
3. Statement: the turn, what changed
4. Body: the principle and what it means for the reader
5. Call to action

## Slide types

| Type | Job | Length |
|---|---|---|
| `hook` | Stop the scroll. Name something specific. | One or two lines, 22 words at most |
| `context` | Set up why this matters | Headline plus two or three short sentences |
| `body` | Deliver one idea with support | Headline plus two or three lines |
| `statement` | Land a single line | One sentence |
| `step` | Teach one action. The slide is numbered for you. | The step's name as the headline, then two or three lines |
| `proof` | Show evidence | A number, an example or a story beat |
| `cta` | Ask for one action | Headline plus one instruction |

## The hook

The hook decides whether anyone sees the rest.

1. **Specific beats clever.** "I spent 300 hours building this so you can skip them" beats "The future of content".
2. **Name the feeling.** "You have good work that never ships" beats "How to plan your content".
3. **Open a gap.** Between what the reader believes and what holds up, or between where they are and where they want to be.
4. **Say what the other fifty posts in the feed left out.**

Shapes that work:

- The uncomfortable truth: "Most beginners quit in week two."
- The specific number: "I posted 47 carousels in 6 weeks. Here is what I would change."
- The quiet confession: "I almost quit last month. Then I changed one thing."
- The system shown: "My whole week of posts starts as one voice note."

Hooks that lose the reader: a topic with no tension ("How to use AI for your business"), a question that reads as an advertisement ("Want to 10x your content?"), and a profound line with no setup. Depth belongs on slides 3 to 5.

## Slide 2

Instagram shows a carousel again to people who scrolled past it, with slide 2 as the cover. Slide 2 therefore works as a second hook. It opens with its own subject and never with "So", "First", "And" or "Then". The strongest slide 2 is often the plain statement of the whole argument.

## Copy

- **Lead with the reader's problem.** The tool, the method and the offer come after it.
- **Use the person's own words.** When they gave a voice note or a rough paragraph, keep their phrasing, their rhythm and their odd asides.
- **Vary sentence length.** A short line, then a longer one that carries the thought, then a short one.
- **Bold one or two phrases per slide.** Mark them with `**double asterisks**`. Bold the core phrase and leave the sentence around it plain. Reading only the bold text across the slides gives the argument.
- **Use only facts from `studio/context.md` or from the person.** Write `[FILL IN: what is needed]` where a fact is missing.
- **Keep it readable at phone size.** The length limit for each slide type is in the table above. When a slide runs over, split it or cut a line.

## The call to action

One action. With a comment keyword set in `studio/brand.json`, the last slide draws the keyword as a button, the slide copy asks for it, and the caption names the same word. Without a keyword, ask for the one plain action that fits: save this, send it to someone, follow for the next part.

## Before posting

```
[ ] Hook: would I stop scrolling for this?
[ ] Voice: read aloud, does it sound like me?
[ ] Flow: does each slide earn the next swipe?
[ ] One point per slide?
[ ] Slide 2 works alone?
[ ] Bold phrases read as the argument?
[ ] Call to action is one obvious step?
[ ] Caption adds a second angle?
[ ] One slide worth saving?
[ ] check reports no findings?
```
