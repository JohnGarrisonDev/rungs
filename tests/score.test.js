import test from 'node:test'
import assert from 'node:assert/strict'
import { rating, stars, dateKey, isDateKey, addDays, prettyDate, dayFinished, dayClean, dayCount, dayOver, creditDay, streakNow, shareText } from '../src/logic/score.js'
import { dailyLadders } from '../src/logic/generate.js'

test('ratings', () => {
  assert.equal(rating(3, 4).label, 'Under par!')
  assert.equal(rating(4, 4).label, 'Par')
  assert.equal(rating(5, 4).label, '+1 rung')
  assert.equal(rating(6, 4).label, '+2 rungs')
  assert.equal(rating(12, 4).label, '+8 rungs')
  assert.equal(rating(2, 4, true).tone, 'plain')
  for (const n of [1, 4, 5, 6, 8, 30]) assert.ok(rating(n, 4).name)
})

test('stars', () => {
  assert.equal(stars(4, 4, 0), 3)
  assert.equal(stars(3, 4, 0), 3)
  assert.equal(stars(4, 4, 1), 2)
  assert.equal(stars(6, 4, 0), 2)
  assert.equal(stars(6, 4, 1), 2)
  assert.equal(stars(7, 4, 0), 1)
  assert.equal(stars(4, 4, 2), 1)
})

test('date keys', () => {
  assert.equal(dateKey(new Date(2026, 10, 24)), '2026-11-24')
  assert.equal(dateKey(new Date(2027, 0, 5, 23, 59)), '2027-01-05')
  assert.ok(isDateKey('2028-02-29'))
  assert.ok(!isDateKey('2027-02-29'))
  assert.ok(!isDateKey('2026-13-01'))
  assert.ok(!isDateKey('nope')); assert.ok(!isDateKey(20261124))
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  assert.equal(addDays('2026-11-24', -13), '2026-11-11')
  assert.equal(prettyDate('2026-11-04'), '4 Nov')
})

const e = (st, n, h, p) => ({ st, n, h, p })
test('day summaries', () => {
  const clean = [e(2, 3, 0, 3), e(2, 7, 1, 6), e(2, 8, 0, 8)]
  const mixed = [e(2, 3, 0, 3), e(3, 2, 0, 6), e(2, 9, 0, 8)]
  const part = [e(2, 3, 0, 3), e(1, 2, 0, 6), e(0, 0, 0, 8)]
  assert.ok(dayFinished(clean) && dayClean(clean))
  assert.ok(dayFinished(mixed) && !dayClean(mixed))
  assert.ok(!dayFinished(part) && !dayClean(part))
  assert.equal(dayCount(part), 1); assert.equal(dayCount(mixed), 3); assert.equal(dayCount(undefined), 0)
  assert.equal(dayOver(clean), 1); assert.equal(dayOver(mixed), 1)
  assert.ok(!dayClean(null)); assert.ok(!dayFinished([e(2, 1, 0, 1)]))
})

test('streaks: consecutive days add up, a gap resets, the same day counts once', () => {
  const d = { streak: 0, best: 0, last: '' }
  creditDay(d, '2026-11-24'); assert.equal(d.streak, 1)
  creditDay(d, '2026-11-24'); assert.equal(d.streak, 1)
  creditDay(d, '2026-11-25'); creditDay(d, '2026-11-26')
  assert.equal(d.streak, 3); assert.equal(d.best, 3)
  assert.equal(streakNow(d, '2026-11-26'), 3)
  assert.equal(streakNow(d, '2026-11-27'), 3, 'still alive until the end of the next day')
  assert.equal(streakNow(d, '2026-11-28'), 0)
  creditDay(d, '2026-11-29')
  assert.equal(d.streak, 1); assert.equal(d.best, 3)
})

test('share text is short, ends with the URL and never reveals a word', () => {
  const sum = [e(2, 3, 0, 3), e(2, 7, 1, 6), e(2, 8, 0, 8)]
  assert.equal(shareText('2026-11-24', sum), 'Rungs 2026-11-24 · Short 3/3 · Tall 7/6 · Towering 8/8 💡1\ngames.oddvale.com/rungs')
  assert.equal(shareText('2026-11-24', [e(2, 3, 0, 3), e(3, 2, 0, 6), e(0, 0, 0, 8)]), 'Rungs 2026-11-24 · Short 3/3 · Tall 👀/6 · Towering –/8\ngames.oddvale.com/rungs')
  assert.ok(shareText('2026-11-24', null).endsWith('games.oddvale.com/rungs'))
  const words = shareText('2026-11-24', sum).toLowerCase().split(/[^a-z]+/)
  for (const l of dailyLadders('2026-11-24')) for (const w of l.route) assert.ok(!words.includes(w), w)
})
