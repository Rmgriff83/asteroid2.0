// THE per-planet-type tuning table: hue identity (shared by the in-flight
// disc, the cockpit canvas, and the surface/base views), plus everything the
// landing/base experience derives per type — sky colors across the day cycle,
// atmosphere thickness (how much it hides the stars), surface silhouette
// shape, feature mix, and weather. Renderers read this table and contain no
// per-type magic numbers: tune the feel here, not in draw code.
//
// User-vision mapping: "frozen"→ice, "volcanic"→lava, "barren/mountains"→rocky.
// gas + ringed have no ground: their bases are floating aerostats riding a
// cloud deck (surface.kind 'clouddeck').

export const PLANET_THEME = {
  rocky: {
    stroke: 0xcdbfa8,
    fill: 0x2c2822,
    strokeCss: '#cdbfa8',
    fillCss: '#2c2822',
    // 0 = vacuum (stars blaze even at noon) .. 1 = opaque deck
    atmosphereDensity: 0.35,
    sky: { day: '#4a4136', dusk: '#7a4a30', night: '#0b0e14' },
    surface: {
      kind: 'terrain',
      layers: [
        // far → near parallax silhouettes
        { amp: 0.3, rough: 0.55, parallax: 0.25, alpha: 0.35 },
        { amp: 0.45, rough: 0.62, parallax: 0.55, alpha: 0.6 },
        { amp: 0.6, rough: 0.7, parallax: 1.0, alpha: 1.0 },
      ],
      features: { craters: [2, 5], spires: [1, 3] },
    },
    weather: { kind: 'dust', count: 22, speed: 34, cadenceMs: 480000, duty: 0.45 },
    day: { lengthMs: 1440000 }, // 24 real minutes
  },
  gas: {
    stroke: 0xffca7a,
    fill: 0x33290f,
    strokeCss: '#ffca7a',
    fillCss: '#33290f',
    atmosphereDensity: 0.8,
    sky: { day: '#6a5322', dusk: '#8a5228', night: '#100d06' },
    surface: {
      kind: 'clouddeck',
      bands: [3, 5],
    },
    weather: { kind: 'cloud-drift', count: 5, speed: 7, cadenceMs: 0, duty: 1 },
    day: { lengthMs: 1680000 }, // gas giants turn slow and stately
  },
  ice: {
    stroke: 0xaee6ff,
    fill: 0x14262e,
    strokeCss: '#aee6ff',
    fillCss: '#14262e',
    atmosphereDensity: 0.2,
    sky: { day: '#2e5866', dusk: '#49537e', night: '#050a12' },
    surface: {
      kind: 'terrain',
      layers: [
        { amp: 0.26, rough: 0.5, parallax: 0.25, alpha: 0.35 },
        { amp: 0.4, rough: 0.72, parallax: 0.55, alpha: 0.6 },
        { amp: 0.52, rough: 0.85, parallax: 1.0, alpha: 1.0 }, // rough → sharp shards
      ],
      features: { shards: [3, 6] },
    },
    weather: { kind: 'snow', count: 38, speed: 24, cadenceMs: 600000, duty: 0.4 },
    day: { lengthMs: 1440000 },
  },
  lava: {
    stroke: 0xff8a5c,
    fill: 0x2e130b,
    strokeCss: '#ff8a5c',
    fillCss: '#2e130b',
    // crack/ember glow color (matches the in-flight crack hue)
    emberCss: '#ffb35c',
    atmosphereDensity: 0.5,
    sky: { day: '#4a2016', dusk: '#6e2a14', night: '#110706' },
    surface: {
      kind: 'terrain',
      layers: [
        { amp: 0.22, rough: 0.5, parallax: 0.25, alpha: 0.35 },
        { amp: 0.3, rough: 0.55, parallax: 0.55, alpha: 0.6 },
        { amp: 0.36, rough: 0.55, parallax: 1.0, alpha: 1.0 }, // low rolling plains
      ],
      features: { volcanoes: [1, 3], cracks: [2, 4] },
    },
    weather: { kind: 'embers', count: 16, speed: 12, cadenceMs: 0, duty: 1 },
    day: { lengthMs: 1200000 },
  },
  ringed: {
    stroke: 0xd8c9f0,
    fill: 0x241f30,
    strokeCss: '#d8c9f0',
    fillCss: '#241f30',
    atmosphereDensity: 0.65,
    sky: { day: '#4a3f62', dusk: '#6a4570', night: '#090714' },
    surface: {
      kind: 'clouddeck',
      bands: [3, 5],
      ringArcInSky: true, // the planet's own rings, faint overhead
    },
    weather: { kind: 'cloud-drift', count: 4, speed: 5, cadenceMs: 0, duty: 1 },
    day: { lengthMs: 1560000 },
  },
}

export function planetTheme(type) {
  return PLANET_THEME[type] || PLANET_THEME.rocky
}
