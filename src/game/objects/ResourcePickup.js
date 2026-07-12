// Pooled resource drop: magnet-drifts to the ship when close, scooped on
// overlap (handled in GameScene), fades out at TTL.
import Phaser from 'phaser'
import { RESOURCES } from '../data/resources'

const TTL_MS = 12000
const MAGNET_RANGE = 110
const MAGNET_ACCEL = 480

export default class ResourcePickup extends Phaser.Physics.Arcade.Image {
  constructor(scene) {
    super(scene, 0, 0, 'pickup')
    this.resourceType = 'ferrite'
    this.units = 1 // one pickup = one "chunk" carrying several units
    this.expiry = 0
  }

  drop(x, y, type, units = 1) {
    this.resourceType = type
    this.units = units
    this.enableBody(true, x, y, true, true)
    this.setScale(Math.min(1.6, 0.9 + units / 40)) // bigger chunks read bigger
    this.setTint(RESOURCES[type]?.color ?? 0xffffff)
    this.setAlpha(1)
    const ang = Math.random() * Math.PI * 2
    const speed = 30 + Math.random() * 60
    this.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed)
    this.setDamping(true)
    this.setDrag(0.5)
    this.expiry = this.scene.time.now + TTL_MS
  }

  kill() {
    this.disableBody(true, true)
  }

  update(time, delta) {
    if (!this.active) return
    if (time > this.expiry) {
      this.kill()
      return
    }
    if (time > this.expiry - 2000) {
      this.setAlpha(Math.floor(time / 120) % 2 === 0 ? 0.3 : 0.9)
    }
    const ship = this.scene.ship
    if (ship?.active) {
      const dx = ship.x - this.x
      const dy = ship.y - this.y
      const dist = Math.hypot(dx, dy)
      if (dist < MAGNET_RANGE && dist > 1) {
        const dt = delta / 1000
        this.body.velocity.x += (dx / dist) * MAGNET_ACCEL * dt
        this.body.velocity.y += (dy / dist) * MAGNET_ACCEL * dt
      }
    }
  }
}
