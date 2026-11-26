import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitize, defaults, cleanSnap, SAVE_VERSION } from '../src/logic/save.js'

test('junk becomes a clean default save', () => {
  for (const junk of [undefined, null, 42, 'hello', [], [1, 2], { journey: 7, daily: 'x', endless: [], last: 9 }, { daily: { days: { nope: 1 } } }]) {
    const s = sanitize(junk)
    assert.equal(s.v, SAVE_VERSION)
    assert.deepEqual(s, defaults())
  }
})

test('a good save survives a round trip unchanged', () => {
  const good = defaults()
  good.journey = { stars: [3, 2, 1, 0], best: [2, 3, 6, 0], seen: [true, true, true, true], cur: { level: 4, snap: { rungs: ['cot'], hints: 1, hintAt: -1, revealed: false } } }
  good.daily = { days: { '2026-11-24': { sum: [{ st: 2, n: 3, h: 0, p: 3 }, { st: 1, n: 2, h: 1, p: 6 }, { st: 0, n: 0, h: 0, p: 7 }], snaps: [{ rungs: ['cord', 'card', 'ward'], hints: 0, hintAt: -1, revealed: false }, { rungs: ['bolt', 'boat'], hints: 1, hintAt: 2, revealed: false }, null] } }, streak: 2, best: 5, last: '2026-11-23' }
  good.endless = { len: 5, height: 'high', solved: 12, cur: { seed: 123456, len: 5, height: 'high', snap: { rungs: [], hints: 0, hintAt: -1, revealed: false }, done: false } }
  good.last = { mode: 'daily', date: '2026-11-24', idx: 1 }
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(good))), good)
})

test('bad fields are clamped or dropped one by one', () => {
  const s = sanitize({
    journey: { stars: [9, -2, 'x', 2.6], best: [1e9, null], seen: [1, 0], cur: { level: -1, snap: { rungs: [] } } },
    daily: { days: { '2026-02-31': {}, '2026-11-24': { sum: 'x', snaps: [{ rungs: ['COLD'] }, { rungs: [5] }, { rungs: ['card'], hints: 2 }] } }, streak: 4, best: 1, last: 'never' },
    endless: { len: 7, height: 'sky', solved: -5, cur: { seed: 'x', len: 4, height: 'mid', snap: { rungs: [] } } },
    last: { mode: 'daily', date: 'x' },
  })
  assert.deepEqual(s.journey.stars, [3, 0, 0, 3])
  assert.deepEqual(s.journey.best, [999, 0])
  assert.deepEqual(s.journey.seen, [true, false])
  assert.equal(s.journey.cur, null)
  assert.deepEqual(Object.keys(s.daily.days), ['2026-11-24'])
  assert.deepEqual(s.daily.days['2026-11-24'].snaps, [null, null, { rungs: ['card'], hints: 2, hintAt: -1, revealed: false }])
  assert.equal(s.daily.days['2026-11-24'].sum.length, 3)
  assert.equal(s.daily.streak, 0, 'a streak with no date is dropped')
  assert.equal(s.endless.len, 4); assert.equal(s.endless.height, 'mid'); assert.equal(s.endless.solved, 0); assert.equal(s.endless.cur, null)
  assert.equal(s.last, null)
})

test('an Endless ladder keeps its word version: missing (1.2 saves) stays missing, 2 stays 2', () => {
  const snap = { rungs: [], hints: 0, hintAt: -1, revealed: false }
  const cur = { seed: 9, len: 4, height: 'mid', snap, done: false }
  assert.equal(sanitize({ endless: { cur } }).endless.cur.w, undefined)
  assert.equal(sanitize({ endless: { cur: { ...cur, w: 2 } } }).endless.cur.w, 2)
  assert.equal(sanitize({ endless: { cur: { ...cur, w: 7 } } }).endless.cur.w, undefined)
})

test('cleanSnap', () => {
  assert.equal(cleanSnap(null), null)
  assert.equal(cleanSnap({ rungs: new Array(500).fill('cold') }), null)
  assert.equal(cleanSnap({ rungs: ['toolong'] }), null)
  assert.deepEqual(cleanSnap({ rungs: ['cord'], hints: 3.2, hintAt: 1, revealed: 'yes' }), { rungs: ['cord'], hints: 3, hintAt: 1, revealed: true })
})

test('only the newest 120 days are kept', () => {
  const days = {}
  for (let i = 0; i < 200; i++) { const d = new Date(2026, 0, 1 + i); days[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = {} }
  const keys = Object.keys(sanitize({ daily: { days } }).daily.days)
  assert.equal(keys.length, 120)
  assert.equal(keys[119], '2026-07-19')
})
