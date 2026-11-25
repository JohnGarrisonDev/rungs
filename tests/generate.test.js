import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRng } from '../kit/kit.js'
import { makeLadder, endlessLadder, ladderFromPair, HEIGHTS, DAILY_KINDS, ladderHash } from '../src/logic/generate.js'
import { isPuzzle, isEndpoint, isGuess } from '../src/logic/words.js'
import { isOneApart, distance } from '../src/logic/graph.js'

export function assertLadder(l, { len, min, max }) {
  assert.equal(l.start.length, len); assert.equal(l.goal.length, len); assert.equal(l.len, len)
  assert.ok(isEndpoint(l.start) && isEndpoint(l.goal), `${l.start} ${l.goal} endpoints`)
  assert.ok(l.par >= min && l.par <= max, `${l.start}>${l.goal} par ${l.par} in ${min}-${max}`)
  assert.equal(l.route.length, l.par + 1)
  assert.equal(l.route[0], l.start); assert.equal(l.route[l.par], l.goal)
  for (let i = 1; i < l.route.length; i++) assert.ok(isOneApart(l.route[i - 1], l.route[i]) && isPuzzle(l.route[i]), 'route uses puzzle words')
  assert.equal(distance(l.start, l.goal, isPuzzle), l.par, 'par is the true shortest puzzle-word path')
}

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
  }
  assert.equal(endlessLadder(5, 9, 'nope').len, 4)
})
