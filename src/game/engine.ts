// Pixel-art world engine for Crossroads
// Renders to a low-res buffer upscaled with image-rendering: pixelated

export type PaletteName = 'day' | 'sunset' | 'night'

interface Palette {
  sky: string[]
  sun: string
  sunRay: string
  cloud: string
  cloudShade: string
  mountain: string
  mountainSnow: string
  mountainFar: string
  hill: string
  grass: string
  grassAlt: string
  path: string
  pathEdge: string
  pathDash: string
  treeDark: string
  treeLight: string
  trunk: string
  rock: string
  flowers: string[]
  signGold: string
  signGoldEdge: string
  signDark: string
  signDarkEdge: string
  stars: boolean
}

export const PALETTES: Record<PaletteName, Palette> = {
  day: {
    sky: ['#7ec8f2', '#8fd0f4', '#a3d9f7', '#b8e2f9', '#cdeafb'],
    sun: '#ffd94a',
    sunRay: '#ffed9e',
    cloud: '#ffffff',
    cloudShade: '#dfeef7',
    mountain: '#5f7d9c',
    mountainSnow: '#f4f8fb',
    mountainFar: '#8fa8c0',
    hill: '#4e8f4a',
    grass: '#58a447',
    grassAlt: '#4f9a40',
    path: '#d9b98a',
    pathEdge: '#b39058',
    pathDash: '#f2e3c2',
    treeDark: '#1f6b38',
    treeLight: '#2f8a48',
    trunk: '#6e4a2a',
    rock: '#9aa3ab',
    flowers: ['#ffffff', '#ffd94a', '#ff9ecb'],
    signGold: '#caa64b',
    signGoldEdge: '#7c5a1e',
    signDark: '#3a3438',
    signDarkEdge: '#1d1a1c',
    stars: false,
  },
  sunset: {
    sky: ['#3d3a6e', '#6e4a7e', '#a05a78', '#d4786a', '#f2a65e'],
    sun: '#ffb347',
    sunRay: '#ffd08a',
    cloud: '#ffd9b8',
    cloudShade: '#e8b090',
    mountain: '#4a4468',
    mountainSnow: '#e8c8c0',
    mountainFar: '#6a5f88',
    hill: '#3d6b3f',
    grass: '#478a3e',
    grassAlt: '#3f8038',
    path: '#c9a071',
    pathEdge: '#9c744a',
    pathDash: '#e8d0a8',
    treeDark: '#1a5530',
    treeLight: '#287840',
    trunk: '#5e3f24',
    rock: '#8a8a95',
    flowers: ['#ffd9b8', '#ffb347', '#ff8a8a'],
    signGold: '#caa64b',
    signGoldEdge: '#7c5a1e',
    signDark: '#3a3438',
    signDarkEdge: '#1d1a1c',
    stars: false,
  },
  night: {
    sky: ['#0d1130', '#141a42', '#1c2452', '#242e60', '#2c386e'],
    sun: '#f4f1d8', // moon
    sunRay: '#d8d4b0',
    cloud: '#4a5480',
    cloudShade: '#3a4266',
    mountain: '#232a4a',
    mountainSnow: '#8a94b8',
    mountainFar: '#2e3758',
    hill: '#1e4a2e',
    grass: '#2a6b3a',
    grassAlt: '#245f34',
    path: '#8a7a5e',
    pathEdge: '#5e5240',
    pathDash: '#b8a888',
    treeDark: '#123f24',
    treeLight: '#1d5c34',
    trunk: '#4a3220',
    rock: '#5e6470',
    flowers: ['#b8c8ff', '#f4f1d8', '#8a94ff'],
    signGold: '#caa64b',
    signGoldEdge: '#7c5a1e',
    signDark: '#3a3438',
    signDarkEdge: '#1d1a1c',
    stars: true,
  },
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const PC: Record<string, string> = {
  h: '#3a2e2e',
  s: '#e9b489',
  b: '#33547d',
  g: '#a5703a',
  k: '#7c5027',
  p: '#2c4560',
  n: '#5c3d24',
}

const PLAYER_HEAD_BODY = [
  '............',
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhhhhhh..',
  '..shhhhhhs..',
  '...ssssss...',
  '..bbbbbbbb..',
  '.bbbbbbbbbb.',
  '.bggggggggb.',
  '.bggkkkkggb.',
  '.sggggggggs.',
  '..pppppppp..',
]
const LEGS_A = ['..ppp..ppp..', '..pp....pp..', '..nn....nn..', '.nnn....nnn.']
const LEGS_B = ['..pp...ppp..', '.ppp....pp..', '.nn.....nn..', '.nnn....nnn.']
const LEGS_IDLE = ['..pppppppp..', '...pp..pp...', '...nn..nn...', '..nnn..nnn..']

export interface EngineOpts {
  palette: PaletteName
  onCrossroad: (index: number) => void
  onLevelEnd: () => void
  onOffPath?: (off: boolean) => void
  onProgress?: (p: number) => void
}

export class CrossroadsEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private buf: HTMLCanvasElement
  private bctx: CanvasRenderingContext2D
  private opts: EngineOpts
  private pal: Palette

  private raf = 0
  private last = 0
  private running = false
  private paused = true

  private W = 0
  private H = 0
  private scale = 3

  private playerY = 0
  private offset = 0
  private targetOffset = 0
  private walkPhase = 0
  private crossYs: number[] = []
  private endY = 0
  private answered = 0
  private light = 55
  private time = 0
  private offPathTime = 0
  private wasOff = false
  private dust: { x: number; y: number; t: number }[] = []

  private tiltEnabled = false
  private tiltGamma = 0
  private pointerDown = false
  private pointerX = 0
  private keys = { left: false, right: false }
  private removeFns: (() => void)[] = []
  private onStepSound?: () => void
  private stepAcc = 0

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas
    this.opts = opts
    this.pal = PALETTES[opts.palette]
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    this.buf = document.createElement('canvas')
    const bctx = this.buf.getContext('2d')
    if (!bctx) throw new Error('no 2d buffer')
    this.bctx = bctx

    // geometry: 3 crossroads + finish gate
    const spacing = 260
    this.crossYs = [200, 200 + spacing, 200 + spacing * 2]
    this.endY = 200 + spacing * 3

    this.resize()
    this.attachInput()
  }

  setStepSound(fn: () => void) {
    this.onStepSound = fn
  }

  setLight(v: number) {
    this.light = Math.max(0, Math.min(100, v))
  }

  setTiltEnabled(v: boolean) {
    this.tiltEnabled = v
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect()
    const cssW = Math.max(200, rect.width)
    const cssH = Math.max(200, rect.height)
    this.scale = Math.max(2, Math.round(Math.min(cssW, cssH) / 170))
    this.W = Math.ceil(cssW / this.scale)
    this.H = Math.ceil(cssH / this.scale)
    this.buf.width = this.W
    this.buf.height = this.H
    this.canvas.width = cssW
    this.canvas.height = cssH
    this.ctx.imageSmoothingEnabled = false
  }

  start() {
    this.running = true
    this.paused = false
    this.last = performance.now()
    const loop = (t: number) => {
      if (!this.running) return
      const dt = Math.min(0.05, (t - this.last) / 1000)
      this.last = t
      this.update(dt)
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
    this.targetOffset = 0
    this.last = performance.now()
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.removeFns.forEach((f) => f())
  }

  get progress(): number {
    return Math.min(1, this.playerY / this.endY)
  }

  // ---------- input ----------
  private attachInput() {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
        this.keys.left = down
        e.preventDefault()
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        this.keys.right = down
        e.preventDefault()
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    this.removeFns.push(() => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
    })

    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma === 'number') this.tiltGamma = e.gamma
    }
    window.addEventListener('deviceorientation', onOrient)
    this.removeFns.push(() => window.removeEventListener('deviceorientation', onOrient))

    const pd = (e: PointerEvent) => {
      this.pointerDown = true
      this.pointerX = e.clientX
      this.canvas.setPointerCapture?.(e.pointerId)
    }
    const pm = (e: PointerEvent) => {
      if (!this.pointerDown) return
      const rect = this.canvas.getBoundingClientRect()
      const dx = e.clientX - this.pointerX
      this.pointerX = e.clientX
      this.targetOffset += (dx / rect.width) * this.W * 0.9
    }
    const pu = () => {
      this.pointerDown = false
    }
    this.canvas.addEventListener('pointerdown', pd)
    this.canvas.addEventListener('pointermove', pm)
    this.canvas.addEventListener('pointerup', pu)
    this.canvas.addEventListener('pointercancel', pu)
    this.removeFns.push(() => {
      this.canvas.removeEventListener('pointerdown', pd)
      this.canvas.removeEventListener('pointermove', pm)
      this.canvas.removeEventListener('pointerup', pu)
      this.canvas.removeEventListener('pointercancel', pu)
    })

    const onResize = () => this.resize()
    window.addEventListener('resize', onResize)
    this.removeFns.push(() => window.removeEventListener('resize', onResize))
  }

  // ---------- world math ----------
  private pathCenter(y: number): number {
    const margin = this.W * 0.28
    const c =
      this.W / 2 +
      Math.sin(y * 0.011) * this.W * 0.13 +
      Math.sin(y * 0.0042 + 1.7) * this.W * 0.09
    return Math.max(margin, Math.min(this.W - margin, c))
  }

  private pathHalf(): number {
    return Math.max(11, this.W * 0.06)
  }

  // fork divergence at crossroad: 0 → max → 0
  private forkDiverge(fy: number, y: number): number {
    const d = y - fy
    if (d <= 0 || d >= 130) return 0
    const max = this.W * 0.2
    if (d < 60) return (d / 60) * max
    return max * (1 - (d - 60) / 70)
  }

  private playerScreenY(): number {
    return Math.round(this.H * 0.62)
  }

  // ---------- update ----------
  private update(dt: number) {
    this.time += dt
    if (this.paused) return

    const half = this.pathHalf()
    // player position is absolute on screen; the path winds beneath them —
    // steering is what keeps you on the trail
    const maxOff = this.W * 0.3

    // input → targetOffset (relative to screen center)
    if (this.keys.left) this.targetOffset -= dt * this.W * 0.7
    if (this.keys.right) this.targetOffset += dt * this.W * 0.7
    if (this.tiltEnabled) {
      this.targetOffset = (this.tiltGamma / 30) * maxOff
    }
    this.targetOffset = Math.max(-maxOff, Math.min(maxOff, this.targetOffset))
    // gentle drift back to center when no input (forgiving for kids)
    if (!this.pointerDown && !this.keys.left && !this.keys.right && !this.tiltEnabled) {
      this.targetOffset *= 1 - dt * 0.25
    }
    this.offset += (this.targetOffset - this.offset) * Math.min(1, dt * 7)

    const cx = this.pathCenter(this.playerY)
    const playerX = this.W / 2 + this.offset
    const off = Math.abs(playerX - cx) > half - 3
    const speed = off ? 26 : 46

    if (off) {
      this.offPathTime += dt
      if (Math.random() < dt * 6) {
        this.dust.push({
          x: playerX + (Math.random() - 0.5) * 6,
          y: this.playerY,
          t: 0,
        })
      }
    } else {
      this.offPathTime = Math.max(0, this.offPathTime - dt * 2)
    }
    if (off !== this.wasOff) {
      this.wasOff = off
      this.opts.onOffPath?.(off)
    }

    this.playerY += speed * dt
    this.walkPhase += speed * dt
    this.stepAcc += speed * dt
    if (this.stepAcc > 14 && !off) {
      this.stepAcc = 0
      this.onStepSound?.()
    }

    this.dust = this.dust.filter((d) => (d.t += dt) < 0.6)

    // crossroad trigger
    if (this.answered < this.crossYs.length && this.playerY >= this.crossYs[this.answered]) {
      const idx = this.answered
      this.paused = true
      this.opts.onCrossroad(idx)
      return
    }
    if (this.playerY >= this.endY) {
      this.paused = true
      this.opts.onLevelEnd()
      return
    }
    this.opts.onProgress?.(this.progress)
  }

  answerDone() {
    this.answered++
    this.playerY = this.crossYs[this.answered - 1] + 6
  }

  get offPath(): boolean {
    return this.wasOff
  }

  get offPathLong(): boolean {
    return this.offPathTime > 1.2
  }

  // ---------- drawing ----------
  private px(x: number, y: number, w: number, h: number, c: string) {
    this.bctx.fillStyle = c
    this.bctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  private draw() {
    const b = this.bctx
    const W = this.W
    const H = this.H
    const pal = this.pal
    const psy = this.playerScreenY()
    const horizonY = Math.round(H * 0.34)

    // sky bands
    const bandH = Math.ceil(horizonY / pal.sky.length)
    pal.sky.forEach((c, i) => this.px(0, i * bandH, W, bandH + 1, c))

    // stars
    if (pal.stars) {
      for (let i = 0; i < 40; i++) {
        const x = hash(i * 3.3) * W
        const y = hash(i * 7.7) * horizonY * 0.9
        const tw = Math.sin(this.time * 2 + i) > 0.2
        if (tw) this.px(x, y, 1, 1, '#f4f1d8')
      }
    }

    // sun / moon
    const sx = W * 0.78
    const sy = horizonY * 0.28
    const sr = Math.max(4, W * 0.03)
    b.fillStyle = pal.sunRay
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + 0.3
      const rx = sx + Math.cos(ang) * (sr + 3)
      const ry = sy + Math.sin(ang) * (sr + 3)
      this.px(rx - 0.5, ry - 0.5, 2, 2, pal.sunRay)
    }
    b.fillStyle = pal.sun
    b.beginPath()
    b.arc(sx, sy, sr, 0, Math.PI * 2)
    b.fill()

    // clouds (drift + parallax)
    for (let i = 0; i < 4; i++) {
      const cxp = ((hash(i * 11) * W * 1.6 + this.time * (2 + i) - this.playerY * 0.05) % (W + 60)) - 30
      const cyp = hash(i * 23) * horizonY * 0.55 + 4
      const cw = 14 + hash(i * 5) * 10
      this.px(cxp, cyp + 2, cw, 3, pal.cloud)
      this.px(cxp + 2, cyp, cw - 6, 3, pal.cloud)
      this.px(cxp + 1, cyp + 5, cw - 2, 1, pal.cloudShade)
    }

    // far mountains (parallax 0.3)
    this.drawRidge(horizonY, W * 0.34, 0.3, pal.mountainFar, pal.mountainSnow, 1.3)
    // near mountains (parallax 0.55)
    this.drawRidge(horizonY + 2, W * 0.22, 0.55, pal.mountain, pal.mountainSnow, 2.1)
    // hill band
    this.px(0, horizonY, W, 3, pal.hill)

    // ground rows
    for (let sy = horizonY + 3; sy < H; sy++) {
      const wy = this.playerY + (psy - sy)
      const rowHash = hash(Math.floor(wy / 2) * 17)
      b.fillStyle = rowHash > 0.78 ? pal.grassAlt : pal.grass
      b.fillRect(0, sy, W, 1)

      // main path
      const cx = this.pathCenter(wy)
      const half = this.pathHalf()
      this.px(cx - half - 1, sy, half * 2 + 2, 1, pal.pathEdge)
      this.px(cx - half, sy, half * 2, 1, pal.path)
      if (Math.floor(wy) % 6 < 3) {
        this.px(cx - 0.5, sy, 1, 1, pal.pathDash)
      }

      // fork branches
      for (const fy of this.crossYs) {
        const div = this.forkDiverge(fy, wy)
        if (div > 2) {
          for (const dir of [-1, 1]) {
            const bcx = cx + dir * div
            const bh = half * 0.8
            this.px(bcx - bh - 1, sy, bh * 2 + 2, 1, pal.pathEdge)
            this.px(bcx - bh, sy, bh * 2, 1, pal.path)
          }
        }
      }
    }

    // scenery (deterministic per world band)
    const bandSize = 22
    const yTop = this.playerY + (psy - (horizonY + 3))
    const yBot = this.playerY + (psy - H)
    const bandTop = Math.floor(yTop / bandSize)
    const bandBot = Math.floor(yBot / bandSize)
    for (let band = bandBot - 1; band <= bandTop + 1; band++) {
      const wy = band * bandSize + hash(band * 3.1) * bandSize * 0.6
      const sy = psy - (wy - this.playerY)
      if (sy < horizonY + 4 || sy > H + 20) continue
      const inFork = this.crossYs.some((fy) => wy > fy - 14 && wy < fy + 130)
      if (inFork) continue
      for (const side of [-1, 1]) {
        const r = hash(band * 13.7 + (side + 1) * 5.5)
        if (r > 0.62) continue
        const cx = this.pathCenter(wy)
        const half = this.pathHalf()
        const dist = half + 4 + hash(band * 7.3 + side) * (W * 0.30)
        const x = cx + side * dist
        if (x < 4 || x > W - 4) continue
        const kind = hash(band * 29.1 + side * 3)
        if (kind < 0.5) this.drawTree(x, sy, 1.2 + hash(band + side * 9) * 0.8)
        else if (kind < 0.68) this.drawRock(x, sy)
        else this.drawFlowers(x, sy, band + side)
      }
    }

    // crossroad signs + finish gate
    for (let i = 0; i < this.crossYs.length; i++) {
      const fy = this.crossYs[i]
      const sy = psy - (fy - this.playerY)
      if (sy < horizonY - 30 || sy > H + 20) continue
      const cx = this.pathCenter(fy)
      const gap = this.W * 0.16
      this.drawSign(cx - gap, sy, 'truth')
      this.drawSign(cx + gap, sy, 'lies')
    }
    const gy = psy - (this.endY - this.playerY)
    if (gy > -40 && gy < H + 10) this.drawGate(this.pathCenter(this.endY), gy)

    // dust particles
    for (const d of this.dust) {
      const sy = psy - (d.y - this.playerY)
      this.px(d.x, sy - d.t * 8, 1, 1, '#e8e0c8')
    }

    // player
    const px = this.W / 2 + this.offset
    this.drawPlayer(px, psy)

    // off-path hint arrow (points back toward the trail)
    if (this.offPathLong) {
      const cx = this.pathCenter(this.playerY)
      const dir = px > cx ? -1 : 1
      const ay = psy - 22 - Math.abs(Math.sin(this.time * 5)) * 3
      const ax = px + dir * 10
      b.fillStyle = '#ffd94a'
      for (let i = 0; i < 5; i++) {
        this.px(ax + dir * i - 1, ay - i * 0.6, 3, 1 + i * 0.4, '#ffd94a')
      }
    }

    // light vignette: darkness grows as light drops
    const dark = (1 - this.light / 100) * 0.55
    if (dark > 0.02) {
      const grad = this.bctx.createRadialGradient(px, psy, W * 0.1, px, psy, W * 0.6)
      grad.addColorStop(0, 'rgba(8,8,20,0)')
      grad.addColorStop(1, `rgba(8,8,20,${dark.toFixed(2)})`)
      b.fillStyle = grad
      b.fillRect(0, 0, W, H)
    }

    // blit
    this.ctx.imageSmoothingEnabled = false
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.buf, 0, 0, this.canvas.width, this.canvas.height)
  }

  private drawRidge(baseY: number, amp: number, par: number, color: string, snow: string, seed: number) {
    const b = this.bctx
    const cam = this.playerY * par * 0.06
    const tri = (v: number) => Math.abs((((v % 2) + 2) % 2) - 1)
    for (let x = 0; x < this.W; x++) {
      const t1 = tri((x + cam) * 0.017 + seed)
      const t2 = tri((x + cam) * 0.043 + seed * 1.7)
      const h = amp * (0.22 + t1 * 0.62 + t2 * 0.28)
      const top = baseY - h
      b.fillStyle = color
      b.fillRect(x, top, 1, h + 1)
      // snow only on high peaks
      if (t1 > 0.55) {
        b.fillStyle = snow
        const capH = Math.max(1, (t1 - 0.55) * amp * 0.5)
        b.fillRect(x, top, 1, capH)
      }
    }
  }

  private drawTree(x: number, y: number, s: number) {
    const pal = this.pal
    const th = Math.max(10, Math.round(15 * s))
    const tw = Math.max(7, Math.round(10 * s))
    const tierH = th / 3
    this.px(x - 1, y - 3, 3, 4, pal.trunk)
    for (let i = 0; i < th; i++) {
      const k = Math.floor(i / tierH)
      const rowIn = i - k * tierH
      const halfw = Math.max(1, ((rowIn + 1) / tierH) * (tw / 2) * (1 - k * 0.28))
      const yy = y - 4 - i
      this.px(x - halfw, yy, halfw * 2, 1, pal.treeDark)
      this.px(x - halfw, yy, Math.max(1, halfw * 0.75), 1, pal.treeLight)
    }
    this.px(x - 0.5, y - 5 - th, 1, 2, pal.treeLight)
  }

  private drawRock(x: number, y: number) {
    this.px(x - 3, y - 2, 6, 3, this.pal.rock)
    this.px(x - 2, y - 3, 4, 2, this.pal.rock)
    this.px(x - 2, y - 3, 2, 1, '#c8ccd2')
  }

  private drawFlowers(x: number, y: number, seed: number) {
    for (let i = 0; i < 3; i++) {
      const fx = x + (hash(seed * 3 + i) - 0.5) * 8
      const fy = y - hash(seed * 5 + i) * 4
      const c = this.pal.flowers[Math.floor(hash(seed * 7 + i) * this.pal.flowers.length)]
      this.px(fx, fy, 1, 1, c)
    }
  }

  private drawSign(x: number, y: number, kind: 'truth' | 'lies') {
    const pal = this.pal
    const bw = 15
    const bh = 9
    const bx = x - bw / 2
    const by = y - 16
    // post
    this.px(x - 1, by + bh, 3, 9, pal.trunk)
    // board
    const edge = kind === 'truth' ? pal.signGoldEdge : pal.signDarkEdge
    const face = kind === 'truth' ? pal.signGold : pal.signDark
    this.px(bx - 1, by - 1, bw + 2, bh + 2, edge)
    this.px(bx, by, bw, bh, face)
    if (kind === 'truth') {
      // white cross
      this.px(x - 0.5, by + 1.5, 1.5, 6, '#fff8e8')
      this.px(x - 2.5, by + 3.5, 5.5, 1.5, '#fff8e8')
    } else {
      // red crack / X
      this.px(bx + 2, by + 2, 2, 1, '#c04040')
      this.px(bx + 4, by + 3, 2, 1, '#c04040')
      this.px(bx + 6, by + 4, 2, 1, '#c04040')
      this.px(bx + 9, by + 2, 2, 1, '#c04040')
      this.px(bx + 8, by + 3, 2, 1, '#c04040')
      this.px(bx + 6, by + 5, 2, 1, '#c04040')
    }
  }

  private drawGate(x: number, y: number) {
    const pal = this.pal
    const gw = 30
    const gh = 22
    this.px(x - gw / 2, y - gh, 4, gh, pal.trunk)
    this.px(x + gw / 2 - 4, y - gh, 4, gh, pal.trunk)
    this.px(x - gw / 2 - 2, y - gh - 3, gw + 4, 4, pal.signGold)
    this.px(x - gw / 2 - 2, y - gh - 3, gw + 4, 1, pal.signGoldEdge)
    // lantern glow
    const glow = 0.5 + Math.sin(this.time * 3) * 0.2
    this.px(x - 1, y - gh + 2, 3, 4, '#ffd94a')
    const b = this.bctx
    b.fillStyle = `rgba(255,217,74,${(glow * 0.25).toFixed(2)})`
    b.beginPath()
    b.arc(x, y - gh + 4, 8, 0, Math.PI * 2)
    b.fill()
  }

  private drawPlayer(x: number, y: number) {
    const moving = !this.paused
    const frame = Math.floor(this.walkPhase / 9) % 2 === 0 ? LEGS_A : LEGS_B
    const legs = moving ? frame : LEGS_IDLE
    const rows = [...PLAYER_HEAD_BODY, ...legs]
    const bob = moving ? Math.abs(Math.sin(this.walkPhase * 0.12)) * -1 : 0
    const px0 = Math.round(x - 6)
    const py0 = Math.round(y - rows.length + 2 + bob)
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]
        if (ch === '.') continue
        const col = PC[ch]
        if (col) this.px(px0 + c, py0 + r, 1, 1, col)
      }
    }
    // shadow
    this.px(x - 4, y + 1, 8, 1, 'rgba(0,0,0,0.18)')
  }
}
