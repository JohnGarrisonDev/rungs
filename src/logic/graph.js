// Word-ladder graph helpers. Pure: no DOM, no word list. Every function takes `has(word) -> bool`, the dictionary
// to walk through, so the same code runs over the puzzle words, the full guess list or a tiny test dictionary.
// Neighbour order is fixed (position 0 first, then a..z), so every search here is deterministic.
const A = 97

/** Number of positions where a and b differ (Infinity when the lengths differ). */
export function diffCount(a, b) {
  if (a.length !== b.length) return Infinity
  let n = 0
  for (let i = 0; i < a.length; i++) if (a.charCodeAt(i) !== b.charCodeAt(i)) n++
  return n
}
export const isOneApart = (a, b) => diffCount(a, b) === 1

/** All dictionary words exactly one letter away from `word`. */
export function neighbors(word, has) {
  const out = []
  for (let i = 0; i < word.length; i++) {
    const pre = word.slice(0, i), post = word.slice(i + 1), cur = word.charCodeAt(i)
    for (let c = A; c < A + 26; c++) {
      if (c === cur) continue
      const w = pre + String.fromCharCode(c) + post
      if (has(w)) out.push(w)
    }
  }
  return out
}

/** Breadth-first distances from `src` (included, distance 0). Stops early once `until` is reached, if given. */
export function distancesFrom(src, has, until = null) {
  const dist = new Map([[src, 0]])
  let frontier = [src]
  while (frontier.length) {
    const next = []
    for (const w of frontier) {
      const d = dist.get(w) + 1
      for (const n of neighbors(w, has)) {
        if (dist.has(n)) continue
        dist.set(n, d)
        if (n === until) return dist
        next.push(n)
      }
    }
    frontier = next
  }
  return dist
}

/** Fewest steps from a to b, or -1 when there is no way through. The end words themselves need not be in `has`. */
export function distance(a, b, has) {
  if (a === b) return 0
  if (a.length !== b.length) return -1
  const d = distancesFrom(b, (w) => w === a || has(w), a).get(a)
  return d === undefined ? -1 : d
}

/** A shortest path [a, ..., b] (both ends included), or null. Ties break by neighbour order, so it is stable. */
export function shortestPath(a, b, has) {
  if (a === b) return [a]
  if (a.length !== b.length) return null
  const dist = distancesFrom(b, (w) => w === a || has(w), a)
  if (!dist.has(a)) return null
  const path = [a]
  let cur = a
  while (cur !== b) {
    const d = dist.get(cur)
    const step = neighbors(cur, (w) => dist.get(w) === d - 1)[0]
    if (!step) return null
    path.push(step); cur = step
  }
  return path
}

/** A shortest path [a, ..., b] that steps on as few `dull(word)` words as possible (1.3: plurals on the robot's route).
 *  Same length as shortestPath; among equally dull paths, ties break by neighbour order. Null when there is no way. */
export function nicestPath(a, b, has, dull) {
  if (a === b) return [a]
  if (a.length !== b.length) return null
  const dist = distancesFrom(b, (w) => w === a || has(w), a)
  if (!dist.has(a)) return null
  const memo = new Map([[b, 0]])
  const cost = (w) => {
    if (memo.has(w)) return memo.get(w)
    const d = dist.get(w)
    let best = Infinity
    for (const n of neighbors(w, (x) => dist.get(x) === d - 1)) best = Math.min(best, cost(n))
    const c = best + (dull(w) ? 1 : 0)
    memo.set(w, c)
    return c
  }
  const path = [a]
  let cur = a
  while (cur !== b) {
    const d = dist.get(cur)
    let pick = null, pc = Infinity
    for (const n of neighbors(cur, (x) => dist.get(x) === d - 1)) { const c = cost(n); if (c < pc) { pc = c; pick = n } }
    if (!pick) return null
    path.push(pick); cur = pick
  }
  return path
}

/** The words of the biggest connected group in `list`. */
export function mainComponent(list, has) {
  const seen = new Set()
  let best = []
  for (const w of list) {
    if (seen.has(w)) continue
    const comp = [...distancesFrom(w, has).keys()]
    for (const c of comp) seen.add(c)
    if (comp.length > best.length) best = comp
  }
  return best
}
