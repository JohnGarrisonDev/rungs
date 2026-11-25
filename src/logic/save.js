// Save schema for localStorage key "oddvale:rungs". Pure: sanitize() turns anything into a well-formed save.
//
// {
//   v: 1,
//   journey: { stars: [0..3 per level], best: [fewest rungs or 0 per level], seen: [bool per level, true once
//              finished or revealed], cur: { level, snap } | null },
//   daily:   { days: { 'YYYY-MM-DD': { sum: [{ st, n, h, p } x3], snaps: [snap | null x3] } },
//              streak, best, last },                 (see score.js for `sum`, creditDay for the streak fields)
//   endless: { len, height, solved, cur: { seed, len, height, snap, done } | null },
//   last:    { mode: 'journey' | 'daily' | 'endless', date?, idx? } | null   (what was on screen, for resume)
// }
// `snap` is a session snapshot (session.js): { rungs: [words], hints, hintAt, revealed }. It is replayed through
// the rules when loaded, so a junk snapshot is dropped rather than trusted.
import { isDateKey } from './score.js'

export const SAVE_VERSION = 1
const DAYS_CAP = 120, LEVEL_CAP = 600

export const defaults = () => ({
  v: SAVE_VERSION,
  journey: { stars: [], best: [], seen: [], cur: null },
  daily: { days: {}, streak: 0, best: 0, last: '' },
  endless: { len: 4, height: 'mid', solved: 0, cur: null },
  last: null,
})

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
const HEIGHT_IDS = ['low', 'mid', 'high']

export function cleanSnap(raw) {
  const r = obj(raw)
  if (!Array.isArray(r.rungs) || r.rungs.length > 80) return null
  if (!r.rungs.every((w) => typeof w === 'string' && /^[a-z]{3,5}$/.test(w))) return null
  return { rungs: r.rungs.slice(), hints: int(r.hints, 0, 999, 0), hintAt: int(r.hintAt, -1, 999, -1), revealed: !!r.revealed }
}
const cleanSum = (raw) => {
  const out = []
  for (let i = 0; i < 3; i++) {
    const e = obj(Array.isArray(raw) ? raw[i] : null)
    out.push({ st: int(e.st, 0, 3, 0), n: int(e.n, 0, 999, 0), h: int(e.h, 0, 999, 0), p: int(e.p, 0, 99, 0) })
  }
  return out
}

/** Return a clean save built from whatever was in storage. Never throws. */
export function sanitize(raw) {
  const out = defaults()
  try {
    const r = obj(raw)
    const j = obj(r.journey)
    if (Array.isArray(j.stars)) out.journey.stars = j.stars.slice(0, LEVEL_CAP).map((s) => int(s, 0, 3, 0))
    if (Array.isArray(j.best)) out.journey.best = j.best.slice(0, LEVEL_CAP).map((s) => int(s, 0, 999, 0))
    if (Array.isArray(j.seen)) out.journey.seen = j.seen.slice(0, LEVEL_CAP).map((s) => !!s)
    const jc = obj(j.cur), js = cleanSnap(jc.snap)
    if (Number.isInteger(jc.level) && jc.level >= 0 && jc.level < LEVEL_CAP && js) out.journey.cur = { level: jc.level, snap: js }

    const d = obj(r.daily), days = obj(d.days)
    for (const k of Object.keys(days).filter(isDateKey).sort().slice(-DAYS_CAP)) {
      const e = obj(days[k])
      const snaps = [0, 1, 2].map((i) => cleanSnap(Array.isArray(e.snaps) ? e.snaps[i] : null))
      out.daily.days[k] = { sum: cleanSum(e.sum), snaps }
    }
    out.daily.streak = int(d.streak, 0, 1e6, 0)
    out.daily.best = Math.max(int(d.best, 0, 1e6, 0), out.daily.streak)
    out.daily.last = isDateKey(d.last) ? d.last : ''
    if (!out.daily.last) out.daily.streak = 0

    const e = obj(r.endless)
    out.endless.len = [3, 4, 5].includes(e.len) ? e.len : 4
    out.endless.height = HEIGHT_IDS.includes(e.height) ? e.height : 'mid'
    out.endless.solved = int(e.solved, 0, 1e9, 0)
    const ec = obj(e.cur), es = cleanSnap(ec.snap)
    if (Number.isFinite(ec.seed) && [3, 4, 5].includes(ec.len) && HEIGHT_IDS.includes(ec.height) && es) {
      out.endless.cur = { seed: ec.seed >>> 0, len: ec.len, height: ec.height, snap: es, done: !!ec.done }
    }

    const l = obj(r.last)
    if (l.mode === 'journey' || l.mode === 'endless') out.last = { mode: l.mode }
    else if (l.mode === 'daily' && isDateKey(l.date)) out.last = { mode: 'daily', date: l.date, idx: int(l.idx, 0, 2, 0) }
  } catch { return defaults() }
  return out
}
