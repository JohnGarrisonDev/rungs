// Ladder generation: random ladders from the puzzle-word graph, and the three daily ladders for a date.
// Pure and seeded. A ladder is { start, goal, len, par, route, themed } where par = fewest steps through puzzle
// words ("the robot's route") and route is that path, both ends included.
//
// DETERMINISM: dailies must be identical for every player. Anything that changes the order or number of rng()
// calls here, the puzzle word list, the pair list order or the neighbour order in graph.js changes every daily.
// tests/daily.test.js snapshots a few dates. Do not edit those hashes to make the test pass; see AGENTS.md.
import { makeRng, hashString } from '../../kit/kit.js'
import { distancesFrom, distance, shortestPath, nicestPath, diffCount } from './graph.js'
import { endpointList, isPuzzle, isGuess, isEndpoint, endpointList2, isPuzzle2, isInflected, RETIRED } from './words.js'
import { PAIRS } from './pairs.js'
import { JOURNEY_KEYS } from './journey.js'

export const DAILY_KINDS = [
  { id: 'short', name: 'Short', len: 4, min: 3, max: 4, themedIn: 3 },
  { id: 'tall', name: 'Tall', len: 4, min: 5, max: 7, themedIn: 3 },
  { id: 'towering', name: 'Towering', len: 5, min: 5, max: 8, themedIn: 6 },
]
// Used only if the random search fails 80 times in a row (it never has).
const FALLBACK = { 3: ['cat', 'dog'], 4: ['cold', 'warm'], 5: ['stare', 'blink'] }

export function ladderFromPair(start, goal, themed = false) {
  const route = shortestPath(start, goal, isPuzzle)
  if (!route) return null
  return { start, goal, len: start.length, par: route.length - 1, route, themed }
}

/** A random ladder of `len` letters whose par is within [min, max]. */
export function makeLadder(rng, { len, min, max }) {
  const ends = endpointList[len]
  for (let attempt = 0; attempt < 80; attempt++) {
    const start = ends[rng.int(ends.length)]
    const want = min + rng.int(max - min + 1)
    const dist = distancesFrom(start, isPuzzle)
    // Goals at exactly the wanted height; prefer ones that share no letter position with the start (a proper climb).
    let pool = ends.filter((w) => dist.get(w) === want)
    const clean = pool.filter((w) => diffCount(w, start) === len)
    if (clean.length >= 3) pool = clean
    if (!pool.length) continue
    const goal = pool[rng.int(pool.length)]
    // Rare words may shave a step off (that is the "under par" treat), but not make par look silly.
    if (distance(start, goal, isGuess) < want - 1) continue
    return ladderFromPair(start, goal)
  }
  return ladderFromPair(FALLBACK[len][0], FALLBACK[len][1])
}

const themedFor = (kind) => PAIRS.filter(([a, b, p]) => a.length === kind.len && p >= kind.min && p <= kind.max && !JOURNEY_KEYS.has(a + '>' + b))

// ---- version 2 (1.3): no bookish words (RETIRED) at the ends or on the robot's route, and the route avoids plurals
// and past forms whenever an equally short way exists. Par is fewest steps through isPuzzle2. Used by dailies from
// WORDS_V2 on and by Endless ladders started in 1.3 or later. Version 1 above stays exactly as it was.
export const WORDS_V2 = '2026-11-28'
export function ladderFromPair2(start, goal, themed = false) {
  const route = nicestPath(start, goal, isPuzzle2, isInflected)
  if (!route) return null
  return { start, goal, len: start.length, par: route.length - 1, route, themed }
}
export function makeLadder2(rng, { len, min, max }) {
  const ends = endpointList2[len]
  for (let attempt = 0; attempt < 80; attempt++) {
    const start = ends[rng.int(ends.length)]
    const want = min + rng.int(max - min + 1)
    const dist = distancesFrom(start, isPuzzle2)
    let pool = ends.filter((w) => dist.get(w) === want)
    const clean = pool.filter((w) => diffCount(w, start) === len)
    if (clean.length >= 3) pool = clean
    if (!pool.length) continue
    const goal = pool[rng.int(pool.length)]
    if (distance(start, goal, isGuess) < want - 1) continue
    const ladder = ladderFromPair2(start, goal)
    // a route that cannot avoid two plurals reads badly: try another pair (rarely needed)
    if (attempt < 60 && ladder.route.filter(isInflected).length > 1) continue
    return ladder
  }
  return ladderFromPair2(FALLBACK[len][0], FALLBACK[len][1])
}
function dailyLadders2(dateKey) {
  const rng = makeRng(hashString('rungs:v2:' + dateKey))
  return DAILY_KINDS.map((kind) => {
    let ladder = null
    if (rng.int(kind.themedIn) === 0) {
      const pool = themedFor(kind).filter(([a, b]) => !RETIRED.has(a) && !RETIRED.has(b))
      const [a, b] = pool[rng.int(pool.length)]
      if (isEndpoint(a) && isEndpoint(b)) ladder = ladderFromPair2(a, b, true)
      if (ladder && (ladder.par < kind.min || ladder.par > kind.max)) ladder = null
    }
    if (!ladder) ladder = makeLadder2(rng, kind)
    return { ...ladder, kind: kind.id }
  })
}

/** The three ladders for a local date key 'YYYY-MM-DD'. Same for everyone. Dates up to 2026-11-27 are published
 *  and frozen (tests/daily.test.js): they keep the version 1 path below, untouched. */
export function dailyLadders(dateKey) {
  if (dateKey >= WORDS_V2) return dailyLadders2(dateKey)
  const rng = makeRng(hashString('rungs:' + dateKey))
  return DAILY_KINDS.map((kind) => {
    let ladder = null
    if (rng.int(kind.themedIn) === 0) {
      const pool = themedFor(kind)
      const [a, b] = pool[rng.int(pool.length)]
      if (isEndpoint(a) && isEndpoint(b)) ladder = ladderFromPair(a, b, true)
      if (ladder && (ladder.par < kind.min || ladder.par > kind.max)) ladder = null
    }
    if (!ladder) ladder = makeLadder(rng, kind)
    return { ...ladder, kind: kind.id }
  })
}

/** Endless mode: heights the player can pick, per word length. */
export const HEIGHTS = [
  { id: 'low', name: 'Low', min: 2, max: 3 },
  { id: 'mid', name: 'Middling', min: 4, max: 5 },
  { id: 'high', name: 'High', min: 6, max: 8 },
]
/** `w` is the word version saved with the ladder: 2 for ladders started in 1.3+, missing (1) for older saves, so a
 *  resumed ladder comes back exactly as it was. */
export function endlessLadder(seed, len, heightId, w = 1) {
  const h = HEIGHTS.find((x) => x.id === heightId) || HEIGHTS[1]
  const make = w >= 2 ? makeLadder2 : makeLadder
  return make(makeRng(seed >>> 0), { len: [3, 4, 5].includes(len) ? len : 4, min: h.min, max: h.max })
}

/** Stable fingerprint of a ladder, for snapshot tests. */
export const ladderHash = (l) => hashString(`${l.start}>${l.goal}:${l.par}:${l.route.join(',')}`)
