// Seeded vector planet: disc + type-specific detail in the glow-stroke style.
// One per panel at most, so retained Graphics is cheap — no texture bake needed.
import Phaser from 'phaser'
import { mulberry32 } from '../utils/rng'
import { randRange, planetCaptureRadius } from '../utils/geometry'
import { ITEMS } from '../data/resources'
import { planetTheme } from '../data/planetTheme'
import { storedFor, msToFull } from '../systems/baseYield'

const FONT = '"Space Mono", monospace'

export default class Planet extends Phaser.GameObjects.Container {
  constructor(scene, spec) {
    super(scene, spec.x, spec.y)
    this.spec = spec
    this.gfx = scene.add.graphics()
    this.add(this.gfx)
    this.draw()

    // owned base: live silo readout under the planet, refreshed while parked
    if (spec.base) {
      this.baseLabel = scene.add
        .text(0, spec.radius + 22, '', {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#ffb35c',
          align: 'center',
        })
        .setOrigin(0.5, 0)
      this.add(this.baseLabel)
      this.refreshBaseLabel()
      this.labelTimer = scene.time.addEvent({
        delay: 30000,
        loop: true,
        callback: () => this.refreshBaseLabel(),
      })
    }

    scene.add.existing(this)
    scene.physics.add.existing(this)
    const r = spec.radius
    this.body.setCircle(r, -r, -r)
    this.body.setImmovable(true)
    this.body.moves = false
    this.setDepth(-5) // behind rocks and ship
  }

  refreshBaseLabel() {
    const base = this.spec.base
    if (!base || !this.baseLabel) return
    const name = (ITEMS[base.resourceType]?.name ?? base.resourceType).toUpperCase()
    const ms = msToFull(base)
    let status
    if (ms <= 0) {
      status = 'SILO FULL — COLLECT'
    } else {
      const totalM = Math.ceil(ms / 60000)
      const h = Math.floor(totalM / 60)
      const m = totalM % 60
      status = `FULL IN ${h > 0 ? `${h}H ` : ''}${m}M`
    }
    this.baseLabel.setText(`▲ ${name} ${storedFor(base)}/${base.capacity} · ${status}`)
    this.baseLabel.setColor(ms <= 0 ? '#7dffd8' : '#ffb35c')
  }

  destroy(fromScene) {
    this.labelTimer?.remove()
    super.destroy(fromScene)
  }

  draw() {
    const { type, radius, visualSeed, nodes, baseSite } = this.spec
    const rand = mulberry32(visualSeed)
    const style = planetTheme(type)
    const g = this.gfx
    g.clear()

    // capture boundary — the "atmosphere" edge where orbital capture begins
    g.lineStyle(1, style.stroke, 0.1)
    g.strokeCircle(0, 0, planetCaptureRadius(radius))
    g.lineStyle(4, style.stroke, 0.03)
    g.strokeCircle(0, 0, planetCaptureRadius(radius) - 3)

    // body disc: faint fill + double-stroke rim
    g.fillStyle(style.fill, 0.55)
    g.fillCircle(0, 0, radius)
    g.lineStyle(7, style.stroke, 0.14)
    g.strokeCircle(0, 0, radius)
    g.lineStyle(1.6, style.stroke, 0.9)
    g.strokeCircle(0, 0, radius)

    if (type === 'gas') {
      // latitude bands: chords bounded by the disc
      const bands = 3 + Math.floor(rand() * 3)
      for (let i = 0; i < bands; i++) {
        const dy = (rand() * 1.6 - 0.8) * radius
        const half = Math.sqrt(Math.max(0, radius * radius - dy * dy)) * 0.94
        g.lineStyle(randRange(rand, 3, 9), style.stroke, randRange(rand, 0.12, 0.3))
        g.lineBetween(-half, dy, half, dy)
      }
      g.lineStyle(1.2, style.stroke, 0.25)
      g.strokeCircle(0, 0, radius * 1.12) // atmosphere halo
    } else if (type === 'rocky') {
      const craters = 3 + Math.floor(rand() * 4)
      for (let i = 0; i < craters; i++) {
        const ang = rand() * Math.PI * 2
        const d = rand() * radius * 0.6
        const cr = randRange(rand, radius * 0.08, radius * 0.2)
        g.lineStyle(1.2, style.stroke, 0.5)
        g.strokeCircle(Math.cos(ang) * d, Math.sin(ang) * d, cr)
      }
    } else if (type === 'ice') {
      // polar caps
      for (const sign of [-1, 1]) {
        const dy = sign * radius * 0.72
        const half = Math.sqrt(Math.max(0, radius * radius - dy * dy)) * 0.9
        g.lineStyle(4, 0xeaf6ff, 0.35)
        g.lineBetween(-half, dy, half, dy)
      }
      g.lineStyle(1.2, style.stroke, 0.2)
      g.strokeCircle(0, 0, radius * 1.1)
    } else if (type === 'lava') {
      // jagged glowing cracks
      const cracks = 3 + Math.floor(rand() * 3)
      for (let i = 0; i < cracks; i++) {
        let ang = rand() * Math.PI * 2
        let d = rand() * radius * 0.3
        let x = Math.cos(ang) * d
        let y = Math.sin(ang) * d
        g.lineStyle(1.5, 0xffb35c, 0.85)
        g.beginPath()
        g.moveTo(x, y)
        const segs = 3 + Math.floor(rand() * 3)
        for (let sIdx = 0; sIdx < segs; sIdx++) {
          x += randRange(rand, -radius * 0.3, radius * 0.3)
          y += randRange(rand, -radius * 0.3, radius * 0.3)
          const len = Math.hypot(x, y)
          if (len > radius * 0.9) {
            x *= (radius * 0.9) / len
            y *= (radius * 0.9) / len
          }
          g.lineTo(x, y)
        }
        g.strokePath()
      }
    } else if (type === 'ringed') {
      const rw = radius * randRange(rand, 1.5, 1.9)
      const rh = rw * 0.32
      g.lineStyle(5, style.stroke, 0.15)
      g.strokeEllipse(0, 0, rw * 2, rh * 2)
      g.lineStyle(1.4, style.stroke, 0.8)
      g.strokeEllipse(0, 0, rw * 2, rh * 2)
      g.lineStyle(1, style.stroke, 0.4)
      g.strokeEllipse(0, 0, rw * 1.7, rh * 1.7)
    }

    // mineable nodes: glowing dots on the limb (interactive in phase 6)
    for (const node of nodes) {
      const nx = Math.cos(node.ang) * radius
      const ny = Math.sin(node.ang) * radius
      g.fillStyle(0x7dffd8, 0.25)
      g.fillCircle(nx, ny, 7)
      g.fillStyle(0x7dffd8, 0.95)
      g.fillCircle(nx, ny, 3)
    }

    // owned-base logo: a badge stamped on the planet face — amber ring with
    // a diamond insignia tinted by the resource this base mines
    if (this.spec.base) {
      const resColor = ITEMS[this.spec.base.resourceType]?.color ?? 0xffb35c
      g.fillStyle(0x0a1017, 0.75)
      g.fillCircle(0, 0, 18)
      g.lineStyle(1.6, 0xffb35c, 0.95)
      g.strokeCircle(0, 0, 18)
      g.lineStyle(1, 0xffb35c, 0.4)
      g.strokeCircle(0, 0, 14)
      g.lineStyle(1.6, resColor, 1)
      g.beginPath()
      g.moveTo(0, -9)
      g.lineTo(8, 0)
      g.lineTo(0, 9)
      g.lineTo(-8, 0)
      g.closePath()
      g.strokePath()
      g.fillStyle(resColor, 0.3)
      g.fillCircle(0, 0, 6)
    }

    // base site landing marker / built base dome
    if (this.spec.hasBase) {
      const bx = 0
      const by = -radius
      g.fillStyle(0xffb35c, 0.15)
      g.fillCircle(bx, by, 12)
      g.lineStyle(1.6, 0xffb35c, 0.95)
      g.beginPath()
      g.arc(bx, by, 9, Math.PI, 0)
      g.strokePath()
      g.lineBetween(bx - 9, by, bx + 9, by)
      g.lineBetween(bx, by - 9, bx, by - 17)
      g.fillStyle(0xffb35c, 1)
      g.fillCircle(bx, by - 18, 1.8)
    } else if (baseSite) {
      g.lineStyle(1.4, 0xffb35c, 0.9)
      g.strokeCircle(0, -radius - 16, 7)
      g.lineBetween(-5, -radius - 16, 5, -radius - 16)
    }
  }

  nodeWorldPos(node) {
    return {
      x: this.x + Math.cos(node.ang) * this.spec.radius,
      y: this.y + Math.sin(node.ang) * this.spec.radius,
    }
  }

  // node near a world point (bullet impact), or null
  nodeAt(wx, wy, range = 34) {
    for (const node of this.spec.nodes) {
      const p = this.nodeWorldPos(node)
      if (Math.hypot(wx - p.x, wy - p.y) < range) return node
    }
    return null
  }

  removeNode(node) {
    this.spec.nodes = this.spec.nodes.filter((n) => n !== node)
    this.draw()
  }
}
