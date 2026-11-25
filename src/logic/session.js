// One ladder in play. Pure: no DOM, no clock.
// A session is { ladder, rungs, hints, hintAt, revealed }: `rungs` are the words the player has added above the
// start word, in order. The climb is finished when the newest rung is the goal word.
import { diffCount, shortestPath, distance } from './graph.js'
import { isGuess, isPuzzle, isHintable } from './words.js'

export const MAX_RUNGS = 60

export const newSession = (ladder) => ({ ladder, rungs: [], hints: 0, hintAt: -1, revealed: false })
export const current = (s) => (s.rungs.length ? s.rungs[s.rungs.length - 1] : s.ladder.start)
export const isDone = (s) => current(s) === s.ladder.goal
export const isOver = (s) => s.revealed || isDone(s)

export const REASONS = {
  over: 'This ladder is finished',
  length: 'Fill every letter',
  same: 'That is the rung you are on',
  notword: 'Not a word',
  oneletter: 'Change exactly one letter',
  repeat: "You've already been there",
  tall: 'This ladder is tall enough. Undo a few rungs',
}

/** Would `word` be a legal next rung? -> { ok: true } or { ok: false, reason } (a key of REASONS). */
export function check(s, word) {
  const cur = current(s)
  if (isOver(s)) return { ok: false, reason: 'over' }
  if (typeof word !== 'string' || word.length !== cur.length) return { ok: false, reason: 'length' }
  if (word === cur) return { ok: false, reason: 'same' }
  if (!isGuess(word)) return { ok: false, reason: 'notword' }
  if (diffCount(word, cur) !== 1) return { ok: false, reason: 'oneletter' }
  if (word === s.ladder.start || s.rungs.includes(word)) return { ok: false, reason: 'repeat' }
  if (s.rungs.length >= MAX_RUNGS) return { ok: false, reason: 'tall' }
  return { ok: true }
}

/** Add a rung. Returns the check result, plus `done` when that rung was the goal. */
export function move(s, word) {
  const res = check(s, word)
  if (!res.ok) return res
  s.rungs.push(word)
  s.hintAt = -1
  return { ok: true, done: isDone(s) }
}

/** Step back down one rung. */
export function undo(s) {
  if (isOver(s) || !s.rungs.length) return false
  s.rungs.pop()
  s.hintAt = -1
  return true
}

/** The next word of a shortest way up from `from`, preferring puzzle words, never showing a blocked word.
 *  -> { word, left } (left = steps still to go after taking it) or null when there is no way from here. */
export function nextStep(from, goal) {
  for (const has of [isPuzzle, isHintable]) {
    const path = shortestPath(from, goal, has)
    if (path && path.length > 1) return { word: path[1], left: path.length - 2 }
  }
  return null
}

/** Ask the robot for the next rung. Counts one hint per rung asked about. */
export function hint(s) {
  if (isOver(s)) return null
  const step = nextStep(current(s), s.ladder.goal)
  if (!step) return null
  if (s.hintAt !== s.rungs.length) { s.hints++; s.hintAt = s.rungs.length }
  return step
}

/** Give up: the robot shows its route. */
export function reveal(s) {
  if (isDone(s)) return false
  s.revealed = true
  return true
}

/** Fewest steps still needed from where the player stands (through any accepted word), or -1. */
export const stepsLeft = (s) => distance(current(s), s.ladder.goal, isGuess)

export const snapshot = (s) => ({ rungs: s.rungs.slice(), hints: s.hints, hintAt: s.hintAt, revealed: s.revealed })

/** Rebuild a session from a snapshot by replaying it through the rules. Returns null if anything is off. */
export function restore(ladder, snap) {
  if (!ladder || !snap || !Array.isArray(snap.rungs)) return null
  const s = newSession(ladder)
  for (const w of snap.rungs) if (!move(s, w).ok) return null
  s.hints = Number.isInteger(snap.hints) && snap.hints >= 0 ? Math.min(snap.hints, 999) : 0
  s.hintAt = Number.isInteger(snap.hintAt) ? snap.hintAt : -1
  s.revealed = !!snap.revealed && !isDone(s)
  return s
}
