// Pooled enemy with a small FSM: idle → pursue → attack → evade (+ flee).
// Deliberately simple (handoff §11): open space needs no pathfinding —
// "steering" is accelerate toward/away from a point. Coordination comes from
// the GroupCoordinator's attack token + surround angles, not per-enemy smarts.
import Phaser from 'phaser'
import { strokeGlowPoly } from '../utils/geometry'
import { ENEMY_ROLES } from '../data/enemies'

const BODY_R = 10

export default class Enemy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, role, params) {
    super(scene, x, y)
    this.gfx = scene.add.graphics()
    this.add(this.gfx)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.body.setCircle(BODY_R, -BODY_R, -BODY_R)
    this.configure(x, y, role, params)
  }

  configure(x, y, role, params) {
    this.role = role
    this.p = params
    this.hp = params.hp
    this.state = 'idle'
    this.stateUntil = 0
    this.hasToken = false
    this.surroundAngle = 0
    this.specIdx = -1
    this.pursuitDepth = 0 // cross-panel chase counter (pooled reuse must reset)
    this.homeKey = null // pursuers remember home: "px,py" + spec index there
    this.homeIdx = -1
    this.burstLeft = 0
    this.nextShotAt = 0
    this.setRotation(0)

    const def = ENEMY_ROLES[role]
    this.gfx.clear()
    strokeGlowPoly(this.gfx, def.verts, def.color)

    this.body.reset(x, y)
    this.body.enable = true
    this.body.setVelocity(0, 0)
    this.body.setMaxSpeed(params.maxSpeed)
    this.body.setMass(0.5)
    this.body.setBounce(0.6, 0.6)
    this.setActive(true).setVisible(true)
  }

  static obtain(scene, x, y, role, params) {
    if (!scene.enemyPool) scene.enemyPool = []
    const pooled = scene.enemyPool.pop()
    if (pooled) {
      pooled.configure(x, y, role, params)
      return pooled
    }
    return new Enemy(scene, x, y, role, params)
  }

  release() {
    this.body.stop()
    this.body.enable = false
    this.setActive(false).setVisible(false)
    if (this.scene) {
      this.scene.enemies.remove(this)
      this.scene.coordinator?.remove(this)
      this.scene.enemyPool.push(this)
    }
  }

  hit() {
    this.hp -= 1
    if (this.hp <= 0) return true
    // low health + low courage → run
    if (this.hp === 1 && this.p.courage < 0.5) this.enter('flee', 3000)
    return false
  }

  enter(state, durationMs = 0) {
    this.state = state
    this.stateUntil = durationMs ? this.scene.time.now + durationMs : 0
  }

  // Hazard awareness: a steering vector away from things that can destroy us
  // (predictive collision-course check for rocks; kill radii for wells).
  // Pure vector math — no pathfinding (handoff §11).
  avoidanceAccel() {
    let ax = 0
    let ay = 0
    let urgency = 0
    const myV = this.body.velocity

    // rocks: predictive time-to-closest-approach
    for (const rock of this.scene.asteroids.getChildren()) {
      if (!rock.active) continue
      const rx = rock.x - this.x
      const ry = rock.y - this.y
      const dist = Math.hypot(rx, ry)
      const reach = 260 + rock.radius
      if (dist > reach) continue

      // short-range shoulder-off for anything already close
      if (dist < rock.radius + 44) {
        const wgt = 1 - dist / (rock.radius + 44)
        ax -= (rx / dist) * wgt
        ay -= (ry / dist) * wgt
        urgency = Math.max(urgency, wgt)
      }

      const rvx = rock.body.velocity.x - myV.x
      const rvy = rock.body.velocity.y - myV.y
      const closing = rx * rvx + ry * rvy
      if (closing >= 0) continue // not approaching
      const relSq = rvx * rvx + rvy * rvy
      if (relSq < 1) continue
      const tau = -closing / relSq // seconds to closest approach
      if (tau > 1.6) continue
      const missX = rx + rvx * tau
      const missY = ry + rvy * tau
      const miss = Math.hypot(missX, missY)
      if (miss > rock.radius + 28) continue
      // steer away from the predicted closest point; big rocks scarier
      const wgt = (1 - tau / 1.6) * Math.min(1.6, rock.radius / 30)
      const m = miss || 1
      ax -= (missX / m) * wgt
      ay -= (missY / m) * wgt
      urgency = Math.max(urgency, Math.min(1, wgt))
    }

    // gravity wells: stars and black holes both eat us
    for (const s of this.scene.gravitySources || []) {
      if (!s.killRadius) continue
      const dx = this.x - s.x
      const dy = this.y - s.y
      const dist = Math.hypot(dx, dy) || 1
      const danger = s.killRadius * 3 + 90
      if (dist > danger) continue
      const wgt = 1 - (dist - s.killRadius) / (danger - s.killRadius)
      // radially out + tangential component: escape by orbit-raising
      ax += ((dx / dist) * 0.8 + (-dy / dist) * 0.45) * wgt * 1.6
      ay += ((dy / dist) * 0.8 + (dx / dist) * 0.45) * wgt * 1.6
      urgency = Math.max(urgency, Math.min(1, wgt * 1.4))
    }

    // planet surface: don't wall-hug
    const planet = this.scene.planet
    if (planet) {
      const dx = this.x - planet.x
      const dy = this.y - planet.y
      const dist = Math.hypot(dx, dy) || 1
      const margin = planet.spec.radius + 60
      if (dist < margin) {
        const wgt = (1 - dist / margin) * 0.8
        ax += (dx / dist) * wgt
        ay += (dy / dist) * wgt
        urgency = Math.max(urgency, wgt)
      }
    }

    const len = Math.hypot(ax, ay)
    if (len > 1) {
      ax /= len
      ay /= len
    }
    return { ax, ay, urgency }
  }

  // apply hazard steering on top of (or overriding) the state's own seek
  applyAvoidance(avoid, dt) {
    const strength = (this.p.evasion ?? 0.7) * this.p.accel
    this.body.velocity.x += avoid.ax * strength * dt
    this.body.velocity.y += avoid.ay * strength * dt
  }

  update(time, delta) {
    if (!this.active) return
    const dt = delta / 1000
    const ship = this.scene.ship
    const shipAlive = ship && ship.active
    const dx = shipAlive ? ship.x - this.x : 0
    const dy = shipAlive ? ship.y - this.y : 0
    const dist = shipAlive ? Math.hypot(dx, dy) : Infinity
    const angToShip = Math.atan2(dy, dx)

    // hazard sense: when danger is imminent, dodging outranks the hunt
    // (this frame only — aggression resumes immediately)
    const avoid = this.avoidanceAccel()
    this.seekScale = avoid.urgency * (this.p.evasion ?? 0.7) > 0.45 ? 0.25 : 1

    switch (this.state) {
      case 'idle':
        this.body.velocity.scale(0.98)
        if (dist < this.p.aggroRange) this.enter('pursue')
        break

      case 'pursue': {
        if (!shipAlive || dist > this.p.aggroRange * 1.6) {
          this.enter('idle')
          break
        }
        // token holder presses in; others hold a surround slot around the ship
        let tx
        let ty
        if (this.hasToken || dist > this.p.aggroRange) {
          tx = ship.x - Math.cos(angToShip) * this.p.preferredRange * 0.6
          ty = ship.y - Math.sin(angToShip) * this.p.preferredRange * 0.6
        } else {
          tx = ship.x + Math.cos(this.surroundAngle) * this.p.preferredRange
          ty = ship.y + Math.sin(this.surroundAngle) * this.p.preferredRange
        }
        this.accelToward(tx, ty, dt)
        this.faceToward(angToShip, dt)
        if (this.hasToken && dist < this.p.fireRange) {
          this.burstLeft = this.p.burstShots
          this.enter('attack')
        }
        break
      }

      case 'attack': {
        if (!shipAlive) {
          this.enter('idle')
          break
        }
        this.faceToward(angToShip, dt)
        this.body.velocity.scale(0.985)
        if (this.burstLeft > 0 && time > this.nextShotAt) {
          this.scene.enemyFire(this, angToShip)
          this.burstLeft -= 1
          this.nextShotAt = time + this.p.fireInterval
        }
        if (this.burstLeft <= 0) this.enter('evade', 900)
        break
      }

      case 'evade': {
        const side = this.surroundAngle > 0 ? 1 : -1
        const evadeAng = angToShip + (Math.PI / 2) * side
        this.body.velocity.x += Math.cos(evadeAng) * this.p.accel * this.seekScale * dt
        this.body.velocity.y += Math.sin(evadeAng) * this.p.accel * this.seekScale * dt
        this.faceToward(angToShip, dt)
        if (time > this.stateUntil) this.enter('pursue')
        break
      }

      case 'flee': {
        const away = angToShip + Math.PI
        this.body.velocity.x += Math.cos(away) * this.p.accel * this.seekScale * dt
        this.body.velocity.y += Math.sin(away) * this.p.accel * this.seekScale * dt
        this.faceToward(away, dt)
        if (time > this.stateUntil) this.enter('idle')
        break
      }
    }

    // evasive thrust applies in every state — they dodge AND keep shooting
    this.applyAvoidance(avoid, dt)

    // wrap within the panel like asteroids
    const w = this.scene.scale.width
    const h = this.scene.scale.height
    if (this.x < -20) this.x += w + 40
    else if (this.x > w + 20) this.x -= w + 40
    if (this.y < -20) this.y += h + 40
    else if (this.y > h + 20) this.y -= h + 40
  }

  accelToward(tx, ty, dt) {
    const ang = Math.atan2(ty - this.y, tx - this.x)
    const a = this.p.accel * (this.seekScale ?? 1)
    this.body.velocity.x += Math.cos(ang) * a * dt
    this.body.velocity.y += Math.sin(ang) * a * dt
  }

  faceToward(target, dt) {
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, target, this.p.turnRate * dt)
  }
}
