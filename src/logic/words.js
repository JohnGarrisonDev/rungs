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
