// Seed derivation. All deterministic content flows through these helpers.
import { hash32, mulberry32 } from '../utils/rng'

// Fold three ints into one 32-bit avalanche hash.
export function hash3(a, b, c) {
  return hash32(hash32(a | 0, b | 0), c | 0)
}

export function panelSeed(galaxySeed, px, py) {
  return hash3(galaxySeed, px, py)
}

export function sectorSeed(galaxySeed, sx, sy) {
  // distinct from panelSeed(galaxySeed, sx, sy) via a channel fold
  return hash32(hash3(galaxySeed, sx, sy), 0x5ec7)
}

// A fresh PRNG stream for one subsystem of one panel/sector.
export function channelRng(seed, channel) {
  return mulberry32(hash32(seed, channel))
}
