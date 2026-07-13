import Phaser from 'phaser'
import Ship from '../objects/Ship'
import Asteroid from '../objects/Asteroid'
import Bullet from '../objects/Bullet'
import EnemyBullet from '../objects/EnemyBullet'
import Enemy from '../objects/Enemy'
import ResourcePickup from '../objects/ResourcePickup'
import Planet from '../objects/Planet'
import { DOCK_RANGE, CORE_R } from '../objects/SpaceStation'
import GroupCoordinator from '../systems/GroupCoordinator'
import { currencyService } from '../../services/currencyService'
import { sfx } from '../../services/sfx'
import { ITEMS } from '../data/resources'
import { resolveElastic } from '../systems/collide'
import PanelManager from '../systems/PanelManager'
import InputManager from '../systems/InputManager'
import { getModifiers } from '../systems/modifiers'
import { EventBus } from '../EventBus'
import { playerStore } from '../../stores/playerStore'
import { getShipAccent } from '../data/accents'
import { generatePanel, panelKey } from '../galaxy/panelGen'
import { getAuthored } from '../galaxy/authored'
import { motion } from '../../services/motion'
import { establishBase, canAffordBase } from '../systems/bases'
import {
  planetCaptureRadius,
  starCaptureRadius,
  STATION_CAPTURE_RADIUS,
  STATION_FIELD_MU,
  STATION_ORBIT_VMAX,
  STATION_FIELD_INNER,
} from '../utils/geometry'
import { ASTEROID_TIERS } from '../galaxy/constants'
import { spawnPanel } from '../systems/PanelSpawner'
import {
  worldState,
  getDiff,
  writeDiff,
  markVisited,
  evictIfNeeded,
} from '../systems/WorldDiffs'

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game')
  }

  create() {
    this.mods = getModifiers(playerStore.perks)
    this.galaxySeed = worldState.galaxySeed
    this.panels = new PanelManager(playerStore.currentPanel.px, playerStore.currentPanel.py)

    const w = this.scale.width
    const h = this.scale.height
    this.ship = new Ship(this, w / 2, h / 2, playerStore.selectedShip)

    this.asteroidPool = []
    this.asteroids = this.add.group({ runChildUpdate: true })
    this.enemyPool = []
    this.enemies = this.add.group({ runChildUpdate: true })
    this.coordinator = new GroupCoordinator()
    this.obstacles = this.add.group()
    this.planet = null
    this.well = null
    this.station = null
    this.anomaly = null
    this.starfield = null
    this.dockAvailable = false
    this.landAvailable = null // { available, hasBase, canAfford }
    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 48,
      runChildUpdate: true,
    })
    this.enemyBullets = this.physics.add.group({
      classType: EnemyBullet,
      maxSize: 32,
      runChildUpdate: true,
    })
    this.pickups = this.physics.add.group({
      classType: ResourcePickup,
      maxSize: 40,
      runChildUpdate: true,
    })

    this.debris = this.add.particles(0, 0, 'dot', {
      speed: { min: 30, max: 140 },
      lifespan: { min: 250, max: 600 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    })

    this.thrustTrail = this.add.particles(0, 0, 'dot', {
      speed: { min: 8, max: 36 },
      lifespan: { min: 180, max: 420 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.45, end: 0 },
      tint: getShipAccent(playerStore.selectedShip).int,
      emitting: false,
    })
    this.nextPuffAt = 0

    this.physics.add.overlap(this.bullets, this.asteroids, this.onBulletHit, undefined, this)
    // physical rock world: manual impulse resolution (momentum-conserving,
    // mass-weighted — Arcade's own circle response is inelastic for containers)
    this.physics.add.overlap(this.asteroids, this.asteroids, (a, b) => resolveElastic(a, b, 0.95))
    this.physics.add.overlap(this.asteroids, this.obstacles, (a, b) => resolveElastic(a, b, 0.7))
    this.physics.add.overlap(this.asteroids, this.enemies, this.onRockHitsEnemy, undefined, this)
    // ship BOUNCES off rocks (cargo mass = inertia) while still taking the hit
    this.physics.add.overlap(this.ship, this.asteroids, this.onShipHit, undefined, this)
    this.physics.add.collider(this.ship, this.obstacles)
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitEnemy, undefined, this)
    this.physics.add.overlap(this.enemyBullets, this.ship, this.onEnemyBulletHitShip, undefined, this)
    this.physics.add.overlap(this.ship, this.enemies, this.onShipRamEnemy, undefined, this)
    this.physics.add.overlap(this.ship, this.pickups, this.onScoop, undefined, this)
    this.physics.add.overlap(this.bullets, this.obstacles, this.onBulletHitObstacle, undefined, this)

    this.inputMgr = new InputManager(this)
    this.nextFireAt = 0
    this.bgTween = null

    this.spawnFromSpec()
    this.scene.launch('UI')

    this.ship.setMods(this.mods)

    this.onPerksUpdated = () => {
      this.mods = getModifiers(playerStore.perks)
      this.ship.setMods(this.mods)
    }
    this.onShipChanged = (id) => {
      this.ship.setShip(id)
      this.thrustTrail.particleTint = getShipAccent(id).int
    }
    this.onTeleport = ({ px, py }) => this.teleport(px, py)
    this.onDock = () => this.dock()
    this.onLand = () => this.land()
    this.onEstablishBase = () => this.tryEstablishBase()
    // consumables used from the cargo terminal
    this.onConsume = ({ type }) => {
      const use = ITEMS[type]?.use
      if (!use) return
      if (use.fuel) playerStore.fuel = Math.min(this.mods.fuelMax, playerStore.fuel + use.fuel)
      if (use.hull) this.ship.hull = Math.min(this.ship.maxHull, this.ship.hull + use.hull)
      if (use.boostReset) this.ship.boostReadyAt = 0
      playerStore.save()
    }
    this.onJettison = ({ type, units }) => {
      // scatter the stack behind the ship as re-scoopable chunks
      let remaining = units
      for (let i = 0; i < 5 && remaining > 0; i++) {
        const chunk = i === 4 ? remaining : Math.ceil(units / 5)
        remaining -= chunk
        if (chunk <= 0) break
        const p = this.pickups.get()
        if (!p) break
        const ang = this.ship.rotation + Math.PI + (Math.random() - 0.5)
        p.drop(
          this.ship.x + Math.cos(ang) * (40 + i * 22),
          this.ship.y + Math.sin(ang) * (40 + i * 22),
          type,
          chunk
        )
      }
    }
    this.onUndock = () => {
      playerStore.screen = 'game'
      EventBus.emit('resume-game')
    }
    EventBus.on('perks-updated', this.onPerksUpdated)
    EventBus.on('ship-changed', this.onShipChanged)
    EventBus.on('debug-teleport', this.onTeleport)
    EventBus.on('dock', this.onDock)
    EventBus.on('land', this.onLand)
    EventBus.on('establish-base', this.onEstablishBase)
    EventBus.on('undock', this.onUndock)
    EventBus.on('consume-item', this.onConsume)
    EventBus.on('jettison', this.onJettison)
    // keep the current panel's diff fresh while paused (the cockpit canopy
    // renders the panel from the diff — it should match what you just did)
    this.onPauseSync = () => {
      if (this.scene.isActive() || this.scene.isPaused()) {
        this.departPanel()
        playerStore.shipPose = { x: this.ship.x, y: this.ship.y, rot: this.ship.rotation }
      }
    }
    EventBus.on('pause-game', this.onPauseSync)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('perks-updated', this.onPerksUpdated)
      EventBus.off('ship-changed', this.onShipChanged)
      EventBus.off('debug-teleport', this.onTeleport)
      EventBus.off('dock', this.onDock)
      EventBus.off('land', this.onLand)
      EventBus.off('establish-base', this.onEstablishBase)
      EventBus.off('undock', this.onUndock)
      EventBus.off('consume-item', this.onConsume)
      EventBus.off('jettison', this.onJettison)
      EventBus.off('pause-game', this.onPauseSync)
    })
  }

  // Docking gets the same dive-in treatment as landing: the ship shrinks
  // into the hex core, then the station screen opens directly (no cutscene
  // between). Shares the landingSeq flag so input freezes and dock/land
  // can't overlap.
  dock() {
    if (!this.dockAvailable || !this.station || this.landingSeq) return
    const id = this.station.spec.id
    if (!playerStore.unlockedNodes.includes(id)) {
      playerStore.unlockedNodes.push(id) // fast-travel node earned
      playerStore.save()
    }
    const payload = {
      id,
      name: this.station.spec.name,
      px: this.panels.px,
      py: this.panels.py,
    }
    const finish = () => {
      // park just outside dock range with transforms restored (undock
      // resumes clean — no collider overlap, no instant re-prompt), facing
      // the panel center so the station window's camera looks out at the
      // panel rather than at a wall
      this.ship.setPosition(this.station.x, this.station.y - (DOCK_RANGE + 30))
      this.ship.setScale(1).setAlpha(1)
      this.ship.body.stop()
      this.ship.rotation = Math.atan2(
        this.scale.height / 2 - this.ship.y,
        this.scale.width / 2 - this.ship.x
      )
      this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 800)
      this.landingSeq = false
      playerStore.dockedStation = payload
      playerStore.screen = 'station'
      sfx.dock()
      EventBus.emit('pause-game')
    }
    if (motion.reduced) return finish()
    this.landingSeq = true
    this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 1800)
    this.tweens.add({
      targets: this.ship,
      x: this.station.x,
      y: this.station.y,
      scale: 0.15,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: finish,
    })
  }

  currentSpec() {
    return generatePanel(this.galaxySeed, this.panels.px, this.panels.py, getAuthored())
  }

  // Write the departing panel's diff: destroyed original indices + serialized
  // live fragments (split survivors). Pristine originals regenerate from seed.
  departPanel() {
    const key = panelKey(this.panels.px, this.panels.py)
    const fragments = this.asteroids
      .getChildren()
      .filter((a) => a.active && a.specIdx === -1)
      .map((a) => a.serialize())
    writeDiff(key, {
      visited: true,
      asteroidsDestroyed: [...this.panelDestroyed],
      fragments,
      enemiesKilled: [...this.panelKilled],
      resourcesDepleted: [...this.panelDepleted],
    })
  }

  // Regenerate from seed, then subtract the diff.
  enterPanel() {
    const { px, py } = this.panels
    const diff = getDiff(panelKey(px, py))
    const spec = this.currentSpec()
    this.panelSpec = spec
    spawnPanel(this, spec, diff)
    this.panelDestroyed = new Set(diff?.asteroidsDestroyed || [])
    this.panelKilled = new Set(diff?.enemiesKilled || [])
    this.panelDepleted = new Set(diff?.resourcesDepleted || [])
    this.buildGravitySources()
    markVisited(px, py)
    evictIfNeeded(px, py)
    playerStore.currentPanel = { px, py }
    playerStore.save()
    EventBus.emit('panel-entered', {
      px,
      py,
      sector: spec.sector,
    })
  }

  spawnFromSpec() {
    this.panelDestroyed = new Set()
    this.enterPanel()
    this.currentBg = this.panelSpec.bgColor
    this.cameras.main.setBackgroundColor(this.currentBg)
  }

  teleport(px, py) {
    this.departPanel()
    this.panels.px = px
    this.panels.py = py
    for (const b of this.bullets.getChildren()) if (b.active) b.kill()
    this.clearPanelObjects()
    this.enterPanel()
    this.ship.setPosition(this.scale.width / 2, this.scale.height / 2)
    this.ship.body.stop()
    this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 800)
    this.tweenBgTo(this.panelSpec.bgColor)
  }

  update(time, delta) {
    // the landing dive owns the ship — controls go dark until touchdown
    const input = this.landingSeq
      ? { targetHeading: null, turn: 0, thrust: 0, shootHeld: false, boostPressed: false }
      : this.inputMgr.getState()
    this.ship.steer(input, time, delta)

    if (this.ship.active && this.ship.thrusting && time > this.nextPuffAt) {
      this.thrustTrail.emitParticleAt(
        this.ship.x - Math.cos(this.ship.rotation) * 14,
        this.ship.y - Math.sin(this.ship.rotation) * 14
      )
      this.nextPuffAt = time + (this.ship.isBoosting ? 18 : 40)
    }

    if (input.boostPressed && playerStore.fuel >= 1.5 && this.ship.tryBoost(time)) {
      playerStore.fuel -= 1.5 // boost is fuel-gated
      playerStore.save()
      sfx.boost()
      EventBus.emit('boost-fired', { readyAt: this.ship.boostReadyAt, start: time })
    }

    if (input.shootHeld && this.ship.active && time > this.nextFireAt) {
      const b = this.bullets.get()
      if (b) {
        b.fire(this.ship.noseX, this.ship.noseY, this.ship.rotation, this.mods.bulletSpeed, this.mods.bulletLife)
        this.nextFireAt = time + 1000 / this.mods.fireRate
        sfx.shoot()
      }
    }

    this.applyGravity(delta)
    this.enforceOrbitFields(delta)
    this.coordinator.update(time)

    // heavy hold drags top speed: no penalty below 60% mass, −35% at full.
    // Cargo also IS inertial mass — a loaded ship plows through impacts.
    const cargoMass = playerStore.cargoMass()
    const massRatio = cargoMass / this.mods.massMax
    this.ship.massFactor =
      massRatio > 1 ? 0.5 : 1 - 0.35 * Math.min(1, Math.max(0, (massRatio - 0.6) / 0.4))
    this.ship.body.mass = 1 + cargoMass / 150

    // solar trickle: reserve mode always crawls back toward 3 fuel
    if (playerStore.fuel < 3) {
      playerStore.fuel = Math.min(3, playerStore.fuel + delta / 60000)
    }

    this.updateDocking()

    // lore beacon proximity
    if (this.anomaly && this.ship.active) {
      const dist = Math.hypot(this.ship.x - this.anomaly.x, this.ship.y - this.anomaly.y)
      if (dist < 90) {
        const id = this.anomaly.spec.dialogueId
        this.anomaly.destroy()
        this.anomaly = null
        EventBus.emit('dialogue-trigger', id)
      }
    }

    if (this.ship.active) this.checkPanelCrossing()
  }

  updateDocking() {
    let available = false
    if (this.station && this.ship.active) {
      const dist = Math.hypot(this.ship.x - this.station.x, this.ship.y - this.station.y)
      const speed = Math.hypot(this.ship.body.velocity.x, this.ship.body.velocity.y)
      available = dist < DOCK_RANGE && speed < 80
    }
    if (available !== this.dockAvailable) {
      this.dockAvailable = available
      EventBus.emit('dock-available', available)
    }

    let landable = false
    if (this.planet?.spec.baseSite && this.ship.active) {
      const dist = Math.hypot(this.ship.x - this.planet.x, this.ship.y - this.planet.y)
      const speed = Math.hypot(this.ship.body.velocity.x, this.ship.body.velocity.y)
      // captured in the planet's ring = close enough to land (orbit speeds
      // at capture range run ~60–90, hence the higher threshold)
      landable = dist < planetCaptureRadius(this.planet.spec.radius) && speed < 110
    }
    // the UI's one action slot needs the full picture: an unbuilt site offers
    // ESTABLISH (affordability can change while parked — mining drops cargo
    // in), a built one offers LAND
    const landState = {
      available: landable,
      hasBase: !!this.planet?.spec.hasBase,
      canAfford: canAffordBase(),
    }
    const prev = this.landAvailable
    if (
      !prev ||
      prev.available !== landState.available ||
      prev.hasBase !== landState.hasBase ||
      prev.canAfford !== landState.canAfford
    ) {
      this.landAvailable = landState
      EventBus.emit('land-available', landState)
    }
  }

  // the base mines the planet's dominant node type, falling back to the
  // sector's dominant resource (shared by ESTABLISH and the landing payload)
  dominantResourceType() {
    const dominantNode = this.planet?.spec.nodes[0]?.type
    const dominantSector = Object.entries(this.panelSpec.sector.resourceWeights).sort(
      (a, b) => b[1] - a[1]
    )[0][0]
    return dominantNode || dominantSector
  }

  // the in-flight purchase: spend the cargo cost, plant the base, and let the
  // dome pop onto the planet from orbit — the action slot flips to LAND
  tryEstablishBase() {
    const P = this.planet?.spec
    if (!this.landAvailable?.available || !P?.baseSite || P.hasBase || this.landingSeq) return
    const base = establishBase(panelKey(this.panels.px, this.panels.py), this.dominantResourceType())
    if (!base) return
    P.hasBase = true
    P.base = base
    this.planet.draw()
    sfx.dock()
  }

  // Phase A of the landing sequence: the ship dives into the planet disc —
  // shrinking and fading as if descending — then the Vue skim cutscene
  // (screen 'landing') carries the descent to the surface. Reduced motion
  // skips both and lands instantly, exactly like the old flow.
  land() {
    // landing means WALKING INTO YOUR BASE — no base, no landing (the UI
    // offers ESTABLISH instead; this guard is defense in depth)
    if (!this.landAvailable?.available || !this.planet?.spec.hasBase || this.landingSeq) return
    const P = this.planet.spec
    const payload = {
      panelKey: panelKey(this.panels.px, this.panels.py),
      resourceType: P.base?.resourceType ?? this.dominantResourceType(),
    }
    const finish = () => {
      // park at the capture-ring edge with transforms restored BEFORE
      // pausing, so liftoff resumes a sane ship and onPauseSync snapshots
      // a sane pose
      this.ship.setPosition(this.planet.x, this.planet.y - planetCaptureRadius(P.radius) + 20)
      this.ship.setScale(1).setAlpha(1)
      this.ship.body.stop()
      this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 800)
      this.landingSeq = false
      playerStore.landing = payload
      playerStore.screen = motion.reduced ? 'base' : 'landing'
      EventBus.emit('pause-game')
    }
    if (motion.reduced) {
      playerStore.landing = payload
      playerStore.screen = 'base'
      EventBus.emit('pause-game')
      return
    }
    this.landingSeq = true
    this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 2200)
    this.tweens.add({
      targets: this.ship,
      x: this.planet.x,
      y: this.planet.y,
      scale: 0.15,
      alpha: 0,
      duration: 1600,
      ease: 'Sine.easeIn',
      onComplete: finish,
    })
  }

  enemyFire(enemy, angle) {
    const b = this.enemyBullets.get()
    if (!b) return
    b.fire(
      enemy.x + Math.cos(angle) * 14,
      enemy.y + Math.sin(angle) * 14,
      angle,
      enemy.p.bulletSpeed,
      1.4
    )
  }

  onBulletHitEnemy(a, b) {
    const bullet = a instanceof Bullet ? a : b
    const enemy = a instanceof Bullet ? b : a
    if (!bullet.active || !enemy.active) return
    bullet.kill()
    this.debris.explode(6, enemy.x, enemy.y)
    if (enemy.hit()) {
      playerStore.addPoints(3)
      currencyService.credit(2, 'enemy bounty')
      this.debris.explode(14, enemy.x, enemy.y)
      if (enemy.specIdx >= 0) this.panelKilled.add(enemy.specIdx)
      enemy.release()
    }
  }

  onEnemyBulletHitShip(a, b) {
    const bullet = a instanceof Bullet ? a : b
    const ship = a instanceof Bullet ? b : a
    if (!bullet.active || !ship.active || ship.isInvulnerable) return
    bullet.kill()
    this.damageShip()
  }

  onShipRamEnemy(a, b) {
    const ship = a instanceof Ship ? a : b
    const enemy = a instanceof Ship ? b : a
    if (!ship.active || !enemy.active || ship.isInvulnerable) return
    // ramming hurts both
    this.debris.explode(10, enemy.x, enemy.y)
    if (enemy.hit()) {
      playerStore.addPoints(3)
      if (enemy.specIdx >= 0) this.panelKilled.add(enemy.specIdx)
      enemy.release()
    }
    this.damageShip()
  }

  damageShip() {
    sfx.hit()
    if (this.ship.damage(this.time.now)) {
      this.destroyShip()
    } else {
      this.debris.explode(8, this.ship.x, this.ship.y)
    }
  }

  // Every massive body in the panel is a gravity source with a standard
  // gravitational parameter μ (= G·M). Acceleration on any body: a = μ/r²
  // toward the source (inverse-square, min-distance softening clamp).
  // Inside a capture boundary, loose rock settles into a tangential orbit —
  // the body wears a ring (self-healing: mining knocks bits loose, the ring
  // recovers them). Natural fields (planets, stars) tidally shatter
  // full-size rocks on capture; a station's artificial containment field
  // holds rocks whole. The ship gets a soft capture: coasting settles into
  // orbit (where the land/dock prompts live); any thrust or boost pulls
  // straight back out. First field wins: planet > station > star, so a
  // station parked inside a star's ring keeps its own held orbits.
  enforceOrbitFields(delta) {
    const fields = this.orbitFields
    if (!fields?.length) return
    const blend = Math.min(1, (delta / 16.7) * 0.08)

    for (const rock of [...this.asteroids.getChildren()]) {
      if (!rock.active) continue
      for (const f of fields) {
        const dx = rock.x - f.x
        const dy = rock.y - f.y
        const r = Math.hypot(dx, dy) || 1
        if (r > f.captureRadius) continue

        // tidal breakup: a full-size rock can't hold together this deep
        if (f.tidal && rock.radius >= ASTEROID_TIERS[0]) {
          this.tidalShatter(rock, Math.atan2(dy, dx))
          break
        }

        const vCirc = Math.min(f.vMax, Math.sqrt(f.mu / r))
        const sign = dx * rock.body.velocity.y - dy * rock.body.velocity.x >= 0 ? 1 : -1
        let tx = (-dy / r) * sign * vCirc
        let ty = (dx / r) * sign * vCirc
        // ring bits shouldn't scrape the surface/structure
        if (r < f.innerRock) {
          tx += (dx / r) * 20
          ty += (dy / r) * 20
        }
        rock.body.velocity.x += (tx - rock.body.velocity.x) * blend
        rock.body.velocity.y += (ty - rock.body.velocity.y) * blend
        break
      }
    }

    if (this.ship.active && !this.ship.thrusting) {
      for (const f of fields) {
        const dx = this.ship.x - f.x
        const dy = this.ship.y - f.y
        const r = Math.hypot(dx, dy) || 1
        if (r > f.captureRadius || r < f.innerShip) continue
        const v = this.ship.body.velocity
        const vCirc = Math.min(f.vMax, Math.sqrt(f.mu / r))
        const sign = dx * v.y - dy * v.x >= 0 ? 1 : -1
        const shipBlend = Math.min(1, (delta / 16.7) * 0.03)
        v.x += ((-dy / r) * sign * vCirc - v.x) * shipBlend
        v.y += ((dx / r) * sign * vCirc - v.y) * shipBlend
        break
      }
    }
  }

  // shatter a rock into ring bits (same diff bookkeeping as a mining hit);
  // a mineral seam survives in the largest fragment
  tidalShatter(rock, angle) {
    if (rock.specIdx >= 0) this.panelDestroyed.add(rock.specIdx)
    const children = rock.split(this.mods, angle)
    for (const c of children) this.asteroids.add(c)
    if (rock.mineral && children.length) {
      children[0].setMineral({ ...rock.mineral })
    }
    this.debris.explode(8, rock.x, rock.y)
    rock.release()
    sfx.crack()
  }

  buildGravitySources() {
    this.gravitySources = []
    this.orbitFields = []
    const spec = this.panelSpec
    if (spec.well) {
      this.gravitySources.push({
        x: spec.well.x,
        y: spec.well.y,
        mu: spec.well.strength,
        minDist: spec.well.minDist,
        killRadius: spec.well.killRadius,
      })
    }
    if (spec.planet) {
      const mu = spec.planet.mu ?? spec.planet.radius * spec.planet.radius * 70
      this.gravitySources.push({
        x: spec.planet.x,
        y: spec.planet.y,
        mu,
        minDist: spec.planet.radius + 40,
        killRadius: 0, // you crash on its collider instead
        // the "atmosphere" edge: no pull beyond it, orbital capture within
        captureRadius: planetCaptureRadius(spec.planet.radius),
      })
      this.orbitFields.push({
        x: spec.planet.x,
        y: spec.planet.y,
        mu,
        captureRadius: planetCaptureRadius(spec.planet.radius),
        innerRock: spec.planet.radius + 60,
        innerShip: spec.planet.radius + 30,
        vMax: 150,
        tidal: true, // natural gravity shatters full-size rocks
      })
    }
    if (spec.station) {
      this.gravitySources.push({
        x: spec.station.x,
        y: spec.station.y,
        mu: STATION_FIELD_MU,
        minDist: CORE_R + 40,
        killRadius: 0, // you bump its collider, nothing eats you
        // artificial field: hard edge, no pull beyond it (same as planets)
        captureRadius: STATION_CAPTURE_RADIUS,
      })
      this.orbitFields.push({
        x: spec.station.x,
        y: spec.station.y,
        mu: STATION_FIELD_MU,
        captureRadius: STATION_CAPTURE_RADIUS,
        innerRock: STATION_FIELD_INNER,
        innerShip: CORE_R + 30,
        vMax: STATION_ORBIT_VMAX,
        tidal: false, // containment field holds rocks whole
      })
    }
    if (spec.well?.kind === 'star') {
      // the ring marks where orbit capture begins; the star's PULL still
      // reaches the whole panel (no captureRadius on its gravity source),
      // so long-range slingshots survive
      this.orbitFields.push({
        x: spec.well.x,
        y: spec.well.y,
        mu: spec.well.strength,
        captureRadius: starCaptureRadius(spec.well.strength),
        innerRock: spec.well.radius + 60,
        innerShip: spec.well.radius + 30,
        vMax: 280, // barely a clamp — compact stars whip captured ships fast
        tidal: true,
      })
    }
  }

  // Applies to ALL dynamic bodies — ship, enemies, asteroids, pickups —
  // per the equivalence principle, a = μ/r² regardless of the body's mass.
  // Semi-implicit Euler (Arcade's accel→velocity→position) keeps it stable.
  applyGravity(delta) {
    if (!this.gravitySources?.length) return
    const dt = delta / 1000

    const pull = (obj) => {
      let killer = null
      for (const s of this.gravitySources) {
        const dx = s.x - obj.x
        const dy = s.y - obj.y
        const rawSq = dx * dx + dy * dy
        const dist = Math.sqrt(rawSq) || 1
        // planets end at their capture boundary — no long-range drag
        if (s.captureRadius && dist > s.captureRadius) continue
        const a = s.mu / Math.max(rawSq, s.minDist * s.minDist)
        obj.body.velocity.x += (dx / dist) * a * dt
        obj.body.velocity.y += (dy / dist) * a * dt
        if (s.killRadius > 0 && dist < s.killRadius) killer = s
      }
      return killer
    }

    if (this.ship.active) {
      const killer = pull(this.ship)
      if (killer && !this.ship.isInvulnerable) {
        this.destroyShip() // consumed by the event horizon
      }
    }

    for (const e of this.enemies.getChildren()) {
      if (!e.active) continue
      if (pull(e)) {
        this.debris.explode(10, e.x, e.y)
        if (e.specIdx >= 0) this.panelKilled.add(e.specIdx)
        e.release()
      }
    }

    // rocks spiral in and feed the black hole — consumed WITHOUT a diff
    // record (commons replenish; the show repeats on revisit)
    for (const a of [...this.asteroids.getChildren()]) {
      if (!a.active) continue
      if (pull(a)) {
        this.debris.explode(8, a.x, a.y)
        a.release()
      }
    }

    for (const p of this.pickups.getChildren()) {
      if (!p.active) continue
      if (pull(p)) p.kill()
    }
  }

  // rocks are weapons: enough relative momentum crushes an enemy
  onRockHitsEnemy(a, b) {
    const rock = a instanceof Asteroid ? a : b
    const enemy = a instanceof Asteroid ? b : a
    if (!rock.active || !enemy.active) return
    const impact = resolveElastic(rock, enemy, 0.6)
    if (impact < 70) return // gentle nudge — the bounce alone handles it
    const killed = rock.radius > 34 ? true : enemy.hit()
    this.debris.explode(8, enemy.x, enemy.y)
    if (killed) {
      playerStore.addPoints(3)
      currencyService.credit(2, 'rock crush')
      this.debris.explode(12, enemy.x, enemy.y)
      if (enemy.specIdx >= 0) this.panelKilled.add(enemy.specIdx)
      enemy.release()
      sfx.boom()
    }
  }

  destroyShip() {
    this.debris.explode(20, this.ship.x, this.ship.y)
    this.ship.explode()
    this.time.delayedCall(900, () => {
      if (this.scene.isActive()) {
        this.ship.respawn(this.scale.width / 2, this.scale.height / 2, this.time.now)
      }
    })
  }

  checkPanelCrossing() {
    const w = this.scale.width
    const h = this.scale.height
    let dx = 0
    let dy = 0
    if (this.ship.x < 0) dx = -1
    else if (this.ship.x > w) dx = 1
    if (this.ship.y < 0) dy = -1
    else if (this.ship.y > h) dy = 1
    if (dx || dy) this.changePanel(dx, dy, w, h)
  }

  // fuel per jump, scaling gently with distance from the galactic core —
  // deep expeditions require preparation (handoff §8)
  transitionFuelCost() {
    const coreDistPanels = Math.hypot(this.panels.px, this.panels.py)
    return 0.5 + 0.15 * Math.sqrt(coreDistPanels)
  }

  changePanel(dx, dy, w, h) {
    playerStore.fuel = Math.max(0, playerStore.fuel - this.transitionFuelCost())
    this.departPanel()
    this.panels.move(dx, dy)

    // wrap ship to the opposite edge, momentum untouched
    if (dx === -1) this.ship.x += w
    else if (dx === 1) this.ship.x -= w
    if (dy === -1) this.ship.y += h
    else if (dy === 1) this.ship.y -= h

    // bullets never cross panels
    for (const b of this.bullets.getChildren()) {
      if (b.active) b.kill()
    }

    this.clearPanelObjects()
    this.enterPanel()

    // brief grace so a rock sitting on the entry edge can't instantly kill
    this.ship.invulnUntil = Math.max(this.ship.invulnUntil, this.time.now + 800)

    this.tweenBgTo(this.panelSpec.bgColor)
  }

  clearPanelObjects() {
    for (const a of [...this.asteroids.getChildren()]) a.release()
    for (const e of [...this.enemies.getChildren()]) e.release()
    for (const b of this.enemyBullets.getChildren()) if (b.active) b.kill()
    for (const p of this.pickups.getChildren()) if (p.active) p.kill()
    if (this.planet) {
      this.obstacles.remove(this.planet)
      this.planet.destroy()
      this.planet = null
    }
    if (this.station) {
      this.obstacles.remove(this.station)
      this.station.destroy()
      this.station = null
      this.updateDocking()
    }
    if (this.well) {
      this.well.destroy()
      this.well = null
    }
    if (this.anomaly) {
      this.anomaly.destroy()
      this.anomaly = null
    }
    if (this.vista) {
      this.vista.destroy()
      this.vista = null
    }
    if (this.starfield) {
      this.starfield.destroy()
      this.starfield = null
    }
  }

  tweenBgTo(color) {
    if (color === this.currentBg) return
    const from = Phaser.Display.Color.IntegerToColor(this.currentBg)
    const to = Phaser.Display.Color.IntegerToColor(color)
    this.currentBg = color
    if (this.bgTween) this.bgTween.stop()
    this.bgTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 250,
      onUpdate: (tw) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue())
        this.cameras.main.setBackgroundColor(
          Phaser.Display.Color.GetColor(c.r | 0, c.g | 0, c.b | 0)
        )
      },
    })
  }

  onBulletHit(a, b) {
    // Phaser can deliver overlap pairs in either order
    const bullet = a instanceof Bullet ? a : b
    const asteroid = a instanceof Bullet ? b : a
    if (!bullet.active || !asteroid.active) return
    const impactAngle = bullet.rotation
    bullet.kill()

    playerStore.addPoints(1) // 1 point per hit
    this.debris.explode(6, asteroid.x, asteroid.y)

    // any hit removes the original from the seed layout; survivors become fragments
    if (asteroid.specIdx >= 0) this.panelDestroyed.add(asteroid.specIdx)

    const children = asteroid.split(this.mods, impactAngle)
    for (const c of children) this.asteroids.add(c)

    // mining: a hit on a mineral rock shakes a unit loose; the remaining seam
    // rides along in the largest fragment (keep shooting the vein)
    if (asteroid.mineral) {
      const { type, amount } = asteroid.mineral
      const fullyDestroyed = children.length === 0
      const dropped = fullyDestroyed ? amount : 1
      this.dropResource(asteroid.x, asteroid.y, type, dropped * this.mods.mineYield)
      if (!fullyDestroyed && amount - 1 > 0) {
        children[0].setMineral({ type, amount: amount - 1 })
      }
    }

    asteroid.release()

    if (children.length === 0) {
      playerStore.addPoints(1) // destroy bonus: killing hit totals 2
      this.debris.explode(10, asteroid.x, asteroid.y)
      sfx.boom()
    } else {
      sfx.crack()
    }
  }

  // baseQty "seams" → units at inventory scale (each seam yields 3–8 units)
  dropResource(x, y, type, baseQty) {
    const totalUnits = Math.max(1, Math.round(baseQty * (3 + Math.random() * 5)))
    const chunks = Math.max(1, Math.min(4, Math.round(totalUnits / 12)))
    let remaining = totalUnits
    for (let i = 0; i < chunks; i++) {
      const units = i === chunks - 1 ? remaining : Math.ceil(totalUnits / chunks)
      remaining -= units
      if (units <= 0) break
      const p = this.pickups.get()
      if (!p) return
      p.drop(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 26, type, units)
    }
  }

  onScoop(a, b) {
    const pickup = a instanceof ResourcePickup ? a : b
    if (!pickup.active || !this.ship.active) return
    const take = Math.min(pickup.units, playerStore.maxAddable(pickup.resourceType))
    if (take <= 0) return // hold full (mass or slots) — chunk keeps floating
    playerStore.addCargo(pickup.resourceType, take)
    pickup.units -= take
    if (pickup.units <= 0) pickup.kill()
    sfx.scoop()
  }

  onBulletHitObstacle(a, b) {
    const bullet = a instanceof Bullet ? a : b
    const obstacle = a instanceof Bullet ? b : a
    if (!bullet.active) return
    const bx = bullet.x
    const by = bullet.y
    bullet.kill()
    // planet limb mining: bullets chip glowing nodes
    if (obstacle instanceof Planet) {
      const node = obstacle.nodeAt(bx, by)
      if (node) {
        node.hp = (node.hp ?? 3) - 1
        const pos = obstacle.nodeWorldPos(node)
        this.debris.explode(4, pos.x, pos.y)
        if (node.hp <= 0) {
          this.dropResource(pos.x, pos.y, node.type, node.amount * this.mods.mineYield)
          this.panelDepleted.add(node.idx)
          obstacle.removeNode(node)
        }
      }
    }
  }

  onShipHit(a, b) {
    const ship = a instanceof Ship ? a : b
    const asteroid = a instanceof Ship ? b : a
    if (!ship.active || !asteroid.active) return
    resolveElastic(ship, asteroid, 0.5) // physical bounce always applies
    if (ship.isInvulnerable) return
    this.damageShip()
  }
}
