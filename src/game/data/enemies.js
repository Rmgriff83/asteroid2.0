// Enemy roles: same FSM, different parameters (handoff §11 — role variety IS
// the coordination trick). Vertex shapes mirror the ships.js format (nose +x).
export const ENEMY_ROLES = {
  rusher: {
    verts: [[11, 0], [-7, -8], [-3, 0], [-7, 8]],
    color: 0xff6a6a,
    hp: 1,
    accel: 300,
    maxSpeed: 250,
    turnRate: 5,
    aggroRange: 440,
    preferredRange: 70,
    fireRange: 150,
    burstShots: 2,
    fireInterval: 260,
    bulletSpeed: 280,
    courage: 0.85,
    evasion: 0.55, // reckless — rushers barely flinch at rocks
  },
  kiter: {
    verts: [[9, 0], [0, -7], [-9, 0], [0, 7]],
    color: 0xff7de9,
    hp: 1,
    accel: 200,
    maxSpeed: 210,
    turnRate: 4,
    aggroRange: 480,
    preferredRange: 300,
    fireRange: 400,
    burstShots: 3,
    fireInterval: 220,
    bulletSpeed: 330,
    courage: 0.35,
    evasion: 0.9, // skittish — kiters dodge everything
  },
  flanker: {
    verts: [[12, 0], [-2, -5], [-9, -10], [-5, 0], [-9, 10], [-2, 5]],
    color: 0xffb35c,
    hp: 2,
    accel: 240,
    maxSpeed: 235,
    turnRate: 4.5,
    aggroRange: 460,
    preferredRange: 210,
    fireRange: 280,
    burstShots: 2,
    fireInterval: 240,
    bulletSpeed: 300,
    courage: 0.6,
    evasion: 0.75,
  },
}

// flavor → spawn table: [count range, role weights]
export const FLAVOR_SPAWNS = {
  none: null,
  timid: { count: [1, 2], roles: { kiter: 1 } },
  standard: { count: [2, 3], roles: { rusher: 1, kiter: 1, flanker: 0.6 } },
  volatile: { count: [3, 4], roles: { rusher: 1.4, flanker: 1, kiter: 0.4 } },
  pack: { count: [4, 6], roles: { rusher: 1.6, flanker: 0.8 } },
}
