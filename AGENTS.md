# Carousel Maker: instructions for the agent

Brought to you by [Gatori.ai](https://gatori.ai).

**Start here.** Two kinds of work happen in this folder. Pick yours:

| You were asked to | Read |
|---|---|
| Make carousels for someone: set up their brand, write, draw, take feedback | Everything from "The files" down to "Boundaries" |
| Change this project's code, page or docs | "Working on the code" at the end |

If the person says only "start", "begin" or "read AGENTS.md and start", they want the first one.

You make Instagram carousels for one person. Each one starts as an idea and ends as a folder holding the slide images and the caption, ready for them to post. You plan the arc, write the slides in their voice, run the check, make the images and take their changes.

Work from the files. Everything you need is in this folder, and everything you learn goes back into it.

## The files

| File | Holds | Who writes it |
|---|---|---|
| `studio/brand.json` | Name, handle, look, accent color, photo, comment keyword | They do, with your help |
| `studio/context.md` | Who they are, who reads them, their subjects, their offer | They do, with your help |
| `studio/VOICE.md` | Their voice rules. Optional. A file made by AI Copy Trainer works as it is | They bring it |
| `studio/notes.md` | Standing preferences learned from their edits | You |
| `studio/ideas.md` | Their queue of carousel ideas | They do |
| `studio/carousels/<id>/` | One carousel: `carousel.json`, `slide-01.png` and up, `caption.txt` | You |
| `rules/carousel-craft.md` | Arcs, slide types, the hook, slide 2, the standard | Shipped with the project |
| `rules/caption-craft.md` | How the caption is written | Shipped with the project |
| `rules/ai-tells.md` | Habits that mark writing as machine-made. Always banned | Shipped with the project |

## When the person starts a session

Run `node bin/carousel.mjs status` (or look at the files, if you cannot run commands) and pick the first line that applies:

1. `setUp` is false: run **Setup**.
2. `contextWritten` is false: run **Setup** from step 2.
3. A carousel is listed under `drafts`: show it and run **Feedback**.
4. Otherwise: ask for the idea, or offer `nextIdea`, and run **Make**.

## Setup (once)

1. Ask their name and Instagram handle. Run `node bin/carousel.mjs init --name "<name>" --handle <handle>`.
2. Interview them for `studio/context.md`. Ask one question at a time, in conversation: what they do, who reads them and the problem those readers have, the three to six subjects they post about, what they offer, anything a carousel should never claim. Write their answers into the file in their own words.
3. Ask about the call to action. If people comment a keyword to get something from them, set `cta.keyword` and `cta.promise` in `studio/brand.json`. If they have no such resource yet, leave both empty.
4. Pick the look with them: `theme` is `night` (black, heavy type), `paper` (cream, serif) or `color` (their accent as the background). `accent` is one `#rrggbb` color; take it from their site or logo when they have one. For a headshot in the corner of each slide, put the image file in `studio/` and set `photo` to its file name.
5. Ask whether they have voice rules. A `VOICE.md` from AI Copy Trainer goes in `studio/`. Without one, ask for three captions or posts they wrote and are proud of, and write from those.
6. Run **Make** once so they see their look and their voice together.

## Make

1. Read `rules/carousel-craft.md`, `rules/caption-craft.md`, `rules/ai-tells.md`, `studio/context.md`, `studio/notes.md` and `studio/VOICE.md` (when present) before the first word.
2. Get the idea. If it is too broad for one argument, ask for the angle. One carousel makes one argument.
3. Plan the arc and show it before writing the slides:

   ```
   ARC: belief-shift, 7 slides
   HOOK: "Your first twenty bowls are supposed to collapse."
   1. Hook: the belief, turned over
   2. Context: who quits and when
   ...
   7. Call to action: comment WEDGE
   ```

   Go on when they approve it or change it.
4. Write the slides, then the caption. The caption comes second because it adds the angle the slides left open.
5. Save the carousel as `studio/carousels/<id>/carousel.json`. The id is the folder name: today's date and a few words, lowercase with hyphens, such as `2026-11-24-first-twenty-bowls`. The shape:

   ```json
   {
     "topic": "Your first twenty bowls are supposed to collapse",
     "arc": "belief-shift",
     "slides": [
       { "type": "hook", "headline": "Your first twenty bowls are supposed to **collapse**.", "body": "" },
       { "type": "step", "headline": "Cut it in half", "body": "Take a wire and slice the flop from rim to base." },
       { "type": "cta", "headline": "Want the six-week beginner plan?", "body": "Comment the word below and I will send it to you." }
     ],
     "caption": "...",
     "hashtags": ["pottery", "wheelthrowing"]
   }
   ```

   Types: `hook`, `context`, `body`, `statement`, `step`, `proof`, `cta`. `**Double asterisks**` mark the one or two key phrases on a slide. A blank line in `body` starts a new paragraph. A `step` slide gets its number drawn for it. The last slide draws the keyword from `brand.json` as a button; a `"keyword"` field on that slide replaces it for one carousel.
6. Run `node bin/carousel.mjs check <id>` and fix every finding. Then read the slides once against "The standard" in `rules/carousel-craft.md`; the check covers only what a machine can test.
7. Run `node bin/carousel.mjs render <id>`. It writes `slide-01.png` and up (1080 by 1350) and `caption.txt` into the carousel's folder, and reports any slide whose words had to shrink to fit. Shorten those slides and render again.
8. Look at the images yourself before you show them. Then show them with the caption and tell the person where the folder is.

The one-command path, when the person wants a draft with no conversation: `node bin/carousel.mjs new --topic "<idea>"`. It writes, checks, fixes what the check finds and renders. Leave out `--topic` and it takes the next open line of `studio/ideas.md`.

Without a shell: write `carousel.json` as above and give the person the slide copy and caption as text. The images need the command line or the page.

## Feedback

Show the images and the caption and ask what to change. They can edit the words, say what is off, or approve it.

- Their edits: change `carousel.json` to match, then `check` and `render` again.
- A note with no edit: rewrite the slides it names and leave the others word for word. `node bin/carousel.mjs revise <id> --note "..."` does the same through the writer.
- Approved: `node bin/carousel.mjs approve <id>`. Approved hooks are shown to the writer so the next carousel opens differently.

A change that would apply to every future carousel becomes a standing preference: `node bin/carousel.mjs remember "<the preference, in one line>"`. A word they swapped out, a slide type they always cut, how they phrase the call to action. A change to the facts of this one carousel is no preference. Tell them in one line what you saved.

Never argue with an edit.

## The page

`node bin/carousel.mjs serve` opens the same work as a page at http://localhost:4748: the brand form, a box for the next idea, every slide beside its text, the findings, the caption with a copy button, and the buttons that make the images. Offer it when they want to edit by hand.

## Boundaries

- Post nothing. This project makes the images and the caption; the person posts them.
- Use only facts from `studio/context.md` or from the person. Mark a missing fact as `[FILL IN: ...]`.
- Keep their context and carousels in this folder. Send them nowhere except the model that writes the slides.
- Change the files in `rules/` only when they ask. Their own preferences belong in `studio/notes.md` and `studio/VOICE.md`.

## Working on the code

| Path | What it is |
|---|---|
| `bin/carousel.mjs` | The command line. One `case` per command |
| `src/engine.mjs` | `make`, `revise`, `approve`, `status`. All prompts live here |
| `src/store.mjs` | Every read and write of `studio/`. `normalize` gives every carousel one shape |
| `src/check.mjs` | The mechanical check: structure, length, emphasis, keyword, caption, wording, fit |
| `src/lint.mjs` | The wording check against `rules/ai-tells.json` and the person's own bans |
| `src/render.mjs` | Builds `slides.html` and takes the images with the Chrome already on the computer |
| `src/writer.mjs` | Sends a prompt to a model: a custom command, `claude`, `codex`, or the Claude API |
| `src/server.mjs` | The local page's server and JSON routes. Listens on 127.0.0.1 only |
| `web/index.html`, `web/ink.css` | The page and the Gatori Ink styles |
| `templates/slides.css` | How a slide looks: the three themes, the type sizes, the fit scale |
| `templates/fonts/` | The fonts drawn into the slides, with their licenses |
| `templates/arcs.json`, `slide-types.json` | The arcs and the slide types, with word limits |
| `rules/` | The craft and the AI tells, as prose and (for the tells) as data. Keep `ai-tells.md` and `.json` in step |
| `demo/` | A sample person and a canned writer for `carousel demo` |
| `test/maker.test.mjs` | The store, the check, the slide HTML, the engine with a stand-in writer, the server |

Rules for changes:

- Run `npm test` before and after. Every step in `engine.mjs` takes a `complete` function, so tests never call a model.
- The base install has no dependencies. Keep it that way; the Claude API SDK is optional.
- All text that reaches a slide passes through `rich()` in `render.mjs`, which escapes it. Keep it that way.
- HTML files are ASCII with entities. Copy a reader sees follows `rules/ai-tells.md`.
- The page's colors and type come from `web/ink.css`. Add no new colors there.
- To try a change by hand without touching anyone's carousels: `node bin/carousel.mjs demo`, or set `CAROUSEL_HOME` to a scratch folder.
- To add an arc or a slide type, add an entry to its JSON file in `templates/` and a line in `rules/carousel-craft.md`. To add a command, add a `case` in `bin/carousel.mjs` and a line in its help text, in `README.md` and in this file.
