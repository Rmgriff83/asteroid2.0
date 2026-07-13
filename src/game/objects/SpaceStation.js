// Authored-feel waystation: hex core + spokes + slow-rotating outer ring.
// Docking (proximity + low speed) is detected in GameScene.
import Phaser from 'phaser'
import { strokeGlowPoly, STATION_CAPTURE_RADIUS } from '../utils/geometry'
import { mulberry32 } from '../utils/rng'

export const CORE_R = 34
export const DOCK_RANGE = 120

export default class SpaceStation extends Phaser.GameObjects.Container {
  constructor(scene, spec) {
    super(scene, spec.x, spec.y)
    this.spec = spec
    const rand = mulberry32(spec.visualSeed)

    this.ring = scene.add.graphics()
    this.core = scene.add.graphics()
    this.add([this.ring, this.core])

    // hex core
    const hex = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      hex.push([Math.cos(a) * CORE_R, Math.sin(a) * CORE_R])
    }
    strokeGlowPoly(this.core, hex, 0x7dffd8)
    this.core.fillStyle(0x7dffd8, 0.06)
    this.core.fillPoints(hex.map(([x, y]) => ({ x, y })), true)
    // beacon
    this.core.fillStyle(0xffb35c, 0.9)
    this.core.fillCircle(0, 0, 3.5)

    // rotating ring with spokes
    const ringR = CORE_R + 26 + rand() * 10
    this.ring.lineStyle(5, 0x7dffd8, 0.12)
    this.ring.strokeCircle(0, 0, ringR)
    this.ring.lineStyle(1.4, 0x7dffd8, 0.75)
    this.ring.strokeCircle(0, 0, ringR)
    const spokes = 3 + Math.floor(rand() * 2)
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2
      this.ring.lineStyle(1.2, 0x7dffd8, 0.5)
      this.ring.lineBetween(
        Math.cos(a) * CORE_R,
        Math.sin(a) * CORE_R,
        Math.cos(a) * ringR,
        Math.sin(a) * ringR
      )
    }

    // capture-field boundary: an artificial containment field, so it reads
    // as engineered — segmented emitter arcs, not a planet's continuous
    // atmosphere line. Fixed segment count: zero rand() draws, so existing
    // station visuals (ringR, spokes) stay seeded exactly as before.
    this.field = scene.add.graphics()
    this.addAt(this.field, 0) // beneath ring + core
    const SEGS = 6
    const span = ((Math.PI * 2) / SEGS) * 0.62
    for (let i = 0; i < SEGS; i++) {
      const a0 = (i / SEGS) * Math.PI * 2
      this.field.lineStyle(4, 0x7dffd8, 0.03)
      this.field.beginPath()
      this.field.arc(0, 0, STATION_CAPTURE_RADIUS - 3, a0, a0 + span)
      this.field.strokePath()
      this.field.lineStyle(1, 0x7dffd8, 0.12)
      this.field.beginPath()
      this.field.arc(0, 0, STATION_CAPTURE_RADIUS, a0, a0 + span)
      this.field.strokePath()
    }

    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.body.setCircle(CORE_R, -CORE_R, -CORE_R)
    this.body.setImmovable(true)
    this.body.moves = false
    this.setDepth(-4)

    this.spin = scene.tweens.add({
      targets: this.ring,
      rotation: Math.PI * 2,
      duration: 26000,
      repeat: -1,
    })
    // field counter-rotates against the structure — a projected effect,
    // not a spinning part
    this.fieldSpin = scene.tweens.add({
      targets: this.field,
      rotation: -Math.PI * 2,
      duration: 52000,
      repeat: -1,
    })
  }

  destroy(fromScene) {
    if (this.spin) this.spin.stop()
    if (this.fieldSpin) this.fieldSpin.stop()
    super.destroy(fromScene)
  }
}
