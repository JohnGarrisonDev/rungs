// Canvas scene: sky, wonky ladder, letter tiles, the climbing robot, the bell and confetti.
// It only draws what main.js tells it (words on the ladder, typed preview) and owns the animation state.
// Logic is instant; the picture catches up. Nothing here reads the DOM except the canvas itself.
import { C, FONT, fitCanvas, drawOddFace } from '../kit/kit.js'

const WOOD = '#f2b84b', WOOD_DARK = '#d9962a', TILE = '#fffdf8', GREEN = '#7be3bf', LEAF = '#2fd6a3', LEAF2 = '#22b98b'
const SKY = [[0, [217, 240, 236]], [3.5, [197, 230, 247]], [6.5, [216, 200, 244]], [9, [150, 132, 214]], [12, [58, 46, 92]], [15, [34, 27, 46]]]
const CONFETTI = [C.orange, C.yellow, C.mint, C.blue, C.pink, TILE]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
// Small fixed pseudo-random per index, for tilts and scenery (not gameplay).
const jit = (i, k = 0) => { const x = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1 }

export function createScene(canvas) {
  const g = canvas.getContext('2d')
  const V = {
    w: 300, h: 300, dpr: 1, slot: { x: 0, y: 0, w: 300, h: 300 }, em: 16, t: 0, reduced: false,
    mode: 'menu',            // 'title' (demo ladder), 'menu' (sky only), 'play'
    len: 4, words: [], goal: '', par: 3, over: false, won: false,
    G: 3, gAnim: 3,          // goal rung index (and its animated value while the ladder grows)
    cam: 0,                  // rung index sitting at the bottom of the view
    look: 0, held: false,    // rungs the player has scrolled down to look back (0 = follow the climb); held = dragging
    mark: -1,                // a climbed rung waiting for a second tap to climb down to it
    robot: 0, hopFrom: 0, hopTo: 0, hopT: 1,
    preview: null,           // { letters: ['c','o',...] ('' = empty), changed: [bool] }
    bell: -1, wiggle: -1, no: -1, cheer: -1, flash: -1,
    parts: [], demoT: 0,
  }
  for (let i = 0; i < 90; i++) V.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, s: 4, c: 0, life: 0 })

  // ---- geometry
  function geom() {
    const { slot, em } = V
    const L = V.len
    const T = Math.max(18, Math.min((slot.w * 0.96) / (L * 1.12 + 3.1), slot.h / 9, em * 3.3))
    const gap = T * 0.12, rowW = L * T + (L - 1) * gap, robotW = T * 1.5
    const cx = slot.x + slot.w / 2 - robotW * 0.3
    const railL = cx - rowW / 2 - T * 0.34, railR = cx + rowW / 2 + T * 0.34
    const S = T * 1.32
    const baseY = slot.y + slot.h - T * 0.42
    const topY = slot.y + T * 2.05
    const rows = Math.max(2, Math.floor((baseY - topY) / S) + 1)
    return { T, gap, rowW, robotW, cx, railL, railR, S, baseY, topY, rows, robotX: railR + robotW * 0.6 }
  }
  const camTarget = (G0, n, rows) => (G0 <= rows - 1 ? 0 : clamp(n - 1, 0, G0 - (rows - 1)))

  // ---- API
  const api = {
    V,
    resize() { const r = fitCanvas(canvas); V.w = r.w; V.h = r.h; V.dpr = r.dpr },
    layout(slot, em) { V.slot = slot; V.em = em },
    setReduced(r) { V.reduced = !!r },
    setMode(mode) { V.mode = mode; if (mode !== 'play') { V.preview = null; for (const p of V.parts) p.on = false } },
    /** Show a ladder. words = [start, ...rungs]. Snaps everything into place (no animation). */
    setLadder({ len, goal, par, words, over, won }) {
      V.mode = 'play'; V.len = len; V.goal = goal; V.par = par; V.words = words.slice(); V.over = !!over; V.won = !!won
      const n = words.length - 1
      V.G = won ? n : Math.max(par, n + 1); V.gAnim = V.G
      V.robot = V.hopFrom = V.hopTo = n; V.hopT = 1
      V.cam = camTarget(V.G, n, geom().rows); V.look = 0; V.held = false; V.mark = -1
      V.preview = null; V.bell = V.wiggle = V.no = V.cheer = V.flash = -1
      for (const p of V.parts) p.on = false
    },
    /** The word list changed by one rung (up or down). */
    setWords(words, { won = false } = {}) {
      const from = V.words.length - 1, n = words.length - 1
      V.words = words.slice(); V.won = won
      V.G = won ? n : Math.max(V.par, n + 1)
      V.hopFrom = V.robot; V.hopTo = n; V.hopT = V.reduced ? 1 : 0
      if (V.reduced) { V.robot = n; V.gAnim = V.G }
      if (n > from) V.flash = 0
      V.look = 0; V.mark = -1
    },
    /** Look back down the ladder (1.3): positive = further down. `px` is a drag or wheel distance in CSS pixels.
     *  Returns how many rungs below the climb the view now sits. */
    scrollBy(px) {
      if (V.mode !== 'play') return 0
      const G = geom(), max = camTarget(V.G, V.words.length - 1, G.rows)
      V.look = clamp(V.look + px / G.S, 0, max)
      return V.look
    },
    hold(on) { V.held = !!on },
    /** The climbed rung (0 = start word) under canvas point x, y, not counting the rung the robot is on; or -1. */
    rungAt(x, y) {
      if (V.mode !== 'play' || V.won || V.over) return -1
      const G = geom(), n = V.words.length - 1
      const k = Math.round(V.cam + (G.baseY - (y + G.T * 0.6)) / G.S)
      if (k < 0 || k >= n || x < G.railL - G.T * 0.3 || x > G.railR + G.T * 0.3) return -1
      const goalNat = G.baseY - (V.gAnim - V.cam) * G.S
      if (goalNat < G.topY - 0.5 && G.baseY - (k - V.cam) * G.S < G.topY + G.S * 0.72) return -1 // hidden under the pinned goal
      return k
    },
    /** Mark a rung (a pulsing outline) while it waits for a second tap; -1 clears. */
    mark(k) { V.mark = k },
    lookHome() { V.look = 0 },
    /** Rungs scrolled back (0 when following the climb). */
    looking: () => V.look,
    /** Rungs hidden below the view while following the climb (0 = the start word is on screen). */
    hiddenBelow: () => (V.mode === 'play' ? camTarget(V.G, V.words.length - 1, geom().rows) : 0),
    setOver(over) { V.over = over },
    setPreview(p) { V.preview = p },
    shakeNo() { V.no = 0 },
    celebrate() {
      V.bell = 0; V.cheer = 0
      if (V.reduced) return
      V.wiggle = 0
      const G = geom(), y = Math.max(G.topY, G.baseY - (V.G - V.cam) * G.S)
      let k = 0
      for (const p of V.parts) {
        p.on = true; p.life = 1.6 + (k % 7) * 0.12
        p.x = G.cx + jit(k, 1) * G.rowW * 0.6; p.y = y - G.T * 1.2
        const a = -Math.PI / 2 + jit(k, 2) * 1.25, sp = (220 + (jit(k, 3) + 1) * 190) * (G.T / 42)
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp
        p.r = jit(k, 4) * 3; p.vr = jit(k, 5) * 9; p.s = G.T * (0.1 + (jit(k, 6) + 1) * 0.05); p.c = k % CONFETTI.length
        k++
      }
    },
    softBell() { V.bell = 0 },
    /** True while something is still moving (the result card waits for this). */
    busy: () => V.hopT < 1 || (V.bell >= 0 && V.bell < 1.1),
    update, draw,
  }

  function update(dt) {
    V.t += dt
    const G = geom()
    if (V.mode === 'title') {
      // Demo: the robot climbs a blank ladder, rings the bell, slides back down, forever.
      V.demoT += dt
      return
    }
    if (V.hopT < 1) {
      V.hopT = Math.min(1, V.hopT + dt / 0.36)
      V.robot = lerp(V.hopFrom, V.hopTo, easeInOut(V.hopT))
    } else V.robot = V.hopTo
    const k = 1 - Math.exp(-dt * 9)
    V.gAnim += (V.G - V.gAnim) * k
    if (Math.abs(V.G - V.gAnim) < 0.002) V.gAnim = V.G
    const follow = camTarget(V.G, V.words.length - 1, G.rows)
    if (V.look > follow) V.look = follow
    const ct = follow - V.look
    V.cam += (ct - V.cam) * (1 - Math.exp(-dt * 6))
    if (Math.abs(ct - V.cam) < 0.002 || V.reduced || V.held) V.cam = ct
    for (const key of ['bell', 'wiggle', 'no', 'cheer', 'flash']) if (V[key] >= 0) V[key] += dt
    if (V.wiggle > 1.4) V.wiggle = -1
    if (V.no > 0.4) V.no = -1
    if (V.flash > 0.5) V.flash = -1
    for (const p of V.parts) {
      if (!p.on) continue
      p.life -= dt
      if (p.life <= 0 || p.y > V.h + 30) { p.on = false; continue }
      p.vy += 620 * dt; p.vx *= 1 - 0.9 * dt
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt
    }
  }

  // ---- drawing helpers
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }
  function skyColor(alt) {
    let i = 0
    while (i < SKY.length - 2 && alt > SKY[i + 1][0]) i++
    const [a0, c0] = SKY[i], [a1, c1] = SKY[i + 1], t = clamp((alt - a0) / (a1 - a0), 0, 1)
    return `rgb(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))})`
  }
  function tile(x, y, T, ch, style, rot = 0) {
    g.save(); g.translate(x, y); g.rotate(rot)
    const r = T * 0.22, h = T / 2, sh = Math.max(2, T * 0.075)
    if (style === 'ghost' || style === 'blankghost') {
      g.fillStyle = 'rgba(255,253,248,0.5)'; rr(-h, -h, T, T, r); g.fill()
      g.setLineDash([T * 0.14, T * 0.11]); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke(); g.setLineDash([])
    } else {
      g.fillStyle = C.ink; rr(-h + sh, -h + sh, T, T, r); g.fill()
      g.fillStyle = style === 'match' ? GREEN : style === 'goal' ? C.yellow : style === 'changed' ? C.pink : TILE
      rr(-h, -h, T, T, r); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke()
    }
    if (ch) {
      g.fillStyle = C.ink; g.globalAlpha = style === 'ghost' ? 0.8 : 1
      g.font = `800 ${Math.round(T * 0.6)}px ${FONT.display}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
      g.fillText(ch.toUpperCase(), 0, T * 0.2)
      g.globalAlpha = 1
    }
    if (style === 'match') { g.strokeStyle = C.ink; g.lineWidth = Math.max(2, T * 0.07); g.lineCap = 'round'; g.beginPath(); g.moveTo(-T * 0.2, T * 0.34); g.lineTo(T * 0.2, T * 0.34); g.stroke() }
    g.restore()
  }
  function plank(G, y, tilt, dashed) {
    const x0 = G.railL - G.T * 0.22, x1 = G.railR + G.robotW * 1.12, th = G.T * 0.17
    g.save(); g.translate(G.cx, y); g.rotate(tilt); g.translate(-G.cx, 0)
    if (dashed) {
      g.setLineDash([G.T * 0.2, G.T * 0.16]); g.strokeStyle = 'rgba(23,19,31,0.55)'; g.lineWidth = 2
      rr(x0, -th / 2, x1 - x0, th, th / 2); g.stroke(); g.setLineDash([])
    } else {
      g.fillStyle = C.ink; rr(x0 + 2, -th / 2 + 3, x1 - x0, th, th / 2); g.fill()
      g.fillStyle = WOOD; rr(x0, -th / 2, x1 - x0, th, th / 2); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 2; g.stroke()
    }
    g.restore()
  }
  function word(G, y, tilt, text, styleOf) {
    g.save(); g.translate(G.cx, y); g.rotate(tilt)
    const x0 = -G.rowW / 2 + G.T / 2
    for (let i = 0; i < V.len; i++) tile(x0 + i * (G.T + G.gap), -G.T * 0.5 - G.T * 0.1, G.T, text ? text[i] : '', styleOf(i), jit(i, y | 0) * 0.02)
    g.restore()
  }
  function rails(G, yTop, yBot, sway) {
    for (const [x, ph] of [[G.railL, 0], [G.railR, 1.7]]) {
      const path = () => {
        g.beginPath()
        for (let y = yBot; y >= yTop - 1; y -= 14) {
          const wob = Math.sin(y * 0.021 + ph) * G.T * 0.05 + sway(y)
          if (y === yBot) g.moveTo(x + wob, y); else g.lineTo(x + wob, y)
        }
      }
      g.lineCap = 'round'; g.lineJoin = 'round'
      path(); g.strokeStyle = C.ink; g.lineWidth = G.T * 0.2 + 4; g.stroke()
      path(); g.strokeStyle = WOOD_DARK; g.lineWidth = G.T * 0.2; g.stroke()
    }
  }
  function robot(x, footY, T, { lookY = -0.75, look = -0.5, squash = 0, cheer = 0, shake = 0, blink = false } = {}) {
    const u = T / 31
    g.save(); g.translate(x + shake, footY); g.scale(1 + squash * 0.12, 1 - squash * 0.14)
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = C.ink
    // feet and legs
    g.lineWidth = 3.2 * u
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 7 * u, -9 * u); g.lineTo(s * 8 * u, -2.5 * u); g.stroke() }
    g.fillStyle = C.ink
    for (const s of [-1, 1]) { rr(s * 8 * u - 5.5 * u, -5 * u, 11 * u, 5 * u, 2.4 * u); g.fill() }
    // arms: one holds the rail, one waves when cheering
    g.lineWidth = 3.4 * u
    g.beginPath(); g.moveTo(-12 * u, -19 * u); g.lineTo(-23 * u, -25 * u - cheer * 14 * u); g.stroke()
    g.beginPath(); g.moveTo(12 * u, -19 * u); g.lineTo(21 * u, -14 * u - cheer * 26 * u); g.stroke()
    g.fillStyle = C.yellow
    for (const [hx, hy] of [[-23 * u, -25 * u - cheer * 14 * u], [21 * u, -14 * u - cheer * 26 * u]]) { g.beginPath(); g.arc(hx, hy, 3.6 * u, 0, 7); g.fill(); g.lineWidth = 2; g.stroke() }
    // body
    g.fillStyle = C.ink; rr(-13 * u + 2, -28 * u + 3, 26 * u, 20 * u, 6 * u); g.fill()
    g.fillStyle = C.pink; rr(-13 * u, -28 * u, 26 * u, 20 * u, 6 * u); g.fill(); g.lineWidth = 2; g.stroke()
    g.fillStyle = C.yellow; rr(-6 * u, -22 * u, 12 * u, 7 * u, 2 * u); g.fill(); g.lineWidth = 1.6; g.stroke()
    // antenna
    g.lineWidth = 2.6 * u; g.beginPath(); g.moveTo(5 * u, -50 * u); g.lineTo(8 * u, -58 * u); g.stroke()
    g.fillStyle = C.orange; g.beginPath(); g.arc(8.5 * u, -60 * u, 3.4 * u, 0, 7); g.fill(); g.lineWidth = 2; g.stroke()
    // head
    g.fillStyle = C.ink; rr(-17 * u + 2, -52 * u + 3, 34 * u, 26 * u, 8 * u); g.fill()
    g.fillStyle = TILE; rr(-17 * u, -52 * u, 34 * u, 26 * u, 8 * u); g.fill(); g.lineWidth = 2; g.stroke()
    drawOddFace(g, 0, -39 * u, 21 * u, { look, lookY, blink })
    g.restore()
  }
  function bell(x, y, T, swing) {
    g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = C.ink
    g.rotate(swing)
    const u = T / 40
    g.lineWidth = 2.4 * u; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 6 * u); g.stroke()
    g.beginPath(); g.moveTo(-11 * u, 26 * u); g.quadraticCurveTo(-9 * u, 6 * u, 0, 6 * u); g.quadraticCurveTo(9 * u, 6 * u, 11 * u, 26 * u); g.lineTo(14 * u, 30 * u); g.lineTo(-14 * u, 30 * u); g.closePath()
    g.fillStyle = C.yellow; g.fill(); g.lineWidth = 2; g.stroke()
    g.fillStyle = C.orange; g.beginPath(); g.arc(-swing * 14 * u, 33 * u, 3.4 * u, 0, 7); g.fill(); g.stroke()
    g.restore()
  }
  function cloud(x, y, s) {
    g.fillStyle = TILE; g.strokeStyle = C.ink; g.lineWidth = 2
    g.beginPath(); g.arc(x - s * 0.5, y, s * 0.34, Math.PI * 0.5, Math.PI * 1.5); g.arc(x - s * 0.12, y - s * 0.3, s * 0.36, Math.PI, Math.PI * 1.9)
    g.arc(x + s * 0.34, y - s * 0.1, s * 0.3, Math.PI * 1.35, Math.PI * 0.5); g.closePath(); g.fill(); g.stroke()
  }
  function tree(x, groundY, hgt, s, col) {
    g.strokeStyle = C.ink; g.lineWidth = 2
    g.fillStyle = WOOD_DARK; rr(x - s * 0.09, groundY - hgt, s * 0.18, hgt + 4, 3); g.fill(); g.stroke()
    g.fillStyle = col
    g.beginPath(); g.arc(x, groundY - hgt, s * 0.52, 0, 7); g.fill(); g.stroke()
    g.beginPath(); g.arc(x - s * 0.36, groundY - hgt + s * 0.28, s * 0.34, 0, 7); g.fill(); g.stroke()
    g.beginPath(); g.arc(x + s * 0.38, groundY - hgt + s * 0.24, s * 0.36, 0, 7); g.fill(); g.stroke()
    g.beginPath(); g.arc(x, groundY - hgt + s * 0.12, s * 0.4, 0, 7); g.fill()
  }

  function backdrop(G, cam, fixedAlt = -1, cloudMinY = -1e9, treeScale = 1) {
    const alt = fixedAlt >= 0 ? fixedAlt : cam + G.rows * 0.5
    g.fillStyle = skyColor(alt); g.fillRect(0, 0, V.w, V.h)
    const yOf = (k) => G.baseY - (k - cam) * G.S
    // stars and moon
    const night = clamp((alt - 6.2) / 3.5, 0, 1)
    if (night > 0) {
      g.fillStyle = TILE
      for (let i = 0; i < 46; i++) {
        const x = (jit(i, 7) * 0.5 + 0.5) * V.w, y = ((jit(i, 8) * 0.5 + 0.5) * V.h * 1.6 + cam * G.S * 0.25) % (V.h * 1.1)
        g.globalAlpha = night * (0.5 + 0.5 * Math.sin(V.t * 1.6 + i * 2.1) * (V.reduced ? 0 : 1))
        g.beginPath(); g.arc(x, y, 1.2 + (i % 3) * 0.7, 0, 7); g.fill()
      }
      g.globalAlpha = 1
      const my = yOf(13) * 0.55 + V.h * 0.1
      if (my > -60 && my < V.h + 60) {
        g.fillStyle = C.yellow; g.strokeStyle = C.ink; g.lineWidth = 2
        g.beginPath(); g.arc(V.w * 0.16, my, G.T * 0.7, 0, 7); g.fill(); g.stroke()
        g.fillStyle = skyColor(alt); g.beginPath(); g.arc(V.w * 0.16 + G.T * 0.32, my - G.T * 0.16, G.T * 0.56, 0, 7); g.fill()
      }
    }
    // clouds (a slower layer than the ladder)
    for (let i = 0; i < 7; i++) {
      const s = G.T * (1.5 + (jit(i, 9) + 1) * 0.5)
      const y = G.baseY - (3.1 + i * 1.25 - cam) * G.S * 0.8
      if (y < -s || y > V.h + s || y - s * 0.7 < cloudMinY) continue
      const span = V.w + s * 3
      const x = ((((jit(i, 10) * 0.5 + 0.5) * span + V.t * (V.reduced ? 0 : 5 + i * 1.4)) % span) + span) % span - s * 1.5
      cloud(x, y, s)
    }
    // ground, hill and trees
    const gy = yOf(0) + G.T * 0.5
    if (gy < V.h + G.S * 5) {
      const T = G.T
      for (const [fx, hh, s, c] of [[0.07, 2.5, 1.9, LEAF2], [0.9, 3.2, 2.2, LEAF], [0.2, 1.5, 1.5, LEAF], [0.78, 1.7, 1.4, LEAF2]]) {
        const x = V.w * fx
        if (Math.abs(x - G.cx) < G.rowW / 2 + T * 1.2 && V.w < 560 && hh > 2) continue
        tree(x, gy + T * 0.2, hh * G.S * 0.72 * treeScale, s * T * (0.5 + treeScale * 0.5), c)
      }
      g.fillStyle = '#a9e3bd'; g.strokeStyle = C.ink; g.lineWidth = 2
      g.beginPath(); g.moveTo(-10, gy + T * 0.25)
      g.quadraticCurveTo(V.w * 0.25, gy - T * 0.25, V.w * 0.5, gy + T * 0.12); g.quadraticCurveTo(V.w * 0.78, gy + T * 0.45, V.w + 10, gy - T * 0.05)
      g.lineTo(V.w + 10, V.h + 10); g.lineTo(-10, V.h + 10); g.closePath(); g.fill(); g.stroke()
      for (let i = 0; i < 9; i++) {
        const x = (jit(i, 11) * 0.5 + 0.5) * V.w, y = gy + T * (0.55 + (jit(i, 12) + 1) * 0.3)
        g.fillStyle = [C.pink, C.yellow, TILE][i % 3]; g.beginPath(); g.arc(x, y, T * 0.09, 0, 7); g.fill(); g.lineWidth = 1.5; g.stroke()
      }
    }
  }

  function drawPlay() {
    const G = geom(), cam = V.cam
    backdrop(G, cam)
    const yOf = (k) => G.baseY - (k - cam) * G.S
    const n = V.words.length - 1
    const goalNat = yOf(V.gAnim), pinned = goalNat < G.topY - 0.5, goalY = pinned ? G.topY : goalNat
    const wig = V.wiggle >= 0 ? Math.exp(-V.wiggle * 3.2) : 0
    const sway = (y) => (wig ? Math.sin(V.wiggle * 17 + y * 0.03) * G.T * 0.13 * wig : 0)
    const tiltOf = (k) => jit(k, 3) * 0.03 + (wig ? Math.sin(V.wiggle * 15 + k * 1.3) * 0.07 * wig : 0)
    rails(G, goalY - G.T * 1.35, Math.min(V.h + 10, yOf(0) + G.T * 0.55), sway)
    const cur = V.words[n] || ''
    const limit = pinned ? G.topY + G.S * 0.72 : -1e9
    // empty rungs still to climb
    for (let k = n + 1; k < V.G; k++) {
      const y = yOf(k)
      if (y < limit || y > V.h + G.T) continue
      if (k === n + 1 && !V.over) {
        plank(G, y, tiltOf(k), true)
        const p = V.preview
        word(G, y, tiltOf(k), p ? p.letters : null, (i) => (p && p.letters[i] && p.changed[i] ? 'changed' : p && p.letters[i] ? 'ghost' : 'blankghost'))
      } else plank(G, y, tiltOf(k), true)
    }
    if (pinned) { g.fillStyle = C.ink; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(G.cx + i * G.T * 0.3, G.topY + G.S * 0.42, G.T * 0.055, 0, 7); g.fill() } }
    // rungs already climbed
    for (let k = 0; k <= n; k++) {
      if (V.won && k === n) continue
      const y = yOf(k) + sway(yOf(k))
      if (y < limit || y > V.h + G.T * 1.5) continue
      const w = V.words[k]
      const pop = k === n && V.flash >= 0 ? Math.sin(Math.min(1, V.flash / 0.3) * Math.PI) * 0.08 : 0
      plank(G, y, tiltOf(k), false)
      g.save(); g.translate(G.cx, y); g.scale(1 + pop, 1 + pop); g.translate(-G.cx, -y)
      word(G, y, tiltOf(k), w, (i) => (w[i] === V.goal[i] ? 'match' : 'plain'))
      g.restore()
      if (k === V.mark) {
        const pad = G.T * 0.28, a = V.reduced ? 1 : 0.65 + 0.35 * Math.sin(V.t * 8)
        g.save(); g.globalAlpha = a; g.strokeStyle = C.blue; g.lineWidth = 3; g.setLineDash([G.T * 0.22, G.T * 0.14])
        rr(G.cx - G.rowW / 2 - pad, y - G.T * 1.1 - pad, G.rowW + pad * 2, G.T + pad * 2, G.T * 0.3); g.stroke()
        g.restore()
      }
    }
    // the goal rung, with the bell post
    {
      const y = goalY + sway(goalY), tl = tiltOf(99)
      plank(G, y, tl, false)
      word(G, y, tl, V.goal, (i) => (cur[i] === V.goal[i] ? 'match' : 'goal'))
      const bx = G.railL - G.T * 0.85, by = y - G.T * 1.95
      g.strokeStyle = C.ink; g.lineWidth = G.T * 0.1 + 3; g.lineCap = 'round'
      g.beginPath(); g.moveTo(G.railL, y - G.T * 1.3); g.quadraticCurveTo(G.railL - G.T * 0.1, by - G.T * 0.1, bx, by); g.stroke()
      g.strokeStyle = WOOD_DARK; g.lineWidth = G.T * 0.1; g.stroke()
      const sw = V.bell >= 0 ? Math.sin(V.bell * 16) * 0.55 * Math.exp(-V.bell * 2.2) : Math.sin(V.t * 1.3) * 0.03
      bell(bx, by, G.T, V.reduced ? 0 : sw)
      if (V.bell >= 0 && V.bell < 0.7) {
        g.strokeStyle = C.ink; g.lineWidth = 2.5; const r = G.T * (0.75 + V.bell * 0.9)
        g.globalAlpha = 1 - V.bell / 0.7
        for (const a of [-2.5, -2.0, -1.1, -0.6]) { g.beginPath(); g.moveTo(bx + Math.cos(a) * r, by + G.T * 0.5 + Math.sin(a) * r); g.lineTo(bx + Math.cos(a) * (r + G.T * 0.2), by + G.T * 0.5 + Math.sin(a) * (r + G.T * 0.2)); g.stroke() }
        g.globalAlpha = 1
      }
    }
    // the robot
    {
      const hop = V.hopT < 1 ? Math.sin(V.hopT * Math.PI) : 0
      const ry = V.won ? lerp(yOf(V.hopFrom), goalY, easeInOut(V.hopT)) : yOf(V.robot)
      const cheer = V.cheer >= 0 ? (V.reduced ? 1 : 0.6 + 0.4 * Math.sin(V.cheer * 9)) : 0
      const jump = V.cheer >= 0 && !V.reduced ? Math.abs(Math.sin(V.cheer * 6.5)) * G.T * 0.22 * Math.exp(-V.cheer * 0.9) : 0
      const idle = V.reduced ? 0 : Math.sin(V.t * 2.2) * G.T * 0.012
      const shake = V.no >= 0 ? Math.sin(V.no * 46) * G.T * 0.09 * (1 - V.no / 0.4) : 0
      if (V.won || V.look < 0.01 || ry >= limit) robot(G.robotX + sway(ry), ry - G.T * 0.085 - hop * G.S * 0.2 - jump + idle, G.T, {
        squash: V.hopT < 1 ? Math.cos(V.hopT * Math.PI * 2) * 0.5 : 0, cheer, shake,
        blink: !V.reduced && (V.t % 3.7) < 0.12, lookY: V.no >= 0 ? 0.2 : -0.8, look: V.no >= 0 ? -0.9 : -0.45,
      })
    }
    for (const p of V.parts) {
      if (!p.on) continue
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.min(1, p.life * 2)
      g.fillStyle = CONFETTI[p.c]; g.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s); g.strokeStyle = C.ink; g.lineWidth = 1.2; g.strokeRect(-p.s, -p.s * 0.5, p.s * 2, p.s)
      g.restore()
    }
    g.globalAlpha = 1
  }

  function drawTitle() {
    // A blank four-letter ladder with the robot hopping up it on a loop.
    const keep = { len: V.len, goal: V.goal }
    V.len = 4
    const G = geom(), top = Math.max(2, Math.min(5, G.rows - 1))
    const cycle = top + 2.4, ph = V.reduced ? top * 0.5 : V.demoT * 0.9 % cycle
    const step = Math.min(top, Math.floor(ph)), frac = ph - Math.floor(ph)
    const pos = ph >= top ? (ph > top + 1.6 ? top * (1 - (ph - top - 1.6) / 0.8) : top) : step + (frac > 0.6 ? easeInOut((frac - 0.6) / 0.4) : 0)
    backdrop(G, 0, 2, V.slot.y)
    const yOf = (k) => G.baseY - k * G.S
    rails(G, yOf(top) - G.T * 1.35, yOf(0) + G.T * 0.55, () => 0)
    for (let k = 0; k <= top; k++) {
      plank(G, yOf(k), jit(k, 3) * 0.035, false)
      const lit = k <= pos + 0.01
      word(G, yOf(k), jit(k, 3) * 0.035, null, (i) => (k === top ? 'goal' : lit && (i + k) % 3 === 0 ? 'match' : lit ? 'plain' : 'blankghost'))
    }
    const y = yOf(top), bx = G.railL - G.T * 0.85, by = y - G.T * 1.95
    g.strokeStyle = C.ink; g.lineWidth = G.T * 0.1 + 3; g.lineCap = 'round'
    g.beginPath(); g.moveTo(G.railL, y - G.T * 1.3); g.quadraticCurveTo(G.railL - G.T * 0.1, by - G.T * 0.1, bx, by); g.stroke()
    g.strokeStyle = WOOD_DARK; g.lineWidth = G.T * 0.1; g.stroke()
    const ringT = ph - top
    bell(bx, by, G.T, ringT > 0 && ringT < 1.6 && !V.reduced ? Math.sin(ringT * 16) * 0.5 * Math.exp(-ringT * 2.2) : 0)
    const hopping = ph < top && frac > 0.6 ? Math.sin(((frac - 0.6) / 0.4) * Math.PI) : 0
    robot(G.robotX, yOf(pos) - G.T * 0.085 - hopping * G.S * 0.2, G.T, { cheer: ringT > 0 && ringT < 1.6 ? 0.8 : 0, blink: !V.reduced && (V.t % 3.7) < 0.12 })
    V.len = keep.len
  }

  function draw() {
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0)
    if (V.mode === 'play') drawPlay()
    else if (V.mode === 'title') drawTitle()
    else { const G = geom(); backdrop(G, -0.7, 3.2, 1e9, 0.45) }
  }
  return api
}
