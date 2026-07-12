// Turns a pure panelSpec (+ a diff) into live game objects.
// The ONLY place spec data becomes Phaser objects.
import Asteroid from '../objects/Asteroid'
import Planet from '../objects/Planet'
import GravityWell from '../objects/GravityWell'
import Enemy from '../objects/Enemy'
import SpaceStation from '../objects/SpaceStation'
import Anomaly from '../objects/Anomaly'
import { playerStore } from '../../stores/playerStore'
import { spawnStarfield } from './Starfield'
import { mulberry32 } from '../utils/rng'

export function spawnPanel(scene, spec, diff = null) {
  scene.starfield = spawnStarfield(scene, scene.galaxySeed, spec.px, spec.py, spec.sector)
  if (spec.vista) scene.vista = spawnVista(scene, spec.vista)
  if (spec.planet) {
    // depleted mining nodes stay depleted (diff.resourcesDepleted)
    const nodes = spec.planet.nodes.filter((n) => !diff?.resourcesDepleted?.includes(n.idx))
    const base = playerStore.bases.find((b) => b.panelKey === `${spec.px},${spec.py}`) || null
    scene.planet = new Planet(scene, { ...spec.planet, nodes, hasBase: !!base, base })
    scene.obstacles.add(scene.planet)
  }
  if (spec.well) {
    scene.well = new GravityWell(scene, spec.well)
  }
  if (spec.station) {
    scene.station = new SpaceStation(scene, spec.station)
    scene.obstacles.add(scene.station)
  }
  if (spec.anomaly && !playerStore.seenDialogues.includes(spec.anomaly.dialogueId)) {
    scene.anomaly = new Anomaly(scene, spec.anomaly)
  }
  for (const a of spec.asteroids) {
    if (diff?.asteroidsDestroyed?.includes(a.idx)) continue
    const rock = Asteroid.obtain(scene, a.x, a.y, a.radius, a.verts, a.vx, a.vy, a.spin)
    rock.specIdx = a.idx
    if (a.mineral) rock.setMineral(a.mineral)
    scene.asteroids.add(rock)
  }
  // fragments: split survivors serialized in the panel diff
  if (diff?.fragments) {
    for (const f of diff.fragments) {
      const rock = Asteroid.fromState(scene, f)
      scene.asteroids.add(rock)
    }
  }

  // enemies: regenerate spec spawns minus the killed
  const groupMembers = []
  for (const e of spec.enemies) {
    if (diff?.enemiesKilled?.includes(e.idx)) continue
    const enemy = Enemy.obtain(scene, e.x, e.y, e.role, e.params)
    enemy.specIdx = e.idx
    scene.enemies.add(enemy)
    groupMembers.push(enemy)
  }
  scene.coordinator.reset(groupMembers)
}

// A vista is a non-interactive backdrop sight — the quiet-floor guarantee
// that calm fringe/icy panels still offer something to look at. Pure
// decoration: no physics, destroyed with the panel like the starfield.
function spawnVista(scene, vista) {
  const g = scene.add.graphics().setDepth(-15)
  const rng = mulberry32(vista.visualSeed)
  const { x, y, kind, drift } = vista

  if (kind === 'comet') {
    const ang = rng() * Math.PI * 2
    const len = 60 + drift * 12
    g.lineStyle(1.2, 0xd8fffb, 0.5)
    g.lineBetween(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    g.lineStyle(2.5, 0xd8fffb, 0.12)
    g.lineBetween(x, y, x + Math.cos(ang) * len * 0.7, y + Math.sin(ang) * len * 0.7)
    g.fillStyle(0xeaf6ff, 0.9)
    g.fillCircle(x, y, 2.5)
  } else if (kind === 'derelict') {
    // a broken hull silhouette, tumbled at a seeded angle
    g.lineStyle(1.1, 0x9aa39c, 0.4)
    const a0 = rng() * Math.PI * 2
    const pts = []
    for (let i = 0; i < 6; i++) {
      const r = 10 + rng() * 16
      const a = a0 + (i / 6) * Math.PI * 2 + rng() * 0.4
      pts.push({ x: x + Math.cos(a) * r * 1.6, y: y + Math.sin(a) * r })
    }
    g.strokePoints(pts.slice(0, 4), false, false)
    g.strokePoints(pts.slice(3), false, false) // hull gap: two disconnected runs
  } else {
    // far-planet: a dim distant disc, occasionally ringed
    const r = 12 + rng() * 14
    g.lineStyle(1.1, 0xd8c9f0, 0.3)
    g.strokeCircle(x, y, r)
    if (rng() < 0.5) g.strokeEllipse(x, y, r * 3, r * 0.9)
  }
  return g
}
