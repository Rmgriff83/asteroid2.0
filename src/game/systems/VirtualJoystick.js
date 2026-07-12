// Floating analog stick: touching anywhere in the left 45% of the screen
// anchors the base ring there; dragging sets heading + magnitude.
import { EventBus } from '../EventBus'

const MAX_R = 70
const DEAD_ZONE = 0.15
const RING_COLOR = 0xeaf6ff

export default class VirtualJoystick {
  constructor(scene) {
    this.scene = scene
    this.pointerId = null
    this.baseX = 0
    this.baseY = 0
    this.gfx = scene.add.graphics().setDepth(50)

    scene.input.on('pointerdown', this.onDown, this)
    scene.input.on('pointermove', this.onMove, this)
    scene.input.on('pointerup', this.onUp, this)
    scene.events.once('shutdown', () => this.destroy())
  }

  onDown(pointer) {
    if (this.pointerId !== null) return
    if (pointer.x > this.scene.scale.width * 0.45) return
    this.pointerId = pointer.id
    this.baseX = pointer.x
    this.baseY = pointer.y
    this.emit(pointer)
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return
    this.emit(pointer)
  }

  onUp(pointer) {
    if (pointer.id !== this.pointerId) return
    this.reset()
  }

  reset() {
    this.pointerId = null
    this.gfx.clear()
    EventBus.emit('touch-joystick', { active: false, heading: 0 })
  }

  // FACING ONLY — a steering wheel, not a gas pedal (handoff §10 [SETTLED]).
  // The stick aims the ship; THRUST is a button on the right cluster.
  emit(pointer) {
    const dx = pointer.x - this.baseX
    const dy = pointer.y - this.baseY
    const dist = Math.hypot(dx, dy)
    const heading = Math.atan2(dy, dx)
    const active = dist / MAX_R >= DEAD_ZONE

    EventBus.emit('touch-joystick', { active, heading })
    this.draw(dx, dy, dist)
  }

  draw(dx, dy, dist) {
    const clamped = Math.min(dist, MAX_R)
    const ang = Math.atan2(dy, dx)
    const tx = this.baseX + Math.cos(ang) * clamped
    const ty = this.baseY + Math.sin(ang) * clamped
    this.gfx.clear()
    this.gfx.lineStyle(2, RING_COLOR, 0.25)
    this.gfx.strokeCircle(this.baseX, this.baseY, MAX_R)
    this.gfx.lineStyle(2, RING_COLOR, 0.6)
    this.gfx.strokeCircle(tx, ty, 26)
    this.gfx.fillStyle(RING_COLOR, 0.12)
    this.gfx.fillCircle(tx, ty, 26)
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this)
    this.scene.input.off('pointermove', this.onMove, this)
    this.scene.input.off('pointerup', this.onUp, this)
    this.gfx.destroy()
  }
}
