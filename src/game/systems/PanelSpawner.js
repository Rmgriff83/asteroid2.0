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

export function spawnPanel(scene, spec, diff = null) {
  scene.starfield = spawnStarfield(scene, scene.galaxySeed, spec.px, spec.py, spec.sector)
  if (spec.planet) {
    // depleted mining nodes stay depleted (diff.resourcesDepleted)
    const nodes = spec.planet.nodes.filter((n) => !diff?.resourcesDepleted?.includes(n.idx))
    const hasBase = playerStore.bases.some((b) => b.panelKey === `${spec.px},${spec.py}`)
    scene.planet = new Planet(scene, { ...spec.planet, nodes, hasBase })
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
