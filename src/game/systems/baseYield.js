// Silo math for player bases — the single source of truth shared by the base
// screen, both maps, and notification scheduling. Bases mine via timestamp
// reconstruction (never simulated): stored = min(capacity, elapsed × rate).
export function storedFor(base, now = Date.now()) {
  const hrs = (now - base.lastCollected) / 3600000
  return Math.min(base.capacity, Math.floor(hrs * base.ratePerHour))
}

// ms timestamp when the silo hits capacity
export function siloFullAt(base) {
  return base.lastCollected + (base.capacity / base.ratePerHour) * 3600000
}

export function isSiloFull(base, now = Date.now()) {
  return storedFor(base, now) >= base.capacity
}

// ms until the silo is full (0 when already full)
export function msToFull(base, now = Date.now()) {
  return Math.max(0, siloFullAt(base) - now)
}
