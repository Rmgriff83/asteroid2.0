import Phaser from 'phaser'
import { mulberry32 } from '../utils/rng'
import { makeAsteroidVerts, strokeGlowPoly, randRange } from '../utils/geometry'
import { spawnStarfield } from '../systems/Starfield'
import { DEFAULT_GALAXY_SEED } from '../galaxy/constants'

// Slow procedural asteroid field that drifts behind the Vue splash, menu and
// store overlays. Seeded so it looks the same every launch.
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro')
  }

  create() {
    this.cameras.main.setBackgroundColor(0x151b2c)
    const rand = mulberry32(0x5eed)
    this.rocks = []
    const w = this.scale.width
    const h = this.scale.height

    for (let i = 0; i < 12; i++) {
      const radius = randRange(rand, 14, 52)
      const verts = makeAsteroidVerts(rand, radius)
      const gfx = this.add.graphics()
      strokeGlowPoly(gfx, verts, 0xf2f6f4, { alpha: 0.45 })
      gfx.x = rand() * w
      gfx.y = rand() * h
      this.rocks.push({
        gfx,
        radius,
        vx: randRange(rand, -18, 18),
        vy: randRange(rand, -18, 18),
        spin: randRange(rand, -0.4, 0.4),
      })
    }

    // the same deterministic starfield system the game uses (scenic fixed panel)
    this.starfield = spawnStarfield(this, DEFAULT_GALAXY_SEED, 777, 777, {
      density: 0.8,
      systemType: 'nebula',
    })
    this.events.once('shutdown', () => this.starfield?.destroy())

    this.scanlines = this.add
      .tileSprite(0, 0, w, h, 'scanline')
      .setOrigin(0)
      .setAlpha(0.07)
      .setDepth(10)

    this.scale.on('resize', this.onResize, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this))
  }

  onResize(size) {
    this.scanlines.setSize(size.width, size.height)
  }

  update(time, delta) {
    const dt = delta / 1000
    const w = this.scale.width
    const h = this.scale.height
    for (const r of this.rocks) {
      r.gfx.x += r.vx * dt
      r.gfx.y += r.vy * dt
      r.gfx.rotation += r.spin * dt
      const m = r.radius
      if (r.gfx.x < -m) r.gfx.x += w + m * 2
      else if (r.gfx.x > w + m) r.gfx.x -= w + m * 2
      if (r.gfx.y < -m) r.gfx.y += h + m * 2
      else if (r.gfx.y > h + m) r.gfx.y -= h + m * 2
    }
  }
}
