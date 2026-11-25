// Sound effects, all synthesised through the kit's sfx (shared Oddvale mute state).
import { sfx } from '../kit/kit.js'

// Major pentatonic steps: each rung climbs one.
const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36]
const note = (semi, base = 294) => base * 2 ** (semi / 12)
let lastKey = 0

export const snd = {
  /** A rising note per rung: k = how high the robot now stands. */
  rung(k) {
    const s = STEPS[Math.max(0, Math.min(STEPS.length - 1, k))]
    sfx.tone({ freq: note(s), dur: 0.22, type: 'triangle', vol: 0.17 })
    sfx.tone({ freq: note(s + 12), dur: 0.1, type: 'sine', vol: 0.06 })
    sfx.noise({ dur: 0.04, vol: 0.06, freq: 900 })
  },
  down(k) {
    const s = STEPS[Math.max(0, Math.min(STEPS.length - 1, k))]
    sfx.tone({ freq: note(s + 2), slide: note(s), dur: 0.14, type: 'triangle', vol: 0.12 })
  },
  /** Wooden knock for an entry that is not allowed. */
  nope() {
    sfx.noise({ dur: 0.06, vol: 0.16, freq: 700, slide: 220 })
    sfx.tone({ freq: 190, slide: 120, dur: 0.07, type: 'sine', vol: 0.16 })
    sfx.noise({ dur: 0.05, vol: 0.1, freq: 520, slide: 200, delay: 0.11 })
    sfx.tone({ freq: 160, slide: 105, dur: 0.06, type: 'sine', vol: 0.12, delay: 0.11 })
  },
  key() {
    const now = Date.now()
    if (now - lastKey < 35) return
    lastKey = now
    sfx.noise({ dur: 0.02, vol: 0.05, freq: 2600, slide: 1200 })
    sfx.tone({ freq: 420, dur: 0.03, type: 'triangle', vol: 0.04 })
  },
  pick() { sfx.tone({ freq: 560, slide: 700, dur: 0.05, type: 'triangle', vol: 0.08 }) },
  del() { sfx.tone({ freq: 380, slide: 300, dur: 0.04, type: 'triangle', vol: 0.06 }) },
  hint() { sfx.tune([[660, 0.07], [880, 0.07], [660, 0.09]], { type: 'sine', vol: 0.12 }) },
  click() { sfx.tone({ freq: 520, slide: 640, dur: 0.045, type: 'triangle', vol: 0.09 }) },
  back() { sfx.tone({ freq: 480, slide: 360, dur: 0.05, type: 'triangle', vol: 0.08 }) },
  /** The bell at the top of the ladder. */
  bell(big = true) {
    for (const [f, v, d] of [[1047, 0.2, 1.1], [2093, 0.09, 0.8], [2637, 0.06, 0.6], [3136, 0.035, 0.45]]) sfx.tone({ freq: f, dur: d, type: 'sine', vol: v })
    sfx.noise({ dur: 0.03, vol: 0.1, freq: 5000 })
    if (big) {
      for (const [f, v, d] of [[1319, 0.16, 0.9], [2637, 0.06, 0.6]]) sfx.tone({ freq: f, dur: d, type: 'sine', vol: v, delay: 0.26 })
      for (const [f, v, d] of [[1568, 0.17, 1.3], [3136, 0.06, 0.8]]) sfx.tone({ freq: f, dur: d, type: 'sine', vol: v, delay: 0.52 })
    }
  },
  reveal() { sfx.tune([[523, 0.09], [440, 0.09], [392, 0.16]], { type: 'triangle', vol: 0.12 }) },
  star(n) { sfx.tone({ freq: note([7, 12, 16][n] ?? 16, 440), dur: 0.22, type: 'triangle', vol: 0.15 }) },
  copy() { sfx.tune([[700, 0.05], [1050, 0.08]], { type: 'sine', vol: 0.11 }) },
}
