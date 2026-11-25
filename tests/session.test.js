import test from 'node:test'
import assert from 'node:assert/strict'
import { newSession, current, isDone, isOver, check, move, undo, hint, nextStep, reveal, stepsLeft, snapshot, restore, REASONS, MAX_RUNGS } from '../src/logic/session.js'
import { ladderFromPair, dailyLadders } from '../src/logic/generate.js'
import { distance } from '../src/logic/graph.js'
import { isPuzzle, isGuess, isHintable } from '../src/logic/words.js'
import { isBlocked } from '../src/logic/blocklist.js'

const cold = () => newSession(ladderFromPair('cold', 'warm'))

test('move validation: length, same word, real word, one letter, repeats', () => {
  const s = cold()
  assert.equal(check(s, 'col').reason, 'length')
  assert.equal(check(s, 'cold').reason, 'same')
  assert.equal(check(s, 'colx').reason, 'notword')
  assert.equal(check(s, 'warm').reason, 'oneletter')
  assert.equal(check(s, 'card').reason, 'oneletter')
  assert.equal(check(s, 42).reason, 'length')
  assert.deepEqual(check(s, 'cord'), { ok: true })
  assert.equal(s.rungs.length, 0, 'check does not move')
  assert.ok(move(s, 'cord').ok)
  assert.equal(current(s), 'cord')
  assert.equal(check(s, 'cold').reason, 'repeat')
  assert.ok(move(s, 'card').ok)
  assert.equal(check(s, 'cord').reason, 'repeat')
  for (const r of ['over', 'length', 'same', 'notword', 'oneletter', 'repeat', 'tall']) assert.ok(REASONS[r])
})

test('rare guess-list words are accepted as rungs', () => {
  const s = cold()
  assert.ok(isGuess('cole') && !isPuzzle('cole'))
  assert.ok(move(s, 'cole').ok)
})

test('reaching the goal finishes the ladder; nothing moves after that', () => {
  const s = cold()
  for (const w of ['cord', 'card', 'ward']) assert.deepEqual(move(s, w), { ok: true, done: false })
  assert.deepEqual(move(s, 'warm'), { ok: true, done: true })
  assert.ok(isDone(s) && isOver(s))
  assert.equal(check(s, 'worm').reason, 'over')
  assert.equal(undo(s), false)
  assert.equal(hint(s), null)
  assert.equal(reveal(s), false)
})

test('undo steps down one rung and stops at the bottom', () => {
  const s = cold()
  move(s, 'cord'); move(s, 'card')
  assert.ok(undo(s)); assert.equal(current(s), 'cord')
  assert.ok(undo(s)); assert.equal(current(s), 'cold')
  assert.equal(undo(s), false)
  assert.ok(move(s, 'cord').ok, 'an undone word can be used again')
})

test('the ladder has a height limit', () => {
  const s = cold()
  s.rungs = Array.from({ length: MAX_RUNGS - 1 }, () => 'cord')
  s.rungs.push('cola')
  assert.equal(check(s, 'colt').reason, 'tall')
})

test('hints follow a shortest route, always get closer, and are counted once per rung', () => {
  const s = cold()
  const h = hint(s)
  assert.equal(h.left, 3)
  assert.equal(s.hints, 1)
  assert.deepEqual(hint(s), h); assert.equal(s.hints, 1, 'asking twice on the same rung is one hint')
  move(s, h.word)
  let guard = 0
  while (!isDone(s)) {
    const before = distance(current(s), 'warm', isPuzzle)
    const step = hint(s)
    assert.ok(isPuzzle(step.word))
    assert.equal(distance(step.word, 'warm', isPuzzle), before - 1)
    assert.ok(move(s, step.word).ok)
    assert.ok(++guard < 10)
  }
  assert.equal(s.rungs.length, 4, 'following hints from the start is par')
  assert.equal(s.hints, 4)
})

test('hints still work after a detour through a rare word', () => {
  const s = cold()
  move(s, 'cole')
  const step = hint(s)
  assert.ok(step && isHintable(step.word))
  let guard = 0
  while (!isDone(s)) {
    const before = stepsLeft(s)
    assert.ok(move(s, hint(s).word).ok)
    assert.ok(stepsLeft(s) < before || before === -1)
    assert.ok(++guard < 20)
  }
})

test('hints reduce the distance on real dailies and never show a blocked word', () => {
  for (const l of dailyLadders('2026-11-24').concat(dailyLadders('2027-03-03'))) {
    const s = newSession(l)
    let left = l.par
    while (!isDone(s)) {
      const step = hint(s)
      assert.ok(!isBlocked(step.word))
      assert.equal(step.left, left - 1)
      move(s, step.word); left--
    }
    assert.equal(s.rungs.length, l.par)
  }
  assert.equal(nextStep('zzzz', 'warm'), null)
})

test('reveal ends the climb without finishing it', () => {
  const s = cold()
  move(s, 'cord')
  assert.ok(reveal(s))
  assert.ok(isOver(s) && !isDone(s))
  assert.equal(check(s, 'card').reason, 'over')
})

test('snapshot and restore round-trip; junk snapshots are refused', () => {
  const s = cold()
  move(s, 'cord'); hint(s); move(s, 'card')
  const snap = JSON.parse(JSON.stringify(snapshot(s)))
  const r = restore(s.ladder, snap)
  assert.deepEqual(snapshot(r), snap)
  assert.equal(current(r), 'card')
  assert.equal(restore(s.ladder, { rungs: ['warm'] }), null)
  assert.equal(restore(s.ladder, { rungs: ['cord', 'cord'] }), null)
  assert.equal(restore(s.ladder, { rungs: 'cord' }), null)
  assert.equal(restore(s.ladder, null), null)
  assert.equal(restore(null, snap), null)
  const odd = restore(s.ladder, { rungs: ['cord'], hints: -4, hintAt: 'x', revealed: 1 })
  assert.equal(odd.hints, 0); assert.equal(odd.revealed, true)
})
