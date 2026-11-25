import test from 'node:test'
import assert from 'node:assert/strict'
import { diffCount, isOneApart, neighbors, distancesFrom, distance, shortestPath, mainComponent } from '../src/logic/graph.js'

const dict = (words) => { const s = new Set(words); return (w) => s.has(w) }
const TINY = ['cat', 'cot', 'cog', 'dog', 'dot', 'cut', 'hut', 'zzz', 'zzy']
const has = dict(TINY)

test('diffCount and isOneApart', () => {
  assert.equal(diffCount('cat', 'cat'), 0)
  assert.equal(diffCount('cat', 'cot'), 1)
  assert.equal(diffCount('cat', 'dog'), 3)
  assert.equal(diffCount('cat', 'cats'), Infinity)
  assert.ok(isOneApart('cold', 'cord'))
  assert.ok(!isOneApart('cold', 'cold'))
  assert.ok(!isOneApart('cold', 'card'))
})

test('neighbors finds exactly the one-letter-apart words, in a fixed order', () => {
  assert.deepEqual(neighbors('cot', has), ['dot', 'cat', 'cut', 'cog'])
  assert.deepEqual(neighbors('zzz', has), ['zzy'])
  assert.deepEqual(neighbors('abc', has), [])
})

test('breadth-first distances on a tiny dictionary', () => {
  const d = distancesFrom('cat', has)
  assert.equal(d.get('cat'), 0)
  assert.equal(d.get('cot'), 1)
  assert.equal(d.get('cut'), 1)
  assert.equal(d.get('dot'), 2)
  assert.equal(d.get('cog'), 2)
  assert.equal(d.get('hut'), 2)
  assert.equal(d.get('dog'), 3)
  assert.equal(d.has('zzz'), false)
})

test('distance and shortestPath agree, and handle no-route cases', () => {
  assert.equal(distance('cat', 'dog', has), 3)
  assert.equal(distance('cat', 'cat', has), 0)
  assert.equal(distance('cat', 'zzz', has), -1)
  assert.equal(distance('cat', 'cats', has), -1)
  const p = shortestPath('cat', 'dog', has)
  assert.equal(p.length, 4)
  assert.equal(p[0], 'cat'); assert.equal(p[3], 'dog')
  for (let i = 1; i < p.length; i++) { assert.ok(isOneApart(p[i - 1], p[i])); assert.ok(has(p[i])) }
  assert.deepEqual(shortestPath('cat', 'cat', has), ['cat'])
  assert.equal(shortestPath('cat', 'zzz', has), null)
  assert.deepEqual(shortestPath('cat', 'dog', has), shortestPath('cat', 'dog', has))
})

test('a longer way round is never chosen when a short one exists', () => {
  const h = dict(['aaa', 'aab', 'abb', 'bbb', 'baa', 'bba'])
  assert.equal(distance('aaa', 'bbb', h), 3)
  const h2 = dict(['aaa', 'aab', 'abb', 'bbb', 'aba'])
  assert.deepEqual(shortestPath('aaa', 'bbb', h2), ['aaa', 'aba', 'abb', 'bbb'])
})

test('the start word need not be in the dictionary', () => {
  assert.equal(distance('cab', 'dog', has), 4)
  assert.equal(shortestPath('cab', 'dog', has)[1], 'cat')
})

test('mainComponent returns the biggest connected group', () => {
  const comp = mainComponent(TINY, has)
  assert.equal(comp.length, 7)
  assert.ok(!comp.includes('zzz'))
})
