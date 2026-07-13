// Base-decoration catalog: small comforts for the outpost, bought at the
// in-base supply console with credits. `kind` must match a slot kind in the
// base skin ('hanging' → the window rail, 'shelf' → the sill shelf).
// Art lives in components/base/TrinketArt.vue keyed by id.
export const BASE_TRINKETS = [
  { id: 'lucky-rock', name: 'LUCKY ROCK', price: 60, kind: 'hanging', blurb: 'the first one you ever cracked' },
  { id: 'nav-dice', name: 'NAV DICE', price: 90, kind: 'hanging', blurb: 'reads all zeros. lucky anyway' },
  { id: 'core-shard', name: 'CORE SHARD', price: 140, kind: 'hanging', blurb: 'still faintly warm' },
  { id: 'dwarf-cactus', name: 'DWARF CACTUS', price: 80, kind: 'shelf', blurb: 'waters itself. somehow' },
  { id: 'snow-globe', name: 'SNOW GLOBE', price: 180, kind: 'shelf', blurb: 'a tiny storm of home' },
  { id: 'mini-hauler', name: 'MINI HAULER', price: 260, kind: 'shelf', blurb: 'die-cast, 1:400 scale' },
  { id: 'void-bonsai', name: 'VOID BONSAI', price: 320, kind: 'shelf', blurb: 'grows toward nothing' },
]

export function getTrinket(id) {
  return BASE_TRINKETS.find((t) => t.id === id) || null
}
