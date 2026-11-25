# Rungs

A word-ladder game for [Oddvale Games](https://games.oddvale.com). An odd little robot climbs a wonky ladder, and every rung is a word. The bottom rung is the start word, the top rung is the goal. Change **exactly one letter** to make the next rung, every step a real word, and reach the top in as few rungs as you can.

- **Daily:** three ladders per calendar day, the same for everyone: Short (4 letters, par 3-4), Tall (4 letters, par 5-7) and Towering (5 letters, par 5-8). Streaks, a 14-day archive, and a copyable spoiler-free result.
- **Journey:** 60 hand-picked ladders in 6 chapters (cat to dog, cold to warm, black to white ...), up to 3 stars each.
- **Endless:** pick 3, 4 or 5 letters and a height, random ladders forever.

There is no way to fail: undo climbs back down, a hint gives the next word, and the ladder simply grows if you wander. **Par** is the robot's own shortest route using everyday words. Rarer words are accepted too, and sometimes beat par.

Designed, built and updated by AI models. No build step, no dependencies, no network requests.

## Run it

Any static file server works. From the hub repo:

```
node ../oddvale-games/scripts/serve.mjs . 4307
```

then open http://127.0.0.1:4307/ . Add `?debug` to the URL to get a `window.__game` hook for automated play-testing (`__game.state()`, `__game.type('cord')`, `__game.solve()`, `__game.step(ms)` ...).

## Test it

```
node --test tests/
```

The tests cover the graph search on tiny hand-made dictionaries, the word lists, every themed pair and Journey ladder (solvable in exactly its stated par), the generator's par bands, daily determinism with snapshot hashes, move validation, hints, the save sanitiser, streaks and the share text.

## Controls

| | Change one letter | Type a whole word | Undo | Hint |
|---|---|---|---|---|
| Touch / mouse | tap a letter of the next rung, then a key | tap the keys, then Enter | curved-arrow button | bulb button |
| Keyboard | Left / Right to pick a letter, then type it | type it, Enter | Down arrow or Ctrl+Z | ? |

`Esc` goes back. The flag button gives up and shows the robot's route (tap twice).

## Words

The dictionary is the public-domain **ENABLE** word list (Enhanced North American Benchmark Lexicon, by Alan Beale and others, released into the public domain). Only its 3, 4 and 5 letter words are shipped, in `src/data/guess.js`: any of them is accepted as a rung. Start words, goal words and the robot's route come from a much smaller hand-written list of common, family-friendly words in `tools/puzzle-words.txt` (built into `src/data/puzzle.js`). A small blocklist in `src/logic/blocklist.js` keeps offensive words out of puzzles and hints.

## Layout

```
index.html              page shell (from the hub's kit/template.html)
game.json               metadata the hub reads
cover.webp              cover art (supplied separately)
kit/                    copy of the hub kit. Do not edit; re-copy from the hub to update
src/main.js             app state, screen flow, input, saving, frame loop, debug hook
src/ui.js               DOM overlays: title, daily, journey, endless, HUD, keyboard, result card
src/scene.js            canvas drawing: sky, ladder, tiles, robot, bell, confetti
src/audio.js            synth sound effects
src/game.css            styles for everything inside the stage
src/data/guess.js       GENERATED: every 3-5 letter ENABLE word
src/data/puzzle.js      GENERATED: the curated puzzle words
src/logic/              pure rules, no DOM, shared with the tests
  graph.js              one-letter-apart graph: neighbours, BFS distance, shortest path
  words.js              the dictionaries as sets and lists
  blocklist.js          words never used in puzzles or hints
  pairs.js              GENERATED: 370 themed pairs with their par
  journey.js            the 60 Journey ladders
  generate.js           random ladders, the three dailies, endless ladders
  session.js            a ladder in play: check, move, undo, hint, reveal, snapshot/restore
  score.js              ratings, stars, dates, streaks, share text
  save.js               save schema + sanitiser
tools/                  dev-only: word list and pair builders and their source lists
tests/                  node --test
```

See [AGENTS.md](AGENTS.md) for architecture notes, how to add words and ladders, and the ideas backlog.

## License
Code is MIT licensed, see [LICENSE](LICENSE). The ENABLE word list is public domain. The fonts in `kit/fonts/` (Fraunces, Figtree, DM Mono) are under the SIL Open Font License 1.1. The Oddvale name and mark are not covered by the MIT license.
