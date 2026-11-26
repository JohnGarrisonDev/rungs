// The dictionaries. Guess list: every 3-5 letter ENABLE word (anything real is accepted as a rung).
// Puzzle words: the small friendly list that start words, goal words and the robot's route are drawn from.
import { GUESS } from '../data/guess.js'
import { PUZZLE } from '../data/puzzle.js'
import { isBlocked } from './blocklist.js'

export const LENGTHS = [3, 4, 5]
const unpack = (s, n) => { const out = []; for (let i = 0; i + n <= s.length; i += n) out.push(s.slice(i, i + n)); return out }

export const guessList = {}, puzzleList = {}
const guessSet = new Set(), puzzleSet = new Set()
for (const n of LENGTHS) {
  guessList[n] = unpack(GUESS[n], n); puzzleList[n] = unpack(PUZZLE[n], n)
  for (const w of guessList[n]) guessSet.add(w)
  for (const w of puzzleList[n]) puzzleSet.add(w)
}

export const isGuess = (w) => guessSet.has(w)
export const isPuzzle = (w) => puzzleSet.has(w)
/** A guess-list word we are happy to show on screen ourselves. */
export const isHintable = (w) => guessSet.has(w) && !isBlocked(w)

/** Good as a start or goal word: a puzzle word that is not just a 4-letter puzzle word with -s or -d stuck on. */
export function isEndpoint(w) {
  if (!puzzleSet.has(w)) return false
  if (w.length === 5 && (w[4] === 's' || w[4] === 'd') && puzzleSet.has(w.slice(0, 4))) return false
  return true
}
export const endpointList = {}
for (const n of LENGTHS) endpointList[n] = puzzleList[n].filter(isEndpoint)

// ---- 1.3 word version (dailies from WORDS_V2 in generate.js, new Endless ladders, hints)
/** Bookish, old-fashioned or British-only puzzle words. Still accepted when typed, but from version 2 on they are
 *  never a start, goal or robot's-route word. Never edit this set: add a new version instead (see AGENTS.md). */
export const RETIRED = new Set(('dame deem dote flak glen hale hark hind jape lass lest mart mere moot quay ream rend rife rook ' +
  'sire teem vale yule rile canny crone elope endow fiver flout forgo frock glean golly guise hovel knoll laden leant liken ' +
  'lithe lorry mealy mould rouse scald shoal smock stave steed waked wooly').split(' '))
export const isPuzzle2 = (w) => puzzleSet.has(w) && !RETIRED.has(w)
/** A plural or past form of a shorter puzzle word (CATS, BOARS, BAKED): fine to type, dull on the robot's route. */
export function isInflected(w) {
  if (w.length < 4) return false
  if (w[w.length - 1] === 's' && w[w.length - 2] !== 's' && puzzleSet.has(w.slice(0, -1))) return true
  return w.length === 5 && w.endsWith('ed') && puzzleSet.has(w.slice(0, 4))
}
export const endpointList2 = {}
for (const n of LENGTHS) endpointList2[n] = endpointList[n].filter((w) => !RETIRED.has(w))
