// Authored dialogue/lore fragment pools (handoff §13 — the third instance of
// "sparse authored data consumed by a generic runtime"). The seed selects
// from pools keyed by sector systemType; writing more entries = more galaxy.
//
// NOTE on growing a pool: pickDialogue maps a seeded roll onto pool length,
// so adding entries remaps which dialogue an UNVISITED anomaly presents, and
// a previously-seen panel's beacon may respawn once with new content.
// Positions never move and grant consequences are idempotent — accepted
// trade-off, no GEN_VERSION bump needed.
import { getAuthored, getAuthoredVersion } from '../galaxy/authored'

export const DIALOGUE_POOLS = {
  field: [
    {
      id: 'field-buoy-1',
      speaker: 'AUTOMATED BUOY',
      lines: [
        'Survey marker 7-KILO. Ferrite yields nominal.',
        'The rocks out here remember being a planet, once.',
      ],
      consequence: { credits: 10 },
    },
    {
      id: 'field-hermit-1',
      speaker: 'UNKNOWN VESSEL',
      lines: [
        'You fly like someone who has somewhere to be.',
        'Out here, nowhere is somewhere. Take these and slow down.',
      ],
      consequence: { resource: { type: 'ferrite', qty: 3 } },
    },
    {
      id: 'field-cutter-1',
      speaker: 'BURNED-OUT CUTTER',
      lines: [
        'A mining cutter, nose scorched black. Its beam ran hotter than spec.',
        'The overdriven emitter fork survived — and so did its drawings.',
        'SCHEMATIC RECOVERED: VAPOR LANCE MK II. Fabricate it at any hangar.',
      ],
      consequence: { augBlueprint: 'bp-vapor' },
    },
  ],
  nebula: [
    {
      id: 'nebula-aegis-1',
      speaker: 'SHATTERED ESCORT',
      lines: [
        'Hull breach fore and aft — but the shield lattice held to the end.',
        'Its emitter geometry is still etched in the flight recorder.',
        'SCHEMATIC RECOVERED: AEGIS HALO. Fabricate it at any hangar.',
      ],
      consequence: { augBlueprint: 'bp-halo' },
    },
    {
      id: 'nebula-echo-1',
      speaker: 'SIGNAL ECHO',
      lines: [
        '…repeating. The veil sings at 4.7 hertz. We stopped to listen…',
        '…we are still listening. It is beautiful. Do not stop to listen.',
      ],
      consequence: { credits: 15 },
    },
    {
      id: 'nebula-refinery-1',
      speaker: 'ABANDONED REFINERY',
      lines: [
        'Automated broadcast: deuterium-hydrogen fusion ratios, endlessly.',
        'Someone left the recipe playing for whoever drifted by next.',
      ],
      consequence: { recipe: 'warpfuel' },
    },
  ],
  cluster: [
    {
      id: 'cluster-liner-1',
      speaker: 'DERELICT LINER',
      lines: [
        'A pleasure liner, stripped to the frame. The cabins are intact.',
        'Someone loved these berths enough to file the blueprints publicly.',
        'SCHEMATIC RECOVERED: TRANSIT CABIN. Fabricate it at any hangar.',
      ],
      consequence: { augBlueprint: 'bp-cabin' },
    },
    {
      id: 'cluster-prospector-1',
      speaker: 'PROSPECTOR RIG',
      lines: [
        'Claim registered. This cluster is picked over, friend.',
        'Rim rocks run richer. If you can run faster than what guards them.',
      ],
      consequence: { credits: 12 },
    },
  ],
  void: [
    {
      id: 'void-drifter-1',
      speaker: 'DRIFTING HULL',
      lines: [
        'No power signature. The logbook is open to its last page:',
        '"the quiet is not empty. the quiet is patient."',
        'A fabrication schematic is still cached in its terminal.',
      ],
      consequence: { recipe: 'antimatterpod' },
    },
    {
      id: 'void-racer-1',
      speaker: 'SILENT INTERCEPTOR',
      lines: [
        'Whoever flew this outran everything — except the quiet.',
        'The dorsal lattice along its spine is decades ahead of anything sold.',
        'SCHEMATIC RECOVERED: VECTOR SPINE. Fabricate it at any hangar.',
      ],
      consequence: { augBlueprint: 'bp-spine' },
    },
    {
      id: 'void-picket-1',
      speaker: 'GUTTED PICKET SHIP',
      lines: [
        'A picket gunship, hollowed out. Every shell casing is still floating.',
        'It held this line alone. The rotary feed mechanism is pristine.',
        'SCHEMATIC RECOVERED: GATLING ARRAY. Fabricate it at any hangar.',
      ],
      consequence: { augBlueprint: 'bp-gatling' },
    },
  ],
  coreward: [
    {
      id: 'core-anthem-1',
      speaker: 'HEARTH RELAY',
      lines: [
        'Welcome to the bright middle of everything, pilot.',
        'Fuel is cheap, the rocks are poor, and nothing here will chase you.',
      ],
      consequence: { credits: 8 },
    },
  ],
}

// ---- authored-dialogue merge (schema v2) ----
// Authored entries (bundled galaxy.json + admin working copy) layer over the
// hardcoded pools: entries with `pool` append to that pool in file order
// (append-only — same pool-shift caveat as above); entries without `pool`
// are pin-only, resolvable by id for panel pins. Memoized per authoredVersion.
let memoVersion = -1
let memoPools = null
let memoById = null

function rebuildMerged() {
  if (memoPools && memoVersion === getAuthoredVersion()) return
  memoVersion = getAuthoredVersion()
  memoPools = {}
  memoById = new Map()
  for (const [type, pool] of Object.entries(DIALOGUE_POOLS)) {
    memoPools[type] = [...pool]
    for (const d of pool) memoById.set(d.id, d)
  }
  for (const d of getAuthored().dialogues) {
    memoById.set(d.id, d)
    if (d.pool && memoPools[d.pool]) memoPools[d.pool].push(d)
  }
}

// full merged pools (hardcoded + authored appends) — used by the authoring kit
export function getMergedPools() {
  rebuildMerged()
  return memoPools
}

export function pickDialogue(systemType, roll) {
  rebuildMerged()
  const pool = memoPools[systemType] || memoPools.field
  return pool[Math.floor(roll * pool.length) % pool.length]
}

export function getDialogue(id) {
  rebuildMerged()
  return memoById.get(id) || null
}
