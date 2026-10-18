// 8-bit sound synth via WebAudio — no assets needed
let ctx: AudioContext | null = null
let enabled = true

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function setSoundEnabled(v: boolean) {
  enabled = v
}

export function isSoundEnabled() {
  return enabled
}

function tone(freq: number, t0: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  const start = c.currentTime + t0
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(vol, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.02)
}

export const sfx = {
  click() {
    tone(660, 0, 0.07, 'square', 0.05)
  },
  step() {
    tone(180 + Math.random() * 40, 0, 0.04, 'triangle', 0.02)
  },
  correct() {
    tone(523, 0, 0.1)
    tone(659, 0.09, 0.1)
    tone(784, 0.18, 0.12)
    tone(1046, 0.27, 0.22)
  },
  grace() {
    // second chance — gentle
    tone(392, 0, 0.12, 'triangle', 0.05)
    tone(523, 0.11, 0.18, 'triangle', 0.05)
  },
  wrong() {
    tone(311, 0, 0.14, 'sawtooth', 0.045)
    tone(233, 0.13, 0.2, 'sawtooth', 0.045)
  },
  crossroad() {
    tone(440, 0, 0.09)
    tone(440, 0.12, 0.09)
    tone(587, 0.24, 0.16)
  },
  levelDone() {
    const seq = [523, 659, 784, 1046, 784, 1046]
    seq.forEach((f, i) => tone(f, i * 0.11, 0.14))
    tone(1318, seq.length * 0.11, 0.4)
  },
  fanfare() {
    const seq = [392, 523, 659, 784, 659, 784, 1046]
    seq.forEach((f, i) => tone(f, i * 0.13, 0.15))
    tone(1568, seq.length * 0.13, 0.5)
  },
}
