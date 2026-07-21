# Deepfield — Galaxy

A calm, minimal, endlessly-explorable top-down space game: *No Man's Sky meets
Asteroids*. Vue 3 + Phaser + Capacitor, all art drawn programmatically in a
retro glow-stroke vector style. Client-only build (backend/monetization is a
later phase — the `currencyService` membrane seam is already in place).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Desktop: arrows/WASD turn + thrust, Space shoot, Shift boost, E dock/land, M map.
Touch: facing-only joystick (left), THRUST / FIRE / BOOST cluster (right).

## The galaxy

- **Infinite, seeded, computed — never stored.** Every panel regenerates from
  `hash(galaxySeed, x, y)`; only the player's *changes* (diffs) persist in
  IndexedDB. The 600 most relevant panel diffs are kept; evicted panels
  regenerate fresh (that's the common-resource replenishment). Bases, mission
  panels, and named finds are permanent and never evict.
- **Structure is math**: spiral arms and a safe-poor-core → dangerous-rich-rim
  gradient shape density, resources, enemy behavior, and colors.
- **Content**: procedural asteroids (mineable seams), five vector planet types
  with shootable resource nodes, stars (skimmable) and black holes (not),
  FSM enemy packs with role variety + attack-token coordination, stations
  (refuel / trade / delivery missions), lore anomalies with authored dialogue
  pools, buildable bases that mine on real-world timestamps while you're away.
- **Star map** samples the generators live at three zoom tiers with fog of
  war; fast travel only to earned nodes (docked stations, own bases).

## Authoring (admin)

Dev builds (or `VITE_ADMIN=1`) show an **Admin** entry in the menu:

- **Galaxy view** — paint sparse sector property overrides (type, danger,
  richness, density, enemy flavor, station density). Only deltas are stored.
- **Sector view** — the 16×16 panel grid; pin exact contents on a panel
  (gas planet, station, black hole, anomaly id, rich resource, clear) and
  "Fly Here" to test. Placement always stays procedural — pins are inputs.
- **Export JSON** downloads the override set; commit it as
  `src/game/data/authored/galaxy.json` to bake it into player builds.

## Architecture notes

- `src/game/galaxy/` — pure generation modules (no Phaser): seeds, structural
  bias fields, sector resolution, panel placement, naming. Per-subsystem RNG
  channels mean new features never reshuffle existing panels.
- `src/game/systems/WorldDiffs.js` — regenerate-then-subtract diff layer + LRU
  eviction + permanent set (IndexedDB via `idb`).
- `src/stores/playerStore.js` — reactive player state shared by Vue and
  Phaser; `src/services/currencyService.js` is the future server membrane.
- All ship feel parameters and blaster behavior are data
  (`src/game/systems/modifiers.js` + `data/perks.js` / `data/upgrades.js`).

## Native builds

```bash
npm run build && npx cap sync
npx cap open ios / android
```

Landscape locked; safe areas handled; saves flush on background/pagehide.
Before store submission: change the `com.deepfield.game` appId and
generate icons/splash with `@capacitor/assets`.
