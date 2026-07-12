import Phaser from 'phaser'
import { strokeGlowPoly, strokeGlowLine } from '../utils/geometry'
import { getShip } from '../data/ships'
import { getShipAccent } from '../data/accents'
import { DEFAULT_STATS } from '../systems/modifiers'
import { playerStore } from '../../stores/playerStore'

const BOOST_DURATION = 800 // ms
const BOOST_COOLDOWN = 3000 // ms after the burst ends
const BODY_RADIUS = 11

// All feel parameters (drag/turnRate/thrust/maxSpeed/boost) come from the
// aggregated mods object — they are upgrade targets, not constants.
export default class Ship extends Phaser.GameObjects.Container {
  constructor(scene, x, y, shipId) {
    super(scene, x, y)
    this.gfx = scene.add.graphics()
    this.flame = scene.add.graphics()
    this.add([this.flame, this.gfx])
    this.setShip(shipId)

    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.body.setCircle(BODY_RADIUS, -BODY_RADIUS, -BODY_RADIUS)
    this.body.setDamping(true)
    this.body.setBounce(0.5, 0.5) // carom off rocks; cargo mass sets inertia

    this.boostUntil = 0
    this.boostReadyAt = 0
    this.invulnUntil = 0
    this.thrusting = false
    this.massFactor = 1 // heavy cargo lowers top speed (set by GameScene)
    this.setMods(DEFAULT_STATS)
    this.hull = this.maxHull
  }

  setMods(mods) {
    this.mods = mods
    this.body.setDrag(mods.drag)
    this.maxHull = mods.hullMax
    if (this.hull > this.maxHull) this.hull = this.maxHull
  }

  get inReserve() {
    return playerStore.fuel <= 0.05
  }

  // Returns true when the hit destroys the ship.
  damage(now) {
    this.hull -= 1
    if (this.hull <= 0) return true
    this.invulnUntil = now + 1500
    return false
  }

  setShip(shipId) {
    this.def = getShip(shipId)
    this.accentInt = getShipAccent(shipId).int
    this.gfx.clear()
    strokeGlowPoly(this.gfx, this.def.verts, this.accentInt)
    for (const [[x1, y1], [x2, y2]] of this.def.extraLines) {
      strokeGlowLine(this.gfx, x1, y1, x2, y2, this.accentInt)
    }
  }

  get isBoosting() {
    return this.scene.time.now < this.boostUntil
  }

  // Boost is FUEL-GATED: caller (GameScene) checks and debits the fuel.
  tryBoost(now) {
    if (now < this.boostReadyAt || !this.active || this.inReserve) return false
    this.boostUntil = now + BOOST_DURATION
    this.boostReadyAt = now + BOOST_DURATION + BOOST_COOLDOWN
    return true
  }

  steer(input, time, delta) {
    if (!this.active) return
    const dt = delta / 1000
    const m = this.mods

    if (input.targetHeading !== null) {
      this.rotation = Phaser.Math.Angle.RotateTo(
        this.rotation,
        input.targetHeading,
        m.turnRate * dt
      )
    } else if (input.turn !== 0) {
      this.rotation += input.turn * m.turnRate * dt
    }

    // reserve mode: out of fuel — limp, don't strand (half speed, no boost).
    // Heavy cargo drags the top speed down too (massFactor from GameScene).
    const reserve = this.inReserve
    const boosting = this.isBoosting && !reserve
    let maxSpeed = boosting ? m.boostMaxSpeed : reserve ? m.maxSpeed * 0.5 : m.maxSpeed
    maxSpeed *= this.massFactor
    this.body.setMaxSpeed(maxSpeed)

    let thrust = input.thrust
    if (boosting) thrust = m.boostMult
    this.thrusting = thrust > 0.01
    if (this.thrusting) {
      this.body.velocity.x += Math.cos(this.rotation) * m.thrust * thrust * dt
      this.body.velocity.y += Math.sin(this.rotation) * m.thrust * thrust * dt
    }

    this.drawFlame(time, boosting)

    // invulnerability blink after respawn
    if (time < this.invulnUntil) {
      this.alpha = Math.floor(time / 90) % 2 === 0 ? 0.25 : 0.9
    } else if (this.alpha !== 1) {
      this.alpha = 1
    }
  }

  drawFlame(time, boosting) {
    this.flame.clear()
    if (!this.thrusting) return
    const flicker = 0.7 + 0.3 * Math.sin(time * 0.045)
    const len = (boosting ? 22 : 13) * flicker
    // boost burn stays warn amber; normal exhaust matches the hull accent
    const color = boosting ? 0xffb35c : this.accentInt
    const back = Math.min(...this.def.verts.map(([x]) => x)) - 1
    this.flame.lineStyle(5, color, 0.15)
    this.flame.strokePoints(
      [{ x: back, y: -4 }, { x: back - len, y: 0 }, { x: back, y: 4 }],
      false,
      false
    )
    this.flame.lineStyle(1.5, color, 0.85)
    this.flame.strokePoints(
      [{ x: back, y: -4 }, { x: back - len, y: 0 }, { x: back, y: 4 }],
      false,
      false
    )
  }

  get noseX() {
    return this.x + Math.cos(this.rotation) * 16
  }

  get noseY() {
    return this.y + Math.sin(this.rotation) * 16
  }

  get isInvulnerable() {
    return this.scene.time.now < this.invulnUntil
  }

  explode() {
    this.setActive(false).setVisible(false)
    this.body.stop()
    this.body.enable = false
  }

  respawn(x, y, now) {
    this.setPosition(x, y)
    this.rotation = -Math.PI / 2
    this.body.stop()
    this.body.enable = true
    this.setActive(true).setVisible(true)
    this.invulnUntil = now + 2000
    this.boostUntil = 0
    this.hull = this.maxHull
  }
}
