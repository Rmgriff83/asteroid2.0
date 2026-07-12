// Panel coordinates only. Colors come from the panelSpec; state memory lives
// in WorldDiffs (regenerate-then-subtract).
export default class PanelManager {
  constructor(px = 0, py = 0) {
    this.px = px
    this.py = py
  }

  key(px = this.px, py = this.py) {
    return `${px},${py}`
  }

  move(dx, dy) {
    this.px += dx
    this.py += dy
  }
}
