import Phaser from 'phaser'
import { makeAsteroidVerts, strokeGlowPoly, randRange } from '../utils/geometry'
import { RESOURCES } from '../data/resources'

export const SMALLEST_RADIUS = 12 // at or below this, a hit fully destroys
const CHILD_CULL_RADIUS = 13 // split children smaller than this vaporize
const STROKE_COLOR = 0xf2f6f4

export default class Asteroid extends Phaser.GameObjects.Container {
  constructor(scene, x, y, radius, verts, vx, vy, spin, rot = 0) {
    super(scene, x, y)
    this.gfx = scene.add.graphics()
    this.add(this.gfx)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.configure(x, y, radius, verts, vx, vy, spin, rot)
  }

  configure(x, y, radius, verts, vx, vy, spin, rot) {
    this.radius = radius
    this.verts = verts
    this.spin = spin
    this.rotation = rot
    this.specIdx = -1
    this.mineral = null
    this.redraw()
    const r = radius * 0.85
    this.body.setCircle(r, -r, -r)
    // inertial mass ∝ r³ (bodies scale with volume): big rocks shove small
    // ones aside; Arcade's collider does the momentum-conserving exchange
    this.body.setMass(Math.pow(radius / 24, 3))
    this.body.setBounce(1, 1) // near-elastic rock impacts
    this.body.reset(x, y)
    this.body.enable = true
    this.body.setVelocity(vx, vy)
    this.setActive(true).setVisible(true)
  }

  redraw() {
    this.gfx.clear()
    strokeGlowPoly(this.gfx, this.verts, STROKE_COLOR)
    if (this.mineral) {
      // crystal seam glinting inside the rock
      const color = RESOURCES[this.mineral.type]?.color ?? 0x7dffd8
      const s = Math.max(4, this.radius * 0.22)
      this.gfx.fillStyle(color, 0.25)
      this.gfx.fillCircle(0, 0, s * 1.6)
      this.gfx.lineStyle(1.4, color, 0.95)
      this.gfx.strokePoints(
        [{ x: 0, y: -s }, { x: s * 0.7, y: 0 }, { x: 0, y: s }, { x: -s * 0.7, y: 0 }],
        true,
        true
      )
    }
  }

  setMineral(mineral) {
    this.mineral = mineral || null
    this.redraw()
  }

  // Pooled acquisition — panel transitions and splits churn many rocks.
  static obtain(scene, x, y, radius, verts, vx, vy, spin, rot = 0) {
    if (!scene.asteroidPool) scene.asteroidPool = []
    const pooled = scene.asteroidPool.pop()
    if (pooled) {
      pooled.configure(x, y, radius, verts, vx, vy, spin, rot)
      return pooled
    }
    return new Asteroid(scene, x, y, radius, verts, vx, vy, spin, rot)
  }

  release() {
    this.body.stop()
    this.body.enable = false
    this.setActive(false).setVisible(false)
    if (this.scene) {
      this.scene.asteroids.remove(this)
      this.scene.asteroidPool.push(this)
    }
  }

  static spawn(scene, x, y, radius, vx, vy) {
    const verts = makeAsteroidVerts(Math.random, radius)
    const spin = randRange(Math.random, -1.5, 1.5)
    return Asteroid.obtain(scene, x, y, radius, verts, vx, vy, spin)
  }

  static fromState(scene, s) {
    const a = Asteroid.obtain(scene, s.x, s.y, s.radius, s.verts, s.vx, s.vy, s.spin, s.rot)
    if (s.mineral) a.setMineral(s.mineral)
    return a
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
      rot: this.rotation,
      spin: this.spin,
      radius: this.radius,
      verts: this.verts.map(([x, y]) => [x, y]),
      mineral: this.mineral ? { ...this.mineral } : null,
    }
  }

  update(time, delta) {
    const dt = delta / 1000
    this.rotation += this.spin * dt

    // wrap within the current panel (classic asteroids style)
    const w = this.scene.scale.width
    const h = this.scene.scale.height
    const m = this.radius
    if (this.x < -m) this.x += w + m * 2
    else if (this.x > w + m) this.x -= w + m * 2
    if (this.y < -m) this.y += h + m * 2
    else if (this.y > h + m) this.y -= h + m * 2
  }

  // Returns spawned children (empty array = fully destroyed).
  // `mods` is the aggregated perk stats; `impactAngle` is the bullet's heading.
  split(mods, impactAngle) {
    const scene = this.scene
    if (this.radius <= SMALLEST_RADIUS) return []

    const parentArea = Math.PI * this.radius * this.radius
    const budget = parentArea * (1 - mods.destroyFraction)
    const count = Phaser.Math.Between(mods.splitCountMin, mods.splitCountMax)

    let weights = []
    let total = 0
    for (let i = 0; i < count; i++) {
      const w = randRange(Math.random, 0.6, 1.4)
      weights.push(w)
      total += w
    }

    const children = []
    for (const w of weights) {
      const childR = Math.sqrt((budget * (w / total) * mods.childSizeBias) / Math.PI)
      if (childR < CHILD_CULL_RADIUS) continue
      // scatter roughly perpendicular/away from the shot direction
      const scatter = impactAngle + Math.PI + randRange(Math.random, -1.3, 1.3)
      const speed = randRange(Math.random, 40, 110) * Math.min(2.2, this.radius / childR) * 0.8
      const vx = this.body.velocity.x + Math.cos(scatter) * speed
      const vy = this.body.velocity.y + Math.sin(scatter) * speed
      const ox = Math.cos(scatter) * this.radius * 0.3
      const oy = Math.sin(scatter) * this.radius * 0.3
      children.push(Asteroid.spawn(scene, this.x + ox, this.y + oy, childR, vx, vy))
    }
    return children
  }
}
