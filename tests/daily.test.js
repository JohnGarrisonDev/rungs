import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyLadders, DAILY_KINDS, ladderHash, WORDS_V2 } from '../src/logic/generate.js'
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
    const ls = dailyLadders(key), v2 = key >= WORDS_V2
    ls.forEach((l, k) => { assert.equal(l.kind, DAILY_KINDS[k].id); assertLadder(l, DAILY_KINDS[k], v2); if (l.themed) themed++; pairs.add(l.start + l.goal) })
    key = addDays(key, 1)
  }
  assert.ok(themed > 40 && themed < 160, `themed share ${themed}/300`)
  assert.ok(pairs.size > 240, 'plenty of variety')
})

// SNAPSHOT: these hashes pin the dailies every player gets. If this test fails you changed the generator, the
// puzzle word list, the pair list or the search order. Do NOT paste new hashes in to make it pass (see AGENTS.md).
// The dates from 2026-11-28 on moved once, in 1.3 (before any of them was published), to word version 2.
const SNAPSHOT = {
  '2026-11-24': [339717947, 519692643, 2501688293],
  '2026-11-28': [3473636881, 1693641739, 2779009847],
  '2026-12-25': [1754499040, 632143798, 4225930728],
  '2027-01-01': [2026159775, 1488925041, 3797361915],
  '2027-02-28': [3943931258, 1975564369, 3085265936],
  '2028-02-29': [2258404077, 3050071312, 2230511935],
}
test('daily snapshot hashes', () => {
  for (const [key, want] of Object.entries(SNAPSHOT)) assert.deepEqual(dailyLadders(key).map(ladderHash), want, key)
})

// FROZEN: every daily up to 2026-11-27 has been published (the archive shows 14 days back). Taken from 1.2.0
// before the 1.3 word version; these must never change.
const PUBLISHED = {
  '2026-11-10': [15396821, 2644542395, 3965930432], '2026-11-11': [1928515617, 966182744, 3148286279],
  '2026-11-12': [3647342199, 662871898, 478491706], '2026-11-13': [2683703049, 3987104836, 2229885016],
  '2026-11-14': [399052273, 4261518158, 3479757850], '2026-11-15': [2522130685, 126490332, 2096387469],
  '2026-11-16': [414441717, 1397959661, 3719597221], '2026-11-17': [2191522732, 701579120, 2386054865],
  '2026-11-18': [399052273, 2804981535, 1199883595], '2026-11-19': [40376119, 3143964821, 640130809],
  '2026-11-20': [3150198773, 3985852349, 1962010757], '2026-11-21': [3404442069, 3897356439, 382942717],
  '2026-11-22': [399052273, 909430010, 1043983920], '2026-11-23': [4175275301, 2892740248, 629154265],
  '2026-11-24': [339717947, 519692643, 2501688293], '2026-11-25': [1467290761, 815570694, 2386376176],
  '2026-11-26': [3956512841, 4100585119, 4221378133], '2026-11-27': [40376119, 3306167442, 208314149],
}
test('published dailies (up to 2026-11-27) are unchanged', () => {
  assert.ok(WORDS_V2 > '2026-11-27')
  for (const [key, want] of Object.entries(PUBLISHED)) assert.deepEqual(dailyLadders(key).map(ladderHash), want, key)
})
