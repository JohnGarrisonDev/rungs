import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyLadders, DAILY_KINDS, ladderHash } from '../src/logic/generate.js'
import { addDays } from '../src/logic/score.js'
import { assertLadder } from './generate.test.js'

test('a date always gives the same three ladders', () => {
  const a = dailyLadders('2026-11-24'), b = dailyLadders('2026-11-24')
  assert.deepEqual(a, b)
  assert.equal(a.length, 3)
  assert.notDeepEqual(a.map(ladderHash), dailyLadders('2026-11-25').map(ladderHash))
})

test('100 days of dailies stay in their par bands and use only puzzle words', () => {
  let key = '2026-11-24', themed = 0
  const pairs = new Set()
  for (let i = 0; i < 100; i++) {
    const ls = dailyLadders(key)
    ls.forEach((l, k) => { assert.equal(l.kind, DAILY_KINDS[k].id); assertLadder(l, DAILY_KINDS[k]); if (l.themed) themed++; pairs.add(l.start + l.goal) })
    key = addDays(key, 1)
  }
  assert.ok(themed > 40 && themed < 160, `themed share ${themed}/300`)
  assert.ok(pairs.size > 240, 'plenty of variety')
})

// SNAPSHOT: these hashes pin the dailies every player gets. If this test fails you changed the generator, the
// puzzle word list, the pair list or the search order. Do NOT paste new hashes in to make it pass (see AGENTS.md).
const SNAPSHOT = {
  '2026-11-24': [339717947, 519692643, 2501688293],
  '2026-12-25': [2934506207, 1288570888, 948024622],
  '2027-01-01': [3945696227, 3562738084, 1155903907],
  '2027-02-28': [2723077427, 4158914665, 4246005715],
  '2028-02-29': [200198279, 3387470492, 797704833],
}
test('daily snapshot hashes', () => {
  for (const [key, want] of Object.entries(SNAPSHOT)) assert.deepEqual(dailyLadders(key).map(ladderHash), want, key)
})
