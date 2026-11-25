import test from 'node:test'
import assert from 'node:assert/strict'
import { GUESS } from '../src/data/guess.js'
import { PUZZLE } from '../src/data/puzzle.js'
import { guessList, puzzleList, isGuess, isPuzzle, isHintable, isEndpoint, endpointList, LENGTHS } from '../src/logic/words.js'
import { BLOCKLIST, isBlocked } from '../src/logic/blocklist.js'

test('packed word data is well formed and sorted', () => {
  for (const n of LENGTHS) {
    for (const [name, src, list] of [['guess', GUESS, guessList], ['puzzle', PUZZLE, puzzleList]]) {
      assert.match(src[n], /^[a-z]+$/, `${name} ${n}`)
      assert.equal(src[n].length % n, 0)
      assert.equal(list[n].length, src[n].length / n)
      for (let i = 1; i < list[n].length; i++) assert.ok(list[n][i - 1] < list[n][i], `${name} ${n} sorted and unique at ${list[n][i]}`)
    }
  }
})

test('list sizes', () => {
  assert.equal(guessList[3].length, 972)
  assert.equal(guessList[4].length, 3903)
  assert.equal(guessList[5].length, 8636)
  assert.ok(puzzleList[3].length >= 300)
  assert.ok(puzzleList[4].length >= 900)
  assert.ok(puzzleList[5].length >= 1200)
})

test('every puzzle word is in ENABLE and none is on the blocklist', () => {
  for (const n of LENGTHS) for (const w of puzzleList[n]) {
    assert.ok(isGuess(w), w + ' in guess list')
    assert.ok(isPuzzle(w))
    assert.ok(!isBlocked(w), w + ' is blocked')
  }
})

test('blocked words are still accepted as guesses but never hintable', () => {
  let inGuess = 0
  for (const w of BLOCKLIST) {
    assert.match(w, /^[a-z]{3,5}$/)
    assert.ok(!isPuzzle(w))
    assert.ok(!isHintable(w))
    if (isGuess(w)) inGuess++
  }
  assert.ok(inGuess > 50)
  assert.ok(isHintable('cold'))
  assert.ok(!isHintable('zzzz'))
})

test('endpoints skip plain -s and -d forms of four-letter puzzle words', () => {
  assert.ok(isEndpoint('stone'))
  assert.ok(isEndpoint('class'))
  assert.ok(!isEndpoint('cards'))
  assert.ok(!isEndpoint('baked'))
  assert.ok(!isEndpoint('zzzzz'))
  for (const n of LENGTHS) assert.ok(endpointList[n].length > 250)
})
