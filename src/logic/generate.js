// Ladder generation: random ladders from the puzzle-word graph, and the three daily ladders for a date.
// Pure and seeded. A ladder is { start, goal, len, par, route, themed } where par = fewest steps through puzzle
// words ("the robot's route") and route is that path, both ends included.
//
// DETERMINISM: dailies must be identical for every player. Anything that changes the order or number of rng()
// calls here, the puzzle word list, the pair list order or the neighbour order in graph.js changes every daily.
// tests/daily.test.js snapshots a few dates. Do not edit those hashes to make the test pass; see AGENTS.md.
import { makeRng, hashString } from '../../kit/kit.js'
import { distancesFrom, distance, shortestPath, diffCount } from './graph.js'
import { endpointList, isPuzzle, isGuess, isEndpoint } from './words.js'
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

/** The three ladders for a local date key 'YYYY-MM-DD'. Same for everyone. */
export function dailyLadders(dateKey) {
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
export function endlessLadder(seed, len, heightId) {
  const h = HEIGHTS.find((x) => x.id === heightId) || HEIGHTS[1]
  return makeLadder(makeRng(seed >>> 0), { len: [3, 4, 5].includes(len) ? len : 4, min: h.min, max: h.max })
}

/** Stable fingerprint of a ladder, for snapshot tests. */
export const ladderHash = (l) => hashString(`${l.start}>${l.goal}:${l.par}:${l.route.join(',')}`)
