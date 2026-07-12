import Phaser from 'phaser'

// Pooled projectile. Uses the 'bullet' texture generated in BootScene.
// Bullets never cross panel edges — they die at the screen bounds.
// NOTE: pooled groups construct via `new classType(scene, x, y, key, frame)` —
// never accept the texture positionally here or group.get() will pass the
// x-coordinate as the texture key (renders the missing-texture green box).
export default class Bullet extends Phaser.Physics.Arcade.Image {
  constructor(scene) {
    super(scene, 0, 0, 'bullet')
    this.expiry = 0
  }

  fire(x, y, angle, speed, lifeSeconds) {
    this.enableBody(true, x, y, true, true)
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    this.setRotation(angle)
    this.expiry = this.scene.time.now + lifeSeconds * 1000
  }

  kill() {
    this.disableBody(true, true)
  }

  update(time) {
    if (!this.active) return
    const w = this.scene.scale.width
    const h = this.scene.scale.height
    if (time > this.expiry || this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
      this.kill()
    }
  }
}
