// Stars (typed) and black holes. Gravity itself is CUSTOM point-gravity
// applied in GameScene.update (inverse-square, never Arcade's gravity).
// CONTACT WITH ANY STAR SURFACE OR EVENT HORIZON IS DEATH (spec.killRadius);
// the gravity minDist clamp sits just above the surface so orbits stay
// flyable but sloppy slingshots burn.
import Phaser from 'phaser'
import { mulberry32 } from '../utils/rng'
import { randRange } from '../utils/geometry'
import { STAR_TYPES } from '../data/stars'

export default class GravityWell extends Phaser.GameObjects.Container {
  constructor(scene, spec) {
    super(scene, spec.x, spec.y)
    this.spec = spec
    this.tweensList = []

    this.halo = scene.add.graphics()
    this.corona = scene.add.graphics()
    this.gfx = scene.add.graphics()
    this.beams = scene.add.graphics()
    this.add([this.halo, this.beams, this.corona, this.gfx])

    if (spec.kind === 'star') this.drawStar(scene)
    else this.drawBlackHole(scene)

    scene.add.existing(this)
    this.setDepth(-6)
  }

  drawStar(scene) {
    const t = STAR_TYPES[this.spec.starType] || STAR_TYPES['main-sequence']
    const rand = mulberry32(this.spec.visualSeed)
    const r = t.radius

    // vast halo wash — the star owns the panel
    for (let i = 4; i >= 1; i--) {
      this.halo.fillStyle(t.halo, 0.05 * i)
      this.halo.fillCircle(0, 0, r * (1.2 + (4 - i) * 0.85))
    }

    // corona rings (pulsed)
    this.corona.lineStyle(Math.max(3, r * 0.16), t.mid, 0.16)
    this.corona.strokeCircle(0, 0, r * 1.5)
    this.corona.lineStyle(2, t.mid, 0.35)
    this.corona.strokeCircle(0, 0, r * 1.24)
    // seeded flare arcs on the rim
    const flares = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < flares; i++) {
      const a0 = rand() * Math.PI * 2
      const span = randRange(rand, 0.3, 0.9)
      this.corona.lineStyle(randRange(rand, 1.5, 3), t.mid, 0.7)
      this.corona.beginPath()
      this.corona.arc(0, 0, r * randRange(rand, 1.04, 1.16), a0, a0 + span)
      this.corona.strokePath()
    }

    // chromatic body: layered core → mid
    this.gfx.fillStyle(t.mid, 0.55)
    this.gfx.fillCircle(0, 0, r)
    this.gfx.fillStyle(t.core, 0.85)
    this.gfx.fillCircle(0, 0, r * 0.78)
    this.gfx.fillStyle(0xffffff, 0.9)
    this.gfx.fillCircle(0, 0, r * 0.4)

    // diffraction spikes
    if (t.spikes) {
      const len = r * 2.6
      for (let i = 0; i < t.spikes; i++) {
        const a = (i / t.spikes) * Math.PI * 2 + (t.spikes === 4 ? Math.PI / 4 : 0)
        this.gfx.lineStyle(1.2, t.core, 0.35)
        this.gfx.lineBetween(
          Math.cos(a) * r * 1.05,
          Math.sin(a) * r * 1.05,
          Math.cos(a) * len,
          Math.sin(a) * len
        )
      }
    }

    // neutron lighthouse beams: two opposed sweeping lances
    if (t.beams) {
      const beamLen = r * 9
      for (const dir of [1, -1]) {
        this.beams.lineStyle(5, t.mid, 0.08)
        this.beams.lineBetween(0, 0, dir * beamLen, 0)
        this.beams.lineStyle(1.4, t.core, 0.5)
        this.beams.lineBetween(dir * r * 1.1, 0, dir * beamLen, 0)
      }
      this.tweensList.push(
        scene.tweens.add({
          targets: this.beams,
          rotation: Math.PI * 2,
          duration: 7000,
          repeat: -1,
        })
      )
    }

    // breathing pulse
    this.tweensList.push(
      scene.tweens.add({
        targets: this.corona,
        alpha: { from: 0.45, to: 1 },
        scale: { from: 0.97, to: 1.05 },
        duration: t.pulseMs,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout',
      })
    )
    this.tweensList.push(
      scene.tweens.add({
        targets: this.halo,
        alpha: { from: 0.7, to: 1 },
        duration: t.pulseMs * 1.7,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout',
      })
    )
  }

  drawBlackHole(scene) {
    const rand = mulberry32(this.spec.visualSeed)
    const r = 26 + rand() * 8
    this.coreRadius = r
    // accretion ring
    this.corona.lineStyle(2.5, 0xb28aff, 0.8)
    this.corona.strokeEllipse(0, 0, r * 4.4, r * 1.7)
    this.corona.lineStyle(6, 0x7a5cff, 0.18)
    this.corona.strokeEllipse(0, 0, r * 4.4, r * 1.7)
    // the hole
    this.gfx.fillStyle(0x05060a, 1)
    this.gfx.fillCircle(0, 0, r)
    this.gfx.lineStyle(1.5, 0xb28aff, 0.9)
    this.gfx.strokeCircle(0, 0, r)

    this.tweensList.push(
      scene.tweens.add({
        targets: this.corona,
        alpha: { from: 0.35, to: 0.9 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inout',
      })
    )
  }

  destroy(fromScene) {
    for (const t of this.tweensList) t.stop()
    super.destroy(fromScene)
  }
}
