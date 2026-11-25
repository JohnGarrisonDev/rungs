# Notes for the next AI

Rungs is an Oddvale Games title. Read the hub's `GAME_GUIDE.md` first (no build step, no dependencies, relative URLs, localStorage only, strict CSP: no inline scripts, no `eval`). This file is what you need on top of that.

## Architecture in one minute

- `src/logic/*` is pure: no DOM, no clock, no `window`. All rules live there and are covered by `tests/`. If a rule changes, change it there and add a test.
- `src/main.js` owns the app: one `app` object (screen, current day, chapter, `app.play` = the ladder on screen), the `actions` table (every button and key lands here by name), saving and the frame loop.
- `src/ui.js` builds the DOM overlays once and exposes dumb setters. Buttons carry `data-act="name"`; one click listener calls `actions[name](dataset, element)`. Keyboard keys and entry tiles fire on `pointerdown` so fast thumbs never lose a tap (the following click is swallowed).
- `src/scene.js` draws the canvas every frame: sky, scenery, rails, rungs, tiles, robot, bell, confetti. It holds only animation state. Logic is instant; the picture catches up. `main.js` tells it `setLadder` (snap), `setWords` (one rung up or down, animated), `setPreview` (typed letters on the next rung), `celebrate`.
- The canvas fills the whole stage. Each screen with art has an empty `.slot` element; `layout()` in `main.js` measures it and the scene fits the ladder inside. So layout is CSS: move the slot, the ladder follows. A ResizeObserver watches the stage and the slots.
- `main.js` adds `.portrait` to the stage when it is taller than wide and sets the `.ui` font-size from the stage size. All sizes in `game.css` are in `em`. Portrait play is a column (HUD, ladder, panel with entry row + keyboard). Landscape play is two columns (HUD, rules card and keyboard on the left, the ladder full height on the right).
- The stage is always light "print on paper", also in dark mode: brand tokens are pinned inside `.ui`.

## The rules, precisely

- A ladder is `{ start, goal, len, par, route, themed }`. **Par** = fewest steps through **puzzle words** (the robot's route). The **guess list** (all ENABLE words of that length) is what players may enter, so a player can finish under par with a rarer word; the result card celebrates that. The generator rejects ladders where rare words would save more than one step.
- "Rungs used" = words the player added, the goal included. COLD, CORD, CARD, WARD, WARM is 4 rungs.
- A move must be the right length, in the guess list, exactly one letter different, and not a word already on the ladder (`session.check`, reasons in `REASONS`). Repeats are blocked with "You've already been there".
- No fail state. Undo pops a rung. A ladder caps at 60 rungs (`MAX_RUNGS`).
- Hint = next word of a shortest path from the **current** word to the goal: puzzle words first, else any guess word that is not on the blocklist (`session.nextStep`). One hint is counted per rung asked about. The hint also selects the letter that changes, so one key tap takes it.
- Give up (`reveal`) ends the ladder and shows the robot's route. It counts as "seen" in the Journey (unlocks the next ladder, no stars).
- Stars (Journey): 3 = at or under par with no hints, 2 = within par + 2 and at most one hint, 1 = finished.
- Streak: a day counts when **all three** daily ladders are finished **without Reveal**, on that calendar day. Archive days never touch the streak. `streakNow` keeps a streak alive through the following day.

## Words (read before touching any list)

- `tools/puzzle-words.txt` is the hand-written source of puzzle words. `node tools/build-words.mjs path/to/enable1.txt` intersects it with ENABLE, drops blocklisted words, sorts, and rewrites `src/data/puzzle.js` and `src/data/guess.js`. ENABLE itself is not in the repo (the guess file has everything we use from it).
- `tools/pair-candidates.txt` holds themed pair ideas. `node tools/build-pairs.mjs` keeps the ones that climb in 2-9 steps and rewrites `src/logic/pairs.js` with their par.
- `src/logic/blocklist.js`: words never used in puzzles or shown as hints (still accepted if typed).
- Endpoints (`isEndpoint`) skip 5-letter words that are just a 4-letter puzzle word plus -s or -d, so a ladder never starts or ends on CARDS or BAKED. Those words can still appear inside a route.

**Any change to the puzzle words changes shortest paths.** That can change a Journey par (tests fail and tell you the new par), drop a themed pair, and it **changes dailies** (see next section). After v1.0.0 treat the puzzle list as frozen unless you version the generator.

## Daily seeds and the snapshot rule

`dailyLadders('YYYY-MM-DD')` seeds `makeRng(hashString('rungs:' + date))` and builds Short, Tall, Towering in that order from the one rng. Each has a 1-in-3 (Towering 1-in-6) chance of being a themed pair from `pairs.js` that fits the band and is not a Journey ladder; otherwise `makeLadder` picks a random start, the wanted par, then a goal at exactly that distance.

Everything that feeds this is part of the daily's identity: the order and number of `rng()` calls in `generate.js`, the puzzle word list (and its sorted order), the order of `PAIRS`, the Journey list (it is excluded from the themed pool), `isEndpoint`, and the neighbour order in `graph.js`. Change any of them and every player's daily changes, mid-day, with in-progress saves pointing at ladders that no longer exist (they are dropped safely, but it is rude).

`tests/daily.test.js` pins five dates with `ladderHash`. **If that test fails, you changed the dailies. Do not paste new hashes in to make it pass.** If you need new words or a better generator, add a new code path chosen by date (for example `if (dateKey >= '2027-06-01') return dailyLaddersV2(dateKey)`) with its own frozen copy of the lists, and leave the old path exactly as it is. Appending to `pair-candidates.txt` is NOT safe either: it changes the themed pool size.

Dates are local calendar days (`dateKey()`), generated with integer maths only.

## Journey

`src/logic/journey.js`: 6 chapters of 10 rows `[start, goal, par]`. Stars are stored by index, so never insert, reorder or remove rows; append a chapter. A test checks every row is a themed pair, solvable in exactly its par, and that difficulty never drops within a word length. To add a chapter: add 10 rows, bump the counts in `tests/pairs.test.js`, `game.json`, README and CHANGELOG. Level `i` unlocks when `i - 1` is finished or revealed.

## Save data

One blob at `oddvale:rungs`; the schema is at the top of `src/logic/save.js`. `sanitize()` rebuilds a clean save from whatever it finds: add new fields there with a default. In-progress ladders are stored as session snapshots (the words typed) and replayed through the rules on load (`session.restore`), so junk or stale snapshots are dropped, never trusted. Daily keeps the newest 120 days (summary + snapshots). `last` remembers which ladder was on screen so a reload drops the player back in.

## Testing by hand

Serve the folder (see README) and open `/?debug`. `window.__game` has `state()`, `step(ms)` (advance animations; background tabs barely run frames, and the result card waits on the animation clock), `type(word)` (real key path + Enter), `solve(leave)`, `reset()`, plus `app`, `save`, `actions`, `scene`, `ui`. Check desktop and a 360-390px wide phone, mouse, touch-style pointer events and the physical keyboard, and keep the console clean. Automation note: synthetic "insert text" typing does not fire `keydown`; send key presses.

`node --test tests/` works because of `tests/index.js`. If you add a test file, import it there.

## Balance and feel notes

- Puzzle list sizes: 406 three-letter, 1,179 four-letter, 1,922 five-letter words. The 4-letter graph is one big blob; the 5-letter main component is about 1,100 words and long (distances up to 25+), which is why Towering stops at par 8.
- 5-letter plurals and -ed forms are in the puzzle list on purpose: they knit the 5-letter graph together. They are just never endpoints.
- Themed 5-letter pairs are scarce (about 30 fit the Towering band), hence the lower themed share for Towering.
- Scenery is tied to height: ground and trees at the bottom, clouds from rung 3, dusk around 7, stars and a moon from about 9. A par-8 ladder ends at dusk; you only see deep night on a long detour or the last Journey chapter. That is deliberate (a small reward for tall climbs).
- The goal rung sits at `max(par, rungs + 1)`: empty dashed rungs up to it show how much room par leaves; go over par and the ladder grows. When the goal is above the view it is pinned at the top with three dots under it.
- Phone key width at 360px is about 29px by 51px tall. Do not add an eleventh key to a row.
- Sound: one pentatonic step per rung (`snd.rung(k)`), a two-knock wooden "nope", a three-strike bell.

## Known weak spots

- Phone landscape: the kit sizes the stage from viewport height, so the stage is small unless the player goes full screen.
- A few puzzle words are still a little bookish (ELOPE, RILE, SNUB). Fixing that means versioning the daily generator (see above).
- The robot's route is one shortest path; ties break by letter position then alphabet, so the shown route is sometimes not the most "natural" of several equal ones.
- Hints on the guess list (after a detour into rare words) can suggest a rare word.
- The canvas redraws every frame even when idle. Fine so far; an idle throttle would save battery.
- The ladder cannot be scrolled by hand; past rungs slide off the bottom and are only listed on the result card.
- No colour-blind toggle beyond the built-in non-colour cues (underline on matched letters, dashed outlines).

## Ideas backlog

- "Greased rung" ladders (one letter position locked for the whole climb) and "Detour" ladders (must pass through a marked middle word) as a 7th Journey chapter or a daily bonus. Both are a filter on the graph search: restrict `has` or chain two shortest paths.
- Drag to scroll the ladder; tap an old rung to undo back to it.
- A share image: the ladder silhouette with blank tiles, coloured by matches.
- Six-letter ladders for Endless (needs a new curated list; the graph is very sparse).
- Per-ladder "best" on Journey buttons and a "perfect chapter" badge.
- A definition peek for rare words the player enters (would need bundled data; no network).
- Weekly "tower": seven dailies stacked, total rungs vs par.
- Robot hats unlocked by stars. The robot deserves hats.
- Haptics on each rung for phones.
