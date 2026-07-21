// Thin group-level coordination (handoff §11): a rotating attack token so the
// player faces staggered pressure, and assigned surround angles so the group
// encircles instead of clustering. ~40 lines, on purpose.
const TAU = Math.PI * 2

export default class GroupCoordinator {
  constructor() {
    this.members = []
    this.nextTokenAt = 0
    this.tokenHolder = null
  }

  reset(members) {
    this.members = members
    this.tokenHolder = null
    this.nextTokenAt = 0
    this.assignAngles()
  }

  // late joiner (cross-panel pursuers arriving after the panel spawn)
  add(enemy) {
    if (!this.members.includes(enemy)) {
      this.members.push(enemy)
      this.assignAngles()
    }
  }

  remove(enemy) {
    const i = this.members.indexOf(enemy)
    if (i >= 0) {
      this.members.splice(i, 1)
      if (this.tokenHolder === enemy) this.tokenHolder = null
      this.assignAngles()
    }
  }

  assignAngles() {
    const n = this.members.length
    this.members.forEach((m, i) => {
      m.surroundAngle = (i / Math.max(1, n)) * TAU + 0.4
      if (m.surroundAngle > Math.PI) m.surroundAngle -= TAU
    })
  }

  update(time) {
    if (!this.members.length) return
    if (time > this.nextTokenAt) {
      if (this.tokenHolder) this.tokenHolder.hasToken = false
      const alive = this.members.filter((m) => m.active)
      if (alive.length) {
        this.tokenHolder = alive[Math.floor(Math.random() * alive.length)]
        this.tokenHolder.hasToken = true
      }
      this.nextTokenAt = time + 1500 + Math.random() * 1500
    }
  }
}
