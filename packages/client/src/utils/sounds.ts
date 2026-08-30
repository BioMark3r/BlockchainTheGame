// Web Audio API sound effects — no external files needed

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return ctx
}

function play(fn: (c: AudioContext) => void): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') {
    c.resume().then(() => fn(c)).catch(() => {})
  } else {
    try { fn(c) } catch {}
  }
}

// Short click — card selected
export function soundCardClick(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'; o.frequency.setValueAtTime(880, c.currentTime)
    g.gain.setValueAtTime(0.12, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07)
    o.start(c.currentTime); o.stop(c.currentTime + 0.07)
  })
}

// Block published — satisfying "chunk"
export function soundBlockPublish(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(330, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.12)
    g.gain.setValueAtTime(0.25, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25)
    o.start(c.currentTime); o.stop(c.currentTime + 0.25)
  })
}

// Validator placed — soft chime
export function soundValidatorPlaced(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'triangle'; o.frequency.setValueAtTime(660, c.currentTime)
    g.gain.setValueAtTime(0.15, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
    o.start(c.currentTime); o.stop(c.currentTime + 0.18)
  })
}

// Special/utility card played — whoosh
export function soundSpecialCard(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(200, c.currentTime)
    o.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.15)
    g.gain.setValueAtTime(0.08, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
    o.start(c.currentTime); o.stop(c.currentTime + 0.2)
  })
}

// Chain reorg — dramatic descending
export function soundChainReorg(): void {
  play((c) => {
    const freqs = [440, 370, 311, 262]
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'square'; o.frequency.setValueAtTime(f, c.currentTime)
      const t = c.currentTime + i * 0.1
      g.gain.setValueAtTime(0.08, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      o.start(t); o.stop(t + 0.12)
    })
  })
}

// Game won — ascending fanfare
export function soundWin(): void {
  play((c) => {
    const freqs = [262, 330, 392, 523]
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'sine'; o.frequency.setValueAtTime(f, c.currentTime)
      const t = c.currentTime + i * 0.12
      g.gain.setValueAtTime(0.2, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      o.start(t); o.stop(t + 0.25)
    })
  })
}

// Game lost — descending minor
export function soundLose(): void {
  play((c) => {
    const freqs = [392, 330, 294, 220]
    freqs.forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.connect(g); g.connect(c.destination)
      o.type = 'sine'; o.frequency.setValueAtTime(f, c.currentTime)
      const t = c.currentTime + i * 0.14
      g.gain.setValueAtTime(0.18, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
      o.start(t); o.stop(t + 0.28)
    })
  })
}

// Your turn — gentle ping
export function soundYourTurn(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'sine'; o.frequency.setValueAtTime(1047, c.currentTime)
    g.gain.setValueAtTime(0.1, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22)
    o.start(c.currentTime); o.stop(c.currentTime + 0.22)
  })
}

// Fork played — alarm buzz
export function soundFork(): void {
  play((c) => {
    const o = c.createOscillator()
    const g = c.createGain()
    o.connect(g); g.connect(c.destination)
    o.type = 'square'; o.frequency.setValueAtTime(150, c.currentTime)
    o.frequency.setValueAtTime(180, c.currentTime + 0.1)
    o.frequency.setValueAtTime(150, c.currentTime + 0.2)
    g.gain.setValueAtTime(0.2, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35)
    o.start(c.currentTime); o.stop(c.currentTime + 0.35)
  })
}
