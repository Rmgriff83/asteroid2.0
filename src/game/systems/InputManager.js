// Normalizes keyboard and touch into one control struct consumed by GameScene:
//   { targetHeading, turn, thrust, shootHeld, boostPressed }
// Touch state arrives via EventBus events emitted by UIScene.
import Phaser from 'phaser'
import { EventBus } from '../EventBus'

export default class InputManager {
  constructor(scene) {
    this.scene = scene
    this.keys = scene.input.keyboard.addKeys({
      up: 'UP', left: 'LEFT', right: 'RIGHT',
      w: 'W', a: 'A', d: 'D',
      space: 'SPACE', shift: 'SHIFT',
    })

    this.joy = { active: false, heading: 0 }
    this.touchShoot = false
    this.touchThrust = false
    this.boostQueued = false

    this.onJoy = (state) => { this.joy = state }
    this.onShoot = (down) => { this.touchShoot = down }
    this.onThrust = (down) => { this.touchThrust = down }
    this.onBoost = () => { this.boostQueued = true }
    EventBus.on('touch-joystick', this.onJoy)
    EventBus.on('touch-shoot', this.onShoot)
    EventBus.on('touch-thrust', this.onThrust)
    EventBus.on('touch-boost', this.onBoost)

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  getState() {
    const k = this.keys
    let turn = 0
    if (k.left.isDown || k.a.isDown) turn -= 1
    if (k.right.isDown || k.d.isDown) turn += 1
    const keyThrust = k.up.isDown || k.w.isDown ? 1 : 0

    const boostPressed = Phaser.Input.Keyboard.JustDown(k.shift) || this.boostQueued
    this.boostQueued = false

    // joystick aims; THRUST button (or keyboard) provides acceleration
    return {
      targetHeading: this.joy.active ? this.joy.heading : null,
      turn: this.joy.active ? 0 : turn,
      thrust: this.touchThrust || keyThrust ? 1 : 0,
      shootHeld: this.touchShoot || k.space.isDown,
      boostPressed,
    }
  }

  destroy() {
    EventBus.off('touch-joystick', this.onJoy)
    EventBus.off('touch-shoot', this.onShoot)
    EventBus.off('touch-thrust', this.onThrust)
    EventBus.off('touch-boost', this.onBoost)
  }
}
