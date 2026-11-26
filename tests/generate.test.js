import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRng } from '../kit/kit.js'
import { makeLadder, makeLadder2, endlessLadder, ladderFromPair, HEIGHTS, DAILY_KINDS, ladderHash } from '../src/logic/generate.js'
import { isPuzzle, isPuzzle2, isEndpoint, isGuess, isInflected, RETIRED } from '../src/logic/words.js'
import { isOneApart, distance, nicestPath, shortestPath } from '../src/logic/graph.js'

/** v2: the 1.3 word version (no retired words anywhere on the route, par through isPuzzle2). */
export function assertLadder(l, { len, min, max }, v2 = false) {
  const has = v2 ? isPuzzle2 : isPuzzle
  assert.equal(l.start.length, len); assert.equal(l.goal.length, len); assert.equal(l.len, len)
  assert.ok(isEndpoint(l.start) && isEndpoint(l.goal), `${l.start} ${l.goal} endpoints`)
  assert.ok(l.par >= min && l.par <= max, `${l.start}>${l.goal} par ${l.par} in ${min}-${max}`)
  assert.equal(l.route.length, l.par + 1)
  assert.equal(l.route[0], l.start); assert.equal(l.route[l.par], l.goal)
  for (let i = 1; i < l.route.length; i++) assert.ok(isOneApart(l.route[i - 1], l.route[i]) && has(l.route[i]), 'route uses puzzle words')
  assert.equal(distance(l.start, l.goal, has), l.par, 'par is the true shortest puzzle-word path')
  if (v2) assert.ok(!RETIRED.has(l.start) && !RETIRED.has(l.goal), `${l.start}>${l.goal} no retired ends`)
}

test('version 2 ladders: no retired words, and the route avoids plurals when it can', () => {
  let dull = 0, total = 0
  for (const kind of DAILY_KINDS) for (let seed = 1; seed <= 40; seed++) {
    const l = makeLadder2(makeRng(seed * 7919), kind)
    assertLadder(l, kind, true)
    const n = l.route.filter(isInflected).length
    assert.ok(n <= 1, `${l.route.join(' ')} has ${n} plurals`)
    // no equally short route has fewer plurals
    assert.equal(n, nicestPath(l.start, l.goal, isPuzzle2, isInflected).filter(isInflected).length)
    dull += n; total++
  }
  assert.ok(dull / total < 0.1, `plural share ${dull}/${total}`)
  for (const w of RETIRED) assert.ok(isPuzzle(w) && !isPuzzle2(w), w)
  assert.ok(isInflected('cats') && isInflected('baked') && isInflected('boars'))
  assert.ok(!isInflected('board') && !isInflected('brand') && !isInflected('glass') && !isInflected('bass'))
})

test('nicestPath is as short as shortestPath and skips dull words when it can', () => {
  for (const [a, b] of [['cold', 'warm'], ['stare', 'blink'], ['cat', 'dog']]) {
    const p = nicestPath(a, b, isPuzzle, isInflected), q = shortestPath(a, b, isPuzzle)
    assert.equal(p.length, q.length)
    assert.ok(p.filter(isInflected).length <= q.filter(isInflected).length)
  }
  assert.equal(nicestPath('cold', 'zzzz', isPuzzle, isInflected), null)
})

test('ladderFromPair computes par and route', () => {
  const l = ladderFromPair('cold', 'warm')
  assert.equal(l.par, 4)
  assert.equal(l.route.length, 5)
  assert.equal(ladderFromPair('cold', 'zzzz'), null)
})

test('random ladders fall in their band, only use puzzle words, and rare words save at most one step', () => {
  for (const kind of DAILY_KINDS) for (let seed = 1; seed <= 25; seed++) {
    const l = makeLadder(makeRng(seed * 7919), kind)
    assertLadder(l, kind)
    assert.ok(distance(l.start, l.goal, isGuess) >= l.par - 1)
  }
})

test('endless ladders respect length and height, and are repeatable from the seed', () => {
  for (const len of [3, 4, 5]) for (const h of HEIGHTS) for (let seed = 0; seed < 6; seed++) {
    const a = endlessLadder(seed * 104729 + len, len, h.id)
    assertLadder(a, { len, min: h.min, max: h.max })
    assert.equal(ladderHash(a), ladderHash(endlessLadder(seed * 104729 + len, len, h.id)))
    const b = endlessLadder(seed * 104729 + len, len, h.id, 2)
    assertLadder(b, { len, min: h.min, max: h.max }, true)
  }
  // a ladder saved before 1.3 (no word version) comes back exactly as it was generated in 1.2
  assert.equal(ladderHash(endlessLadder(42, 4, 'mid')), ladderHash(makeLadder(makeRng(42), { len: 4, min: 4, max: 5 })))
  assert.equal(endlessLadder(5, 9, 'nope').len, 4)
})
