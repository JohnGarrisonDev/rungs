// DOM overlays inside the stage: title, daily, journey, endless, the play HUD + keyboard, result card, toast.
// Pure view code: it renders what main.js tells it and reports clicks through `actions[name](dataset, element)`.
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
export const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  hint: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  del: svg('<path d="M21 5H9l-6 7 6 7h12z"/><path d="m12 9 6 6M18 9l-6 6"/>'),
  enter: svg('<path d="M20 5v8H6"/><path d="m10 9-4 4 4 4"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const starsHtml = (n, cls = '') => `<span class="stars ${cls}" aria-label="${n} of 3 stars">${[0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}">★</i>`).join('')}</span>`
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export function createUI(root, actions) {
  root.innerHTML = `
  <section class="screen title" data-screen="title">
    <div class="title-head">
      <span class="eyebrow">An Oddvale word ladder</span>
      <h2 class="wordmark">Ru<em>n</em>gs</h2>
      <p class="howto">Change one letter per rung. Climb from the bottom word to the top one.</p>
    </div>
    <div class="slot" data-slot="title"></div>
    <nav class="title-menu">
      <button class="bigbtn pink" data-act="daily"><b>Daily</b><span data-f="t-daily"></span><span class="strip" data-f="t-strip" aria-hidden="true"></span></button>
      <button class="bigbtn yellow" data-act="journey"><b>Journey</b><span data-f="t-journey"></span></button>
      <button class="bigbtn mint" data-act="endless"><b>Endless</b><span data-f="t-endless"></span></button>
    </nav>
  </section>

  <section class="screen menu daily" data-screen="daily" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Daily</h2>
      <span class="total" data-f="d-streak"></span>
    </header>
    <div class="pager">
      <button class="iconbtn" data-act="day" data-d="-1" data-f="d-prev" aria-label="Previous day">${ICON.back}</button>
      <div class="pager-name"><strong data-f="d-date"></strong><span class="blurb" data-f="d-note"></span></div>
      <button class="iconbtn" data-act="day" data-d="1" data-f="d-next" aria-label="Next day">${ICON.next}</button>
    </div>
    <div class="dlist" data-f="d-list"></div>
    <div class="row">
      <button class="btn primary small" data-act="copy" data-f="d-copy">Copy result</button>
      <span class="total" data-f="d-total"></span>
    </div>
    <div class="days" data-f="d-days" aria-label="Last 14 days"></div>
  </section>

  <section class="screen menu journey" data-screen="journey" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Journey</h2>
      <span class="total" data-f="j-total"></span>
    </header>
    <div class="pager">
      <button class="iconbtn" data-act="chapter" data-d="-1" data-f="j-prev" aria-label="Previous chapter">${ICON.back}</button>
      <div class="pager-name"><span class="eyebrow" data-f="j-chno"></span><strong data-f="j-chname"></strong><span class="blurb" data-f="j-blurb"></span></div>
      <button class="iconbtn" data-act="chapter" data-d="1" data-f="j-next" aria-label="Next chapter">${ICON.next}</button>
    </div>
    <div class="level-grid" data-f="j-grid"></div>
  </section>

  <section class="screen menu endless" data-screen="endless" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Endless</h2>
      <span class="total" data-f="e-total"></span>
    </header>
    <div class="endless-body">
      <div class="seg-row"><span class="lbl">Letters</span><div class="seg" data-f="e-len"></div></div>
      <div class="seg-row"><span class="lbl">Height</span><div class="seg" data-f="e-height"></div></div>
      <p class="note" data-f="e-note"></p>
      <div class="row">
        <button class="btn primary" data-act="endless-new">New ladder</button>
        <button class="btn" data-act="endless-resume" data-f="e-resume" hidden>Continue</button>
      </div>
    </div>
  </section>

  <section class="play" data-screen="play" hidden>
    <div class="hud">
      <button class="iconbtn" data-act="back" aria-label="Back" title="Back (Esc)">${ICON.back}</button>
      <div class="lv"><span class="eyebrow" data-f="p-mode"></span><strong data-f="p-name"></strong></div>
      <div class="chips">
        <span class="pchip">Par <b data-f="p-par"></b></span>
        <span class="pchip" data-f="p-rchip">Rungs <b data-f="p-rungs"></b></span>
        <span class="pchip hchip" data-f="p-hchip" title="Hints used">${ICON.hint}<span class="sr">Hints</span> <b data-f="p-hints"></b></span>
      </div>
      <button class="iconbtn giveup" data-act="giveup" data-f="p-giveup" aria-label="Give up and see the robot's route" title="Give up">${ICON.flag}</button>
    </div>
    <div class="slot" data-slot="play" data-f="p-slot"><button class="lookbtn" data-act="look" data-f="p-look" hidden></button></div>
    <div class="panel" data-f="p-panel">
      <p class="msg" data-f="p-msg" aria-live="polite"></p>
      <div class="entry">
        <button class="iconbtn" data-act="undo" data-f="p-undo" aria-label="Undo: climb down one rung" title="Undo (Down arrow)">${ICON.undo}</button>
        <div class="tiles" data-f="p-tiles" role="group" aria-label="Next rung"></div>
        <button class="iconbtn" data-act="hint" data-f="p-hint" aria-label="Hint: show the next word" title="Hint (?)">${ICON.hint}</button>
      </div>
      <div class="kb" data-f="p-kb" role="group" aria-label="Keyboard">
        ${KEYS.map((row, r) => `<div class="kb-row">${r === 2 ? `<button class="key wide enter" data-act="enter" aria-label="Enter">${ICON.enter}</button>` : ''}${[...row].map((k) => `<button class="key" data-act="key" data-k="${k}">${k}</button>`).join('')}${r === 2 ? `<button class="key wide" data-act="del" aria-label="Backspace">${ICON.del}</button>` : ''}</div>`).join('')}
      </div>
      <div class="over-row" data-f="p-over" hidden>
        <button class="btn small" data-act="show-result">Result</button>
        <button class="btn primary small" data-act="next" data-f="p-next">Next</button>
      </div>
    </div>
    <aside class="legend">
      <h3>The rules</h3>
      <ul>
        <li>Change <b>one letter</b> per rung.</li>
        <li>Every rung must be a real word.</li>
        <li><span class="swatch match"></span> matches the goal.</li>
        <li><span class="swatch goal"></span> the goal word.</li>
        <li>Fewer rungs is better. Par is the robot's best.</li>
      </ul>
      <p class="keys"><kbd>←</kbd><kbd>→</kbd> pick a letter · <kbd>↓</kbd> undo · <kbd>?</kbd> hint</p>
    </aside>
    <div class="modal" data-f="result" hidden>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Result">
        <span class="eyebrow" data-f="r-kicker"></span>
        <h3 data-f="r-label"></h3>
        <p class="r-name" data-f="r-name"></p>
        <div data-f="r-stars"></div>
        <p class="r-line" data-f="r-line"></p>
        <div class="routes" data-f="r-routes"></div>
        <p class="r-extra" data-f="r-extra"></p>
        <div class="row">
          <button class="btn primary" data-act="next" data-f="r-next">Next</button>
          <button class="btn" data-act="copy" data-f="r-copy" hidden>Copy result</button>
          <button class="btn" data-act="hide-result">Look at the ladder</button>
        </div>
        <div class="r-talk" data-f="r-talk" hidden></div>
      </div>
    </div>
  </section>
  <div class="toast" data-f="toast" hidden></div>`

  const f = {}
  for (const el of root.querySelectorAll('[data-f]')) f[el.dataset.f] = el
  const screens = {}
  for (const el of root.querySelectorAll('[data-screen]')) screens[el.dataset.screen] = el
  const slots = {}
  for (const el of root.querySelectorAll('[data-slot]')) slots[el.dataset.slot] = el

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || el.disabled || !root.contains(el)) return
    const fn = actions[el.dataset.act]
    if (fn) fn(el.dataset, el)
  })
  // Keys and tiles answer on pointerdown so fast thumbs never lose a tap.
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.key, .tile')
    if (!el || el.disabled) return
    e.preventDefault()
    el._pd = performance.now()
    const fn = actions[el.dataset.act]
    if (fn) fn(el.dataset, el)
  })
  root.addEventListener('click', (e) => {
    const el = e.target.closest('.key, .tile')
    if (el && el._pd && performance.now() - el._pd < 900) { el._pd = 0; e.stopImmediatePropagation() }
  }, true)

  let toastTimer = 0
  const ui = {
    f, screens, slots,
    show(name) { for (const k in screens) screens[k].hidden = k !== name },
    slot(name) { return slots[name] },
    text(key, s) { if (f[key].textContent !== s) f[key].textContent = s },
    html(key, s) { f[key].innerHTML = s },
    toast(s) {
      f.toast.textContent = s; f.toast.hidden = false
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { f.toast.hidden = true }, 1700)
    },
    /** tiles = [{ ch, cls }] for the next-rung row. */
    tiles(tiles, shake) {
      const el = f['p-tiles']
      if (el.children.length !== tiles.length) el.innerHTML = tiles.map((_, i) => `<button class="tile" data-act="slot" data-i="${i}"></button>`).join('')
      tiles.forEach((t, i) => {
        const b = el.children[i]
        b.className = 'tile ' + t.cls
        b.textContent = t.ch
        b.setAttribute('aria-label', `Letter ${i + 1}: ${t.ch || 'empty'}${t.cls.includes('sel') ? ', selected' : ''}`)
      })
      el.style.setProperty('--n', tiles.length)
      if (shake) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake') }
    },
    msg(s, tone = '') { f['p-msg'].textContent = s; f['p-msg'].className = 'msg ' + tone },
  }
  return ui
}
