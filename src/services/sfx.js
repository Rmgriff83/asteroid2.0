// Tiny procedural retro SFX via Web Audio — no audio files, matching the
// no-assets philosophy. iOS requires a user gesture before audio: call
// unlockAudio() from the first pointerdown.
let ctx = null
let master = null

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.16 // zen volume
    master.connect(ctx.destination)
  }
  return ctx
}

export function unlockAudio() {
  const c = ac()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

function env(duration, peak = 1) {
  const c = ac()
  const g = c.createGain()
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(peak, c.currentTime + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration)
  g.connect(master)
  return g
}

function tone(type, f0, f1, duration, peak = 1) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, c.currentTime)
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), c.currentTime + duration)
  o.connect(env(duration, peak))
  o.start()
  o.stop(c.currentTime + duration + 0.02)
}

function noise(duration, cutoff = 800, peak = 1) {
  const c = ac()
  if (!c || c.state !== 'running') return
  const len = Math.floor(c.sampleRate * duration)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  src.connect(filter)
  filter.connect(env(duration, peak))
  src.start()
}

export const sfx = {
  shoot: () => tone('square', 880, 320, 0.07, 0.5),
  crack: () => noise(0.12, 1400, 0.7),
  boom: () => noise(0.35, 500, 1),
  scoop: () => tone('sine', 520, 1040, 0.09, 0.6),
  boost: () => tone('sawtooth', 140, 420, 0.3, 0.5),
  hit: () => {
    noise(0.2, 900, 0.9)
    tone('triangle', 200, 60, 0.25, 0.7)
  },
  dock: () => {
    tone('sine', 660, 660, 0.09, 0.5)
    setTimeout(() => tone('sine', 880, 880, 0.12, 0.5), 90)
  },
  blip: () => tone('sine', 990, 990, 0.05, 0.4),
}
