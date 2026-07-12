// A pulsing lore beacon. Proximity trigger (checked in GameScene.update)
// emits 'dialogue-trigger' — the Vue overlay does the talking.
import Phaser from 'phaser'

export default class Anomaly extends Phaser.GameObjects.Container {
  constructor(scene, spec) {
    super(scene, spec.x, spec.y)
    this.spec = spec
    const g = scene.add.graphics()
    g.lineStyle(1.5, 0x9db8ff, 0.9)
    g.strokeCircle(0, 0, 6)
    g.lineStyle(1, 0x9db8ff, 0.4)
    g.strokeCircle(0, 0, 12)
    g.lineBetween(-16, 0, -8, 0)
    g.lineBetween(8, 0, 16, 0)
    g.lineBetween(0, -16, 0, -8)
    g.lineBetween(0, 8, 0, 16)
    this.add(g)
    scene.add.existing(this)
    this.setDepth(-3)
    this.pulse = scene.tweens.add({
      targets: this,
      alpha: { from: 0.35, to: 1 },
      scale: { from: 0.9, to: 1.15 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inout',
    })
  }

  destroy(fromScene) {
    if (this.pulse) this.pulse.stop()
    super.destroy(fromScene)
  }
}
