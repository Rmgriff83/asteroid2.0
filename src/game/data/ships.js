// Ship definitions: pure polyline vertex data (nose along +x), rendered by the
// shared glow-stroke pipeline. `extraLines` are interior detail strokes.
export const SHIPS = [
  {
    id: 'classic',
    name: 'DART',
    cost: 0,
    cargoSlots: 8,
    stackCap: 50,
    bobAmp: 7,
    cockpitSkin: 'base',
    accent: 'green',
    verts: [[14, 0], [-10, -9], [-6, 0], [-10, 9]],
    extraLines: [],
  },
  {
    id: 'arrow',
    name: 'ARROW',
    cost: 150,
    cargoSlots: 10,
    stackCap: 100,
    bobAmp: 5.5,
    cockpitSkin: 'base',
    accent: 'mint',
    verts: [[18, 0], [2, -5], [-10, -11], [-6, -3], [-6, 3], [-10, 11], [2, 5]],
    extraLines: [[[6, -3], [6, 3]]],
  },
  {
    id: 'talon',
    name: 'TALON',
    cost: 400,
    cargoSlots: 12,
    stackCap: 150,
    bobAmp: 4.5,
    cockpitSkin: 'base',
    accent: 'amber',
    verts: [[16, 0], [0, -4], [-4, -14], [-10, -6], [-8, 0], [-10, 6], [-4, 14], [0, 4]],
    extraLines: [[[4, -2], [-4, 0]], [[4, 2], [-4, 0]]],
  },
  {
    id: 'ray',
    name: 'RAY',
    cost: 800,
    cargoSlots: 14,
    stackCap: 200,
    bobAmp: 3.5,
    cockpitSkin: 'base',
    accent: 'pink',
    verts: [[15, 0], [4, -3], [-2, -12], [-12, -8], [-7, -2], [-7, 2], [-12, 8], [-2, 12], [4, 3]],
    extraLines: [[[8, 0], [-4, 0]]],
  },
  {
    id: 'nova',
    name: 'NOVA',
    cost: 1500,
    cargoSlots: 18,
    stackCap: 250,
    bobAmp: 2.5,
    cockpitSkin: 'base',
    accent: 'ice',
    verts: [
      [20, 0], [6, -4], [0, -12], [-8, -8], [-14, -14], [-10, -3],
      [-10, 3], [-14, 14], [-8, 8], [0, 12], [6, 4],
    ],
    extraLines: [[[6, -4], [6, 4]], [[-2, -6], [-2, 6]]],
  },
]

export function getShip(id) {
  return SHIPS.find((s) => s.id === id) || SHIPS[0]
}
