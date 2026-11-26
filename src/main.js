// Rungs: app state, screen flow, input, saving, frame loop and the ?debug hook.
// Rules live in src/logic (pure, tested). ui.js builds the DOM, scene.js draws the canvas; neither holds game state.
import { makeStore, wireChrome, haptic } from '../kit/kit.js'
import { dailyTalk, tellUs } from '../kit/talk.js'
import { createUI, starsHtml, esc } from './ui.js'
import { createScene } from './scene.js'
import { snd } from './audio.js'
import { sanitize, defaults } from './logic/save.js'
import { dailyLadders, DAILY_KINDS, endlessLadder, HEIGHTS, ladderFromPair } from './logic/generate.js'
import { CHAPTERS, JOURNEY, PER_CHAPTER } from './logic/journey.js'
import * as S from './logic/session.js'
import { rating, stars as starCount, dateKey, addDays, prettyDate, ST, dayClean, dayCount, dayFinished, creditDay, streakNow, shareText } from './logic/score.js'

const stage = document.getElementById('stage')
const canvas = document.getElementById('game')
const uiRoot = document.getElementById('ui')
const store = makeStore('rungs', defaults())
const save = sanitize(store.data)
const persist = () => store.set(save)
const ARCHIVE_DAYS = 14

const app = { screen: 'title', today: dateKey(), day: dateKey(), chapter: 0, play: null, portrait: true }
const scene = createScene(canvas)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
scene.setReduced(reduced.matches)
reduced.addEventListener('change', () => scene.setReduced(reduced.matches))

// ---------------------------------------------------------------- helpers
const dailyCache = new Map()
function laddersFor(key) {
  if (!dailyCache.has(key)) { if (dailyCache.size > 20) dailyCache.clear(); dailyCache.set(key, dailyLadders(key)) }
  return dailyCache.get(key)
}
function dayEntry(key, create) {
  let d = save.daily.days[key]
  if (!d && create) d = save.daily.days[key] = { sum: [0, 1, 2].map(() => ({ st: 0, n: 0, h: 0, p: 0 })), snaps: [null, null, null] }
  if (d) laddersFor(key).forEach((l, i) => { d.sum[i].p = l.par })
  return d
}
const journeyUnlocked = (i) => i === 0 || !!save.journey.seen[i - 1] || (save.journey.stars[i - 1] || 0) > 0
const journeyNext = () => { for (let i = 0; i < JOURNEY.length; i++) if (!save.journey.seen[i] && !(save.journey.stars[i] > 0)) return i; return JOURNEY.length - 1 }
const totalStars = () => save.journey.stars.slice(0, JOURNEY.length).reduce((a, b) => a + (b || 0), 0)
const up = (s) => s.toUpperCase()
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------- title + menus
function go(screen) {
  app.screen = screen
  ui.show(screen)
  scene.setMode(screen === 'title' ? 'title' : screen === 'play' ? 'play' : 'menu')
  layout()
}

function openTitle() {
  app.today = dateKey(); app.play = null
  save.last = null; persist()
  const sum = save.daily.days[app.today] && save.daily.days[app.today].sum
  const n = dayCount(sum), streak = streakNow(save.daily, app.today)
  ui.text('t-daily', `${n === 3 ? 'Today: all 3 climbed' : n ? `Today: ${n} of 3 climbed` : '3 new ladders today'} · streak ${streak}`)
  let strip = ''
  for (let i = 6; i >= 0; i--) {
    const k = addDays(app.today, -i), s = save.daily.days[k] && save.daily.days[k].sum, c = dayCount(s)
    strip += `<i class="dot ${c === 3 ? (dayClean(s) ? 'full' : 'most') : c ? 'part' : ''}${i === 0 ? ' today' : ''}"></i>`
  }
  ui.html('t-strip', strip)
  ui.text('t-journey', `${totalStars()} of ${JOURNEY.length * 3} stars · ${JOURNEY.length} ladders`)
  ui.text('t-endless', save.endless.solved ? `${plural(save.endless.solved, 'ladder')} climbed` : 'Pick a length and a height')
  go('title')
}

function openDaily(key) {
  app.today = dateKey()
  app.day = key && key <= app.today && key >= addDays(app.today, -(ARCHIVE_DAYS - 1)) ? key : app.today
  paintDaily()
  go('daily')
}
function paintDaily() {
  const key = app.day, isToday = key === app.today, ladders = laddersFor(key), d = dayEntry(key, false)
  ui.text('d-streak', `Streak ${streakNow(save.daily, app.today)} · best ${save.daily.best}`)
  ui.text('d-date', isToday ? 'Today' : prettyDate(key))
  ui.text('d-note', isToday ? `${prettyDate(key)} · the same three ladders for everyone` : 'From the archive · does not count for the streak')
  ui.f['d-prev'].disabled = key <= addDays(app.today, -(ARCHIVE_DAYS - 1))
  ui.f['d-next'].disabled = isToday
  ui.html('d-list', ladders.map((l, i) => {
    const e = d ? d.sum[i] : { st: 0 }, kind = DAILY_KINDS[i]
    const status = e.st === ST.done ? `<b>${e.n}/${e.p}</b> rungs` : e.st === ST.revealed ? 'Shown' : e.st === ST.going && e.n ? `On rung ${e.n}` : 'Climb'
    return `<button class="dcard k${i} ${e.st >= ST.done ? 'done' : ''}" data-act="daily-play" data-i="${i}">
      <span class="dk"><b>${kind.name}</b><small>${l.len} letters · par ${l.par}</small></span>
      <span class="dw">${up(l.start)} <i>to</i> ${up(l.goal)}</span>
      <span class="ds st${e.st}">${status}</span></button>`
  }).join(''))
  const sum = d && d.sum, n = dayCount(sum)
  ui.f['d-copy'].disabled = !n
  ui.text('d-copy', 'Copy result')
  let total = 'Finish all three without giving up to grow your streak.'
  if (n === 3 && dayClean(sum)) { const used = sum.reduce((a, e) => a + e.n, 0), par = sum.reduce((a, e) => a + e.p, 0); total = `Day total: ${used} rungs, par ${par}.` }
  else if (n === 3) total = 'All three done, one with help from the robot.'
  else if (n) total = `${n} of 3 climbed.`
  ui.text('d-total', total)
  let days = ''
  for (let i = ARCHIVE_DAYS - 1; i >= 0; i--) {
    const k = addDays(app.today, -i), s = save.daily.days[k] && save.daily.days[k].sum, c = dayCount(s)
    days += `<button class="day ${c === 3 ? (dayClean(s) ? 'full' : 'most') : c ? 'part' : ''}${k === key ? ' on' : ''}" data-act="goday" data-date="${k}" aria-label="${prettyDate(k)}: ${c} of 3 climbed">${Number(k.slice(8))}</button>`
  }
  ui.html('d-days', days)
}

function openJourney(chapter) {
  app.chapter = Math.max(0, Math.min(CHAPTERS.length - 1, chapter ?? Math.floor(journeyNext() / PER_CHAPTER)))
  paintJourney()
  go('journey')
}
function paintJourney() {
  const c = app.chapter, ch = CHAPTERS[c]
  ui.text('j-total', `${totalStars()} / ${JOURNEY.length * 3} ★`)
  ui.text('j-chno', `Chapter ${c + 1} of ${CHAPTERS.length}`)
  ui.text('j-chname', ch.name)
  ui.text('j-blurb', ch.blurb)
  ui.f['j-prev'].disabled = c === 0
  ui.f['j-next'].disabled = c === CHAPTERS.length - 1
  const next = journeyNext()
  ui.html('j-grid', ch.ladders.map(([a, b, par], k) => {
    const i = c * PER_CHAPTER + k, st = save.journey.stars[i] || 0, open = journeyUnlocked(i)
    if (!open) return `<button class="lvl locked" disabled aria-label="Ladder ${i + 1}, locked"><b>${i + 1}</b><small>locked</small></button>`
    return `<button class="lvl ${st ? 'done' : ''} ${i === next ? 'next' : ''}" data-act="journey-play" data-i="${i}" aria-label="Ladder ${i + 1}: ${a} to ${b}, par ${par}, ${st} stars">
      <b>${i + 1}</b><small>${up(a)} → ${up(b)}</small>${starsHtml(st)}</button>`
  }).join(''))
}

function openEndless() { paintEndless(); go('endless') }
function paintEndless() {
  const e = save.endless
  ui.text('e-total', `${e.solved} climbed`)
  ui.html('e-len', [3, 4, 5].map((n) => `<button class="${e.len === n ? 'on' : ''}" data-act="e-len" data-v="${n}" aria-pressed="${e.len === n}">${n}</button>`).join(''))
  ui.html('e-height', HEIGHTS.map((h) => `<button class="${e.height === h.id ? 'on' : ''}" data-act="e-height" data-v="${h.id}" aria-pressed="${e.height === h.id}">${h.name}</button>`).join(''))
  const h = HEIGHTS.find((x) => x.id === e.height)
  ui.text('e-note', `${e.len}-letter words, par ${h.min} to ${h.max}. A fresh random ladder every time.`)
  ui.f['e-resume'].hidden = !(e.cur && e.cur.snap && !e.cur.done)
}

// ---------------------------------------------------------------- play
function begin(mode, ladder, snap, meta) {
  const session = S.restore(ladder, snap) || S.newSession(ladder)
  app.play = { mode, session, ladder, meta, typed: '', slot: -1, hintPos: -1, resultIn: 0, armed: 0, note: null, fresh: null, downTo: -1, markFresh: false }
  save.last = mode === 'daily' ? { mode, date: meta.date, idx: meta.idx } : { mode }
  persist()
  go('play')
  showLadder()
  ui.f.result.hidden = true
  paintPlay()
  if (S.isOver(session)) openResult(false)
}
function showLadder() {
  const p = app.play, s = p.session
  const words = s.revealed ? p.ladder.route : [p.ladder.start, ...s.rungs]
  scene.setLadder({ len: p.ladder.len, goal: p.ladder.goal, par: p.ladder.par, words, over: S.isOver(s), won: S.isOver(s) })
}
function startDaily(i) {
  const key = app.day, ladder = laddersFor(key)[i], d = dayEntry(key, false)
  begin('daily', ladder, d && d.snaps[i], { date: key, idx: i })
}
function startJourney(i, resume = true) {
  if (!JOURNEY[i] || !journeyUnlocked(i)) return openJourney()
  const row = JOURNEY[i], cur = save.journey.cur
  begin('journey', ladderFromPair(row.start, row.goal, true), resume && cur && cur.level === i ? cur.snap : null, { level: i })
}
function startEndless(fresh) {
  const e = save.endless
  if (fresh || !e.cur) e.cur = { seed: ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 4294967296)) >>> 0, len: e.len, height: e.height, snap: { rungs: [], hints: 0, hintAt: -1, revealed: false }, done: false, w: 2 }
  begin('endless', endlessLadder(e.cur.seed, e.cur.len, e.cur.height, e.cur.w || 1), e.cur.snap, {})
}

function defaultMsg() {
  const p = app.play, s = p.session, cur = S.current(s)
  let off = 0
  for (let i = 0; i < cur.length; i++) if (cur[i] !== p.ladder.goal[i]) off++
  if (!s.rungs.length) return `Change one letter of ${up(cur)} to make a new word.`
  return off === 1 ? 'One letter to go!' : `${off} letters still differ from ${up(p.ladder.goal)}.`
}

function paintPlay(shake = false) {
  const p = app.play
  if (!p) return
  const s = p.session, l = p.ladder, over = S.isOver(s), cur = S.current(s)
  // a rung marked for "climb down" stays marked only until the player does something else
  if (p.downTo >= 0 && !p.markFresh) { p.downTo = -1; scene.mark(-1) }
  p.markFresh = false
  if (p.mode === 'daily') { ui.text('p-mode', p.meta.date === app.today ? 'Daily' : `Daily · ${prettyDate(p.meta.date)}`); ui.text('p-name', DAILY_KINDS[p.meta.idx].name) }
  else if (p.mode === 'journey') { ui.text('p-mode', CHAPTERS[JOURNEY[p.meta.level].chapter].name); ui.text('p-name', `Ladder ${p.meta.level + 1}`) }
  else { ui.text('p-mode', 'Endless'); ui.text('p-name', `${l.len} letters`) }
  ui.text('p-par', String(l.par))
  ui.text('p-rungs', String(s.revealed ? 0 : s.rungs.length))
  ui.f['p-rchip'].classList.toggle('over', !s.revealed && s.rungs.length > l.par)
  ui.text('p-hints', String(s.hints))
  ui.f['p-hchip'].hidden = !s.hints
  ui.f['p-undo'].disabled = over || !s.rungs.length
  ui.f['p-hint'].disabled = over
  ui.f['p-giveup'].disabled = over
  ui.f['p-giveup'].classList.toggle('armed', !over && p.armed > 0)
  ui.f['p-panel'].classList.toggle('over', over)
  ui.f['p-over'].hidden = !over
  ui.f['p-kb'].hidden = over
  ui.f['p-kb'].classList.toggle('ready', !over && p.typed.length === l.len)
  const tiles = []
  for (let i = 0; i < l.len; i++) {
    const typed = i < p.typed.length
    const ch = typed ? p.typed[i] : cur[i]
    let cls = typed ? (ch !== cur[i] ? 'typed changed' : 'typed') : p.typed.length ? 'rest' : 'cur'
    if (!over && !p.typed.length && p.slot === i) cls += ' sel'
    if (!over && p.typed.length && p.typed.length === i) cls += ' caret'
    if (ch === l.goal[i]) cls += ' hit'
    if (!over && p.hintPos === i && !p.typed.length) cls += ' hintpos'
    tiles.push({ ch: up(ch), cls })
  }
  ui.tiles(tiles, shake)
  for (const b of ui.f['p-tiles'].children) b.disabled = over
  scene.setPreview(!over && p.typed.length ? { letters: Array.from({ length: l.len }, (_, i) => p.typed[i] || ''), changed: Array.from({ length: l.len }, (_, i) => !!p.typed[i] && p.typed[i] !== cur[i]) } : null)
  if (over) {
    ui.text('p-next', nextLabel())
    ui.msg(s.revealed ? "This is the robot's route." : `${rating(s.rungs.length, l.par).label} · ${rating(s.rungs.length, l.par).name}`, 'good')
  } else if (p.note) ui.msg(p.note.text, p.note.tone)
  else ui.msg(defaultMsg())
}
const note = (text, tone = '') => { app.play.note = { text, tone } }

function savePlay() {
  const p = app.play, s = p.session, snap = S.snapshot(s)
  if (p.mode === 'daily') {
    const d = dayEntry(p.meta.date, true)
    d.snaps[p.meta.idx] = snap
    d.sum[p.meta.idx] = { st: s.revealed ? ST.revealed : S.isDone(s) ? ST.done : ST.going, n: s.rungs.length, h: s.hints, p: p.ladder.par }
  } else if (p.mode === 'journey') save.journey.cur = S.isOver(s) ? null : { level: p.meta.level, snap }
  else if (save.endless.cur) { save.endless.cur.snap = snap; save.endless.cur.done = S.isOver(s) }
  persist()
}

function submit(word) {
  const p = app.play, s = p.session
  const res = S.move(s, word)
  if (!res.ok) {
    p.typed = ''
    note(S.REASONS[res.reason] + (res.reason === 'notword' ? `: ${up(word)}` : '') + '.', 'bad')
    snd.nope(); scene.shakeNo(); haptic([20, 40, 20])
    paintPlay(true)
    return res
  }
  p.typed = ''; p.slot = -1; p.hintPos = -1; p.note = null; p.armed = 0
  scene.setWords([p.ladder.start, ...s.rungs], { won: res.done })
  if (res.done) finish()
  else { snd.rung(s.rungs.length); haptic(10); savePlay() }
  paintPlay()
  return res
}

function finish() {
  const p = app.play, s = p.session, n = s.rungs.length, par = p.ladder.par
  p.fresh = { stars: 0, best: false, streak: 0 }
  if (p.mode === 'journey') {
    const i = p.meta.level, j = save.journey
    while (j.stars.length <= i) j.stars.push(0)
    while (j.best.length <= i) j.best.push(0)
    while (j.seen.length <= i) j.seen.push(false)
    const st = starCount(n, par, s.hints)
    p.fresh.stars = st
    p.fresh.best = j.best[i] > 0 && n < j.best[i]
    j.stars[i] = Math.max(j.stars[i], st)
    j.best[i] = j.best[i] > 0 ? Math.min(j.best[i], n) : n
    j.seen[i] = true
  } else if (p.mode === 'endless') save.endless.solved++
  savePlay()
  if (p.mode === 'daily' && p.meta.date === dateKey()) {
    const d = dayEntry(p.meta.date, true)
    if (dayClean(d.sum) && save.daily.last !== p.meta.date) { creditDay(save.daily, p.meta.date); p.fresh.streak = save.daily.streak; persist() }
  }
  scene.setOver(true)
  scene.celebrate()
  snd.rung(n); snd.bell(true); haptic([18, 60, 30])
  p.resultIn = reduced.matches ? 0.5 : 1.5
}

function nextLabel() {
  const p = app.play
  if (p.mode === 'journey') return p.meta.level + 1 < JOURNEY.length ? 'Next ladder' : 'Back to Journey'
  if (p.mode === 'endless') return 'New ladder'
  return nextDailyIdx() >= 0 ? 'Next ladder' : 'Back to Daily'
}
function nextDailyIdx() {
  const p = app.play, d = dayEntry(p.meta.date, false)
  for (let k = 1; k <= 2; k++) { const i = (p.meta.idx + k) % 3; if (!d || d.sum[i].st < ST.done) return i }
  return -1
}

function openResult(animated = true) {
  const p = app.play
  if (!p || !S.isOver(p.session)) return
  const s = p.session, l = p.ladder, n = s.rungs.length, r = rating(n, l.par, s.revealed)
  ui.text('r-kicker', p.mode === 'daily' ? `Daily · ${DAILY_KINDS[p.meta.idx].name} · ${prettyDate(p.meta.date)}` : p.mode === 'journey' ? `Journey · ladder ${p.meta.level + 1}` : `Endless · ${l.len} letters`)
  ui.text('r-label', r.label)
  ui.f['r-label'].className = 'tone-' + r.tone
  ui.text('r-name', r.name)
  const st = p.mode === 'journey' && !s.revealed ? starCount(n, l.par, s.hints) : 0
  ui.html('r-stars', st ? starsHtml(st, 'big') : '')
  ui.text('r-line', s.revealed ? `Par ${l.par}${n ? ` · you reached rung ${n}` : ""}` : `${plural(n, 'rung')} · par ${l.par}${s.hints ? ` · ${plural(s.hints, 'hint')}` : ''}`)
  const col = (title, words, cls) => `<div class="route ${cls}"><span class="eyebrow">${title}</span><ol>${words.slice().reverse().map((w) => `<li>${[...w].map((ch, i) => `<i class="${ch === l.goal[i] ? 'hit' : ''}">${esc(up(ch))}</i>`).join('')}</li>`).join('')}</ol></div>`
  const mine = [l.start, ...s.rungs]
  const same = !s.revealed && mine.join() === l.route.join()
  ui.html('r-routes', (s.revealed ? '' : col(same ? 'Your climb = the robot’s' : 'Your climb', mine, 'mine')) + (same ? '' : col("The robot's route", l.route, 'bot')))
  let extra = ''
  if (!s.revealed && n < l.par) extra = 'You found a shortcut the robot did not know.'
  if (p.mode === 'journey' && p.fresh && p.fresh.best) extra = 'A new best for this ladder.'
  if (p.mode === 'daily') {
    const d = dayEntry(p.meta.date, false), c = dayCount(d && d.sum)
    if (p.fresh && p.fresh.streak) extra = `All three climbed. Streak: ${p.fresh.streak}.`
    else if (c < 3) extra = `${c} of 3 climbed ${p.meta.date === app.today ? 'today' : 'for this day'}.`
    else if (d && dayFinished(d.sum) && !extra) extra = p.meta.date === app.today ? 'That is all three for today. New ladders tomorrow.' : 'That is all three for this day.'
  }
  ui.text('r-extra', extra)
  ui.text('r-next', nextLabel())
  ui.f['r-copy'].hidden = p.mode !== 'daily'
  ui.text('r-copy', 'Copy result')
  // Anonymous "you beat N%" and difficulty vote: today's daily ladders only (never archive days, the Journey or Endless).
  // A revealed ladder still gets the vote, but sends no score.
  const talk = ui.f['r-talk']
  if (p.mode === 'daily' && p.meta.date === app.today) {
    const kind = DAILY_KINDS[p.meta.idx]
    dailyTalk(talk, { game: 'rungs', key: p.meta.date, board: kind.id, score: s.revealed ? undefined : n, label: `${kind.name} ladder`, compact: true })
  } else { talk.replaceChildren(); talk.hidden = true }
  ui.f.result.hidden = false
  ui.f.result.classList.toggle('pop', animated)
  if (animated && st) for (let k = 0; k < st; k++) setTimeout(() => snd.star(k), 250 + k * 170)
  paintPlay()
}

function copyResult(el) {
  const key = app.screen === 'play' && app.play ? app.play.meta.date : app.day
  const d = dayEntry(key, false)
  const text = shareText(key, d && d.sum)
  const done = () => { snd.copy(); if (el) el.textContent = 'Copied!'; ui.toast('Copied!') }
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0'
    document.body.appendChild(ta); ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    if (ok) done(); else showShareText(text)
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback)
  else fallback()
  return text
}
/** 1.3: when the browser refuses both ways of copying, show the result over the game, selected, to copy by hand. */
function showShareText(text) {
  let pop = uiRoot.querySelector('.sharepop')
  if (!pop) {
    pop = document.createElement('div')
    pop.className = 'sharepop'
    pop.setAttribute('role', 'dialog')
    pop.setAttribute('aria-label', 'Your result, to copy')
    pop.innerHTML = '<p>Your browser would not let us copy. Select the text and copy it yourself:</p><textarea class="sharebox" readonly rows="3" aria-label="Your result"></textarea><button class="btn small" type="button">Done</button>'
    pop.querySelector('button').addEventListener('click', () => { pop.hidden = true })
    uiRoot.appendChild(pop)
  }
  pop.hidden = false
  const box = pop.querySelector('textarea')
  box.value = text
  box.focus({ preventScroll: true })
  box.select()
}

const playing = () => app.screen === 'play' && app.play && !S.isOver(app.play.session)

const actions = {
  title() { snd.back(); openTitle() },
  daily() { snd.click(); openDaily() },
  journey() { snd.click(); openJourney() },
  endless() { snd.click(); openEndless() },
  day(d) { snd.click(); openDaily(addDays(app.day, Number(d.d))) },
  goday(d) { snd.click(); openDaily(d.date) },
  'daily-play'(d) { snd.click(); startDaily(Number(d.i)) },
  chapter(d) { snd.click(); openJourney(app.chapter + Number(d.d)) },
  'journey-play'(d) { snd.click(); startJourney(Number(d.i)) },
  'e-len'(d) { snd.click(); save.endless.len = Number(d.v); persist(); paintEndless() },
  'e-height'(d) { snd.click(); save.endless.height = d.v; persist(); paintEndless() },
  'endless-new'() { snd.click(); startEndless(true) },
  'endless-resume'() { snd.click(); startEndless(false) },
  copy(_, el) { copyResult(el) },
  back() {
    snd.back()
    const p = app.play
    if (!p) return openTitle()
    if (p.mode === 'daily') openDaily(p.meta.date)
    else if (p.mode === 'journey') openJourney(Math.floor(p.meta.level / PER_CHAPTER))
    else openEndless()
    save.last = null; persist()
  },
  key(d) {
    if (!playing()) return
    const p = app.play, k = d.k, cur = S.current(p.session)
    p.note = null
    scene.lookHome() // typing brings the view back up to the rung being built
    if (p.slot >= 0) {
      if (k === cur[p.slot]) { note(`That letter is already ${up(k)}.`, 'bad'); snd.del(); return paintPlay(true) }
      submit(cur.slice(0, p.slot) + k + cur.slice(p.slot + 1))
      return
    }
    if (p.typed.length >= p.ladder.len) return
    p.typed += k; p.hintPos = -1
    snd.key()
    if (p.typed.length === p.ladder.len) note('Press Enter to climb.', 'go')
    paintPlay()
  },
  del() {
    if (!playing()) return
    const p = app.play
    p.note = null
    if (p.slot >= 0) p.slot = -1
    else if (p.typed) p.typed = p.typed.slice(0, -1)
    else return
    snd.del(); paintPlay()
  },
  enter() {
    if (!playing()) return
    const p = app.play
    if (p.slot >= 0 && !p.typed) { note('Now tap the new letter.', 'go'); return paintPlay() }
    if (!p.typed) { note('Type a word, or tap a letter to change it.', 'go'); return paintPlay() }
    submit(p.typed)
  },
  slot(d) {
    if (!playing()) return
    const p = app.play, i = Number(d.i)
    p.typed = ''
    p.slot = p.slot === i ? -1 : i
    p.note = p.slot >= 0 ? { text: 'Now tap the new letter.', tone: 'go' } : null
    scene.lookHome()
    snd.pick(); paintPlay()
  },
  /** The chip on the ladder: jump down to the start word, or back up to the climb. */
  look() {
    if (app.screen !== 'play' || !app.play) return
    snd.click()
    if (scene.looking() > 0.3) scene.lookHome(); else scene.scrollBy(1e6)
  },
  move(d) {
    if (!playing()) return
    const p = app.play, n = p.ladder.len
    p.typed = ''
    p.slot = p.slot < 0 ? (d.d > 0 ? 0 : n - 1) : (p.slot + d.d + n) % n
    note('Now type the new letter.', 'go')
    snd.pick(); paintPlay()
  },
  undo() {
    if (!playing()) return
    const p = app.play
    if (!S.undo(p.session)) return
    p.typed = ''; p.slot = -1; p.hintPos = -1; p.note = null
    scene.setWords([p.ladder.start, ...p.session.rungs])
    snd.down(p.session.rungs.length); savePlay(); paintPlay()
  },
  hint() {
    if (!playing()) return
    const p = app.play, cur = S.current(p.session), step = S.hint(p.session)
    p.typed = ''
    if (!step) { note('The robot sees no way up from here. Undo a rung.', 'bad'); snd.nope(); return paintPlay() }
    p.hintPos = [...cur].findIndex((ch, i) => ch !== step.word[i])
    p.slot = p.hintPos
    note(`The robot whispers: ${up(step.word)}.`, 'hint')
    snd.hint(); savePlay(); paintPlay()
  },
  giveup() {
    if (!playing()) return
    const p = app.play
    if (!p.armed) {
      p.armed = 1
      note("Tap the flag again to give up and see the robot's route.", 'bad')
      snd.click()
      return paintPlay()
    }
    S.reveal(p.session)
    p.typed = ''; p.slot = -1; p.hintPos = -1; p.note = null; p.armed = 0
    if (p.mode === 'journey') { const j = save.journey; while (j.seen.length <= p.meta.level) j.seen.push(false); j.seen[p.meta.level] = true }
    savePlay()
    showLadder(); scene.softBell()
    snd.reveal()
    p.resultIn = 0.7
    paintPlay()
  },
  'show-result'() { snd.click(); openResult(false) },
  'hide-result'() { snd.click(); ui.f.result.hidden = true },
  next() {
    snd.click()
    const p = app.play
    if (!p) return openTitle()
    if (p.mode === 'journey') return p.meta.level + 1 < JOURNEY.length ? startJourney(p.meta.level + 1, false) : openJourney(CHAPTERS.length - 1)
    if (p.mode === 'endless') return startEndless(true)
    const i = nextDailyIdx()
    app.day = p.meta.date
    return i >= 0 ? startDaily(i) : openDaily(p.meta.date)
  },
}
const ui = createUI(uiRoot, actions)

// ---------------------------------------------------------------- keyboard
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.metaKey) return
  const onButton = e.target instanceof HTMLElement && e.target.closest('button, a')
  if (e.ctrlKey) { if (e.key.toLowerCase() === 'z' && playing()) { e.preventDefault(); actions.undo() } return }
  if (e.key === 'Escape') {
    if (document.documentElement.classList.contains('stage-focus')) return // the kit leaves full screen
    if (app.screen === 'play') { if (!ui.f.result.hidden) ui.f.result.hidden = true; else if (app.play && (app.play.slot >= 0 || app.play.typed)) { app.play.slot = -1; app.play.typed = ''; app.play.note = null; paintPlay() } else actions.back() }
    else if (app.screen !== 'title') actions.title()
    return
  }
  if (app.screen !== 'play' || !app.play) return
  if (S.isOver(app.play.session)) { if (e.key === 'Enter' && !onButton) { e.preventDefault(); actions.next() } return }
  if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); actions.key({ k: e.key.toLowerCase() }); if (onButton) e.target.blur() }
  else if (e.key === 'Backspace') { e.preventDefault(); actions.del() }
  else if (e.key === 'Enter') { if (onButton && !e.target.closest('.key, .tile')) return; e.preventDefault(); actions.enter() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); actions.move({ d: -1 }) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); actions.move({ d: 1 }) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); actions.undo() }
  else if (e.key === '?' || e.key === '/') { e.preventDefault(); actions.hint() }
})

// ---------------------------------------------------------------- layout + loop
function layout() {
  const r = canvas.getBoundingClientRect() // the stage minus any safe-area inset in full screen (the .ui matches it)
  const w = r.width, h = r.height
  if (!w || !h) return
  app.portrait = w < h * 0.95
  stage.classList.toggle('portrait', app.portrait)
  // A phone on its side (short landscape): no rules card, a compact column, text at 13px or more.
  const short = !app.portrait && h < 520
  stage.classList.toggle('short', short)
  const fs = app.portrait ? Math.min(w / 23, h / 40) : short ? Math.min(w / 56, h / 29) : Math.min(w / 62, h / 38)
  uiRoot.style.fontSize = `${Math.max(11, Math.min(18, fs)).toFixed(2)}px`
  scene.resize()
  const slotEl = ui.slot(app.screen)
  let slot = { x: 0, y: 0, w, h }
  if (slotEl) { const s = slotEl.getBoundingClientRect(); if (s.width > 10 && s.height > 10) slot = { x: s.left - r.left, y: s.top - r.top, w: s.width, h: s.height } }
  scene.layout(slot, parseFloat(uiRoot.style.fontSize))
}
const ro = new ResizeObserver(layout)
ro.observe(stage)
for (const k in ui.slots) ro.observe(ui.slots[k])
document.addEventListener('fullscreenchange', layout)
stage.addEventListener('oddvale:fullscreen', layout)
// No long-press menu on the keyboard, tiles or ladder.
stage.addEventListener('contextmenu', (e) => { if (e.target.closest('.ui, canvas')) e.preventDefault() })
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout)

// Look back down a tall ladder (1.3): drag the ladder (finger up = see lower rungs) or use the wheel.
{
  const el = ui.f['p-slot']
  let drag = null
  el.addEventListener('pointerdown', (e) => {
    if (drag || app.screen !== 'play' || !app.play || e.button > 0 || e.target.closest('button')) return
    e.preventDefault()
    drag = { id: e.pointerId, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false }
    try { el.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    scene.hold(true); el.classList.add('dragging')
  })
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return
    drag.moved = true
    scene.scrollBy(drag.y - e.clientY)
    drag.y = e.clientY
  })
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null; scene.hold(false); el.classList.remove('dragging')
    if (e.type === 'pointerup' && !d.moved) tapLadder(e.clientX, e.clientY)
  }
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, end)
  el.addEventListener('wheel', (e) => {
    if (app.screen !== 'play' || !app.play || scene.hiddenBelow() < 0.5) return
    e.preventDefault()
    scene.scrollBy(e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1))
  }, { passive: false })
}
/** Tap an old rung to climb back down to it (1.3): the first tap marks it, a second tap on it climbs down. */
function tapLadder(x, y) {
  if (!playing()) return
  const p = app.play, r = canvas.getBoundingClientRect(), k = scene.rungAt(x - r.left, y - r.top)
  if (k < 0) { if (p.downTo >= 0) { p.note = null; paintPlay() } return }
  const word = k === 0 ? p.ladder.start : p.session.rungs[k - 1]
  if (p.downTo === k) {
    S.undoTo(p.session, k)
    p.typed = ''; p.slot = -1; p.hintPos = -1; p.note = null; p.armed = 0
    scene.setWords([p.ladder.start, ...p.session.rungs])
    snd.down(p.session.rungs.length); haptic(10); savePlay(); paintPlay()
    return
  }
  p.downTo = k; p.markFresh = true; scene.mark(k)
  note(`Tap ${up(word)} again to climb back down to it.`, 'go')
  snd.pick(); paintPlay()
}
let lookState = ''
function paintLook() {
  const below = app.screen === 'play' && app.play ? scene.hiddenBelow() : 0
  const st = below >= 0.5 ? (scene.looking() > 0.3 ? 'up' : 'down') : ''
  if (st === lookState) return
  lookState = st
  const b = ui.f['p-look']
  b.hidden = !st
  b.classList.toggle('up', st === 'up')
  b.innerHTML = st === 'up' ? '<b aria-hidden="true">↑</b> Back up' : '<b aria-hidden="true">↓</b> Start'
  b.setAttribute('aria-label', st === 'up' ? 'Back up to the rung you are on' : 'Look back down the ladder to the start word')
}

function tick(dt) {
  scene.update(dt)
  paintLook()
  const p = app.play
  if (p && p.resultIn > 0) { p.resultIn -= dt; if (p.resultIn <= 0) { p.resultIn = 0; if (app.screen === 'play') openResult(true) } }
  scene.draw()
}
let lastT = 0
function frame(now) {
  requestAnimationFrame(frame)
  if (document.hidden) { lastT = now; return }
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
  lastT = now
  tick(dt)
}
document.addEventListener('visibilitychange', () => { lastT = performance.now(); if (!document.hidden && app.screen === 'title') openTitle() })

// ---------------------------------------------------------------- boot
wireChrome({ stage })
tellUs(document.getElementById('tell-us'), { game: 'rungs', issueUrl: 'https://github.com/JohnGarrisonDev/rungs/issues/new?template=feedback.yml' })
function boot() {
  const last = save.last
  app.today = dateKey()
  try {
    if (last && last.mode === 'daily' && last.date <= app.today && last.date >= addDays(app.today, -(ARCHIVE_DAYS - 1))) { app.day = last.date; startDaily(last.idx) }
    else if (last && last.mode === 'journey' && save.journey.cur) startJourney(save.journey.cur.level)
    else if (last && last.mode === 'endless' && save.endless.cur) startEndless(false)
    else openTitle()
  } catch { openTitle() }
  requestAnimationFrame((t) => { lastT = t; frame(t) })
}
boot()

// Debug hook for automated play-testing: only with ?debug in the URL.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    app, save, actions, scene, ui, S,
    state() {
      const p = app.play
      return { screen: app.screen, portrait: app.portrait, day: app.day, play: p && { mode: p.mode, start: p.ladder.start, goal: p.ladder.goal, par: p.ladder.par, route: p.ladder.route, rungs: p.session.rungs.slice(), hints: p.session.hints, over: S.isOver(p.session), done: S.isDone(p.session), typed: p.typed, slot: p.slot, msg: ui.f['p-msg'].textContent, result: !ui.f.result.hidden } }
    },
    /** Advance the animation clock by ms (the tab is often in the background, where frames barely run). */
    step(ms = 500) { for (let t = 0; t < ms; t += 16) tick(0.016); return this.state() },
    /** Type a word through the real key path and press Enter. */
    type(word) { for (const k of word) actions.key({ k }); actions.enter(); return this.state() },
    /** Climb the robot's way from wherever the player stands, leaving `leave` rungs unclimbed. */
    solve(leave = 0) {
      const p = app.play
      let guard = 0
      while (p && !S.isOver(p.session) && guard++ < 80) {
        const step = S.nextStep(S.current(p.session), p.ladder.goal)
        if (!step || step.left < leave) break
        this.type(step.word)
      }
      return this.state()
    },
    reset() { store.reset(); Object.assign(save, defaults()); persist(); openTitle() },
  }
}
