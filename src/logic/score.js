// Ratings, stars, daily dates, streaks and the share text. Pure.
import { DAILY_KINDS } from './generate.js'

/** How a finished climb is described. rungs = words added, par = the robot's count. */
export function rating(rungs, par, revealed = false) {
  if (revealed) return { label: "The robot's route", name: 'Next time, little climber', tone: 'plain' }
  const d = rungs - par
  if (d < 0) return { label: 'Under par!', name: d <= -2 ? 'Rocket boots' : 'Sneaky shortcut', tone: 'gold' }
  if (d === 0) return { label: 'Par', name: 'Clean climb', tone: 'good' }
  const label = `+${d} rung${d === 1 ? '' : 's'}`
  if (d === 1) return { label, name: 'One wobble', tone: 'ok' }
  if (d === 2) return { label, name: 'Scenic route', tone: 'ok' }
  if (d <= 4) return { label, name: 'The long way up', tone: 'plain' }
  return { label, name: 'Grand tour of the dictionary', tone: 'plain' }
}

/** Journey stars: 3 = at or under par with no hints, 2 = within par + 2 and at most one hint, 1 = finished. */
export function stars(rungs, par, hints) {
  if (rungs <= par && hints === 0) return 3
  if (rungs <= par + 2 && hints <= 1) return 2
  return 1
}

// ---- dates (local calendar days as 'YYYY-MM-DD')
const pad = (n) => String(n).padStart(2, '0')
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function isDateKey(k) {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false
  const [y, m, d] = k.split('-').map(Number)
  const t = new Date(y, m - 1, d)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + n))
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const prettyDate = (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]}` }

// ---- daily results
// A day's summary is an array of three entries { st, n, h, p }:
//   st 0 = not started, 1 = climbing, 2 = finished, 3 = revealed; n = rungs used; h = hints; p = par.
export const ST = { none: 0, going: 1, done: 2, revealed: 3 }
export const dayFinished = (sum) => Array.isArray(sum) && sum.length === 3 && sum.every((e) => e && e.st >= ST.done)
/** A day counts for the streak when all three ladders were climbed without Reveal. */
export const dayClean = (sum) => Array.isArray(sum) && sum.length === 3 && sum.every((e) => e && e.st === ST.done)
export const dayCount = (sum) => (Array.isArray(sum) ? sum.filter((e) => e && e.st >= ST.done).length : 0)
/** Total rungs over par for the finished ladders of a day. */
export const dayOver = (sum) => (Array.isArray(sum) ? sum.reduce((t, e) => t + (e && e.st === ST.done ? e.n - e.p : 0), 0) : 0)

/** Streak bookkeeping: { streak, best, last } where `last` is the date of the newest counted day. */
export function creditDay(daily, key) {
  if (daily.last === key) return daily
  daily.streak = daily.last === addDays(key, -1) ? daily.streak + 1 : 1
  daily.last = key
  if (daily.streak > daily.best) daily.best = daily.streak
  return daily
}
export const streakNow = (daily, today) => (daily.last === today || daily.last === addDays(today, -1) ? daily.streak : 0)

/** Spoiler-free result line for a day. Never contains a word from the ladders. */
export function shareText(key, sum) {
  let hints = 0
  const parts = DAILY_KINDS.map((k, i) => {
    const e = (sum && sum[i]) || { st: 0, n: 0, h: 0, p: 0 }
    hints += e.h || 0
    const n = e.st === ST.done ? String(e.n) : e.st === ST.revealed ? '👀' : '–'
    return `${k.name} ${n}/${e.p || '?'}`
  })
  return `Rungs ${key} · ${parts.join(' · ')}${hints ? ` 💡${hints}` : ''}\nhttps://games.oddvale.com/rungs/`
}
