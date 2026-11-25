import test from 'node:test'
import assert from 'node:assert/strict'
import { PAIRS } from '../src/logic/pairs.js'
import { CHAPTERS, JOURNEY, PER_CHAPTER } from '../src/logic/journey.js'
import { isEndpoint, isPuzzle } from '../src/logic/words.js'
import { distance, shortestPath, isOneApart } from '../src/logic/graph.js'

test('there are 150+ themed pairs and each climbs in exactly its stated par', () => {
  assert.ok(PAIRS.length >= 150)
  const seen = new Set()
  for (const [a, b, par] of PAIRS) {
    assert.ok(!seen.has(a + b), `duplicate ${a} ${b}`); seen.add(a + b)
    assert.ok(isEndpoint(a) && isEndpoint(b), `${a} ${b} are puzzle endpoints`)
    assert.ok(par >= 2 && par <= 9)
    assert.equal(distance(a, b, isPuzzle), par, `${a} -> ${b}`)
  }
})

test('the Journey has 6 chapters of 10 solvable ladders with the stated pars', () => {
  assert.equal(CHAPTERS.length, 6)
  assert.equal(JOURNEY.length, 60)
  const seen = new Set()
  for (const c of CHAPTERS) { assert.equal(c.ladders.length, PER_CHAPTER); assert.ok(c.name && c.blurb) }
  for (const l of JOURNEY) {
    assert.ok(!seen.has(l.start + l.goal)); seen.add(l.start + l.goal)
    assert.ok(isEndpoint(l.start) && isEndpoint(l.goal), `${l.start} ${l.goal}`)
    const path = shortestPath(l.start, l.goal, isPuzzle)
    assert.ok(path, `${l.start} -> ${l.goal} solvable`)
    assert.equal(path.length - 1, l.par, `${l.start} -> ${l.goal} par`)
    for (let i = 1; i < path.length; i++) assert.ok(isOneApart(path[i - 1], path[i]) && isPuzzle(path[i]))
  }
})

test('the Journey ramps: 3 letters first, 5 letters last, par never falls within a word length', () => {
  assert.equal(JOURNEY[0].start.length, 3)
  assert.equal(JOURNEY[0].par, 2)
  assert.equal(JOURNEY[59].start.length, 5)
  for (let i = 1; i < JOURNEY.length; i++) {
    const a = JOURNEY[i - 1], b = JOURNEY[i]
    assert.ok(b.start.length >= a.start.length)
    if (b.start.length === a.start.length) assert.ok(b.par >= a.par, `${b.start} par order`)
  }
})

test('every Journey ladder is one of the themed pairs', () => {
  const keys = new Set(PAIRS.map(([a, b]) => a + '>' + b))
  for (const l of JOURNEY) assert.ok(keys.has(l.start + '>' + l.goal), `${l.start} ${l.goal}`)
})
