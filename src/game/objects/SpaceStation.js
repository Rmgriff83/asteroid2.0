// Authored-feel waystation: hex core + spokes + slow-rotating outer ring.
// Docking (proximity + low speed) is detected in GameScene.
import Phaser from 'phaser'
import { strokeGlowPoly } from '../utils/geometry'
import { mulberry32 } from '../utils/rng'

const CORE_R = 34
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
  }

  destroy(fromScene) {
    if (this.spin) this.spin.stop()
    super.destroy(fromScene)
  }
}
