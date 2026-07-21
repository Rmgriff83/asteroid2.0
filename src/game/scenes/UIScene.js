import Phaser from 'phaser'
import VirtualJoystick from '../systems/VirtualJoystick'
import { EventBus } from '../EventBus'
import { playerStore } from '../../stores/playerStore'
import { getShipAccent } from '../data/accents'
import { isSiloFull } from '../systems/baseYield'
import { getSafeArea } from '../utils/safeArea'
import { worldState } from '../systems/WorldDiffs'
import { generatePanel } from '../galaxy/panelGen'
import { getAuthored } from '../galaxy/authored'
import { STAR_TYPES } from '../data/stars'

const FONT = '"Space Mono", monospace'
const TAU = Math.PI * 2

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI')
  }

  create() {
    this.input.addPointer(3) // joystick + shoot + boost simultaneously
    this.isTouch =
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window

    this.scoreText = this.add
      .text(0, 0, '000000', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#eaf6ff',
      })
      .setDepth(60)
      .setShadow(0, 0, '#7dffd8', 6)
    this.lastPoints = -1

    this.hullText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#7dffd8' })
      .setDepth(60)
      .setShadow(0, 0, '#7dffd8', 5)
    this.lastHull = -1

    // shields: ice diamonds beside the hull row (repair-only charge)
    this.shieldText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#9db8ff' })
      .setDepth(60)
      .setShadow(0, 0, '#9db8ff', 5)
    this.lastShield = -1

    this.creditsText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#ffd67a' })
      .setDepth(60)
    this.cargoText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#9db8ff' })
      .setDepth(60)
    this.fuelBar = this.add.graphics().setDepth(60)
    this.lastFuelFrac = -1
    this.lastCredits = -1
    this.lastCargo = null

    this.dockBtn = this.makeButton('DOCK', 34, '12px').setVisible(false)
    this.dockBtn.on('pointerdown', () => EventBus.emit('dock'))
    this.onDockAvailable = (available) => this.dockBtn.setVisible(available)
    EventBus.on('dock-available', this.onDockAvailable)

    // one slot, two states: ESTABLISH (purchase, shows the build cost, dimmed
    // when unaffordable) at an unbuilt base site → LAND once the base exists
    this.landBtn = this.makeButton('LAND', 34, '12px').setVisible(false)
    this.landCost = this.add
      .text(0, 14, '15 FE · 8 SI', { fontFamily: FONT, fontSize: '8px', color: '#ffd67a' })
      .setOrigin(0.5)
      .setVisible(false)
    this.landBtn.add(this.landCost)
    this.landState = { available: false, hasBase: false, canAfford: false }
    this.landBtn.on('pointerdown', () => this.landAction())
    this.onLandAvailable = (state) => {
      this.landState = state
      this.landBtn.setVisible(state.available)
      if (!state.available) return
      this.landBtn.label.setText(state.hasBase ? 'LAND' : 'ESTABLISH')
      this.landBtn.label.setFontSize(state.hasBase ? '12px' : '9px')
      this.landBtn.label.setY(state.hasBase ? 0 : -4)
      this.landCost.setVisible(!state.hasBase)
      this.landBtn.setAlpha(state.hasBase || state.canAfford ? 1 : 0.35)
    }
    EventBus.on('land-available', this.onLandAvailable)

    this.input.keyboard.on('keydown-E', () => {
      if (this.dockBtn.visible) EventBus.emit('dock')
      else if (this.landBtn.visible) this.landAction()
    })

    this.pauseBtn = this.makeButton('| |', 22, '13px')
    this.pauseBtn.on('pointerdown', () => this.pauseGame())

    this.mapBtn = this.makeButton('MAP', 22, '10px')
    this.mapBtn.on('pointerdown', () => this.openMap())
    this.input.keyboard.on('keydown-M', () => this.openMap())

    this.cargoBtn = this.makeButton('SHIP', 22, '9px')
    this.cargoBtn.on('pointerdown', () => this.openScreen('cargo'))
    this.input.keyboard.on('keydown-I', () => this.openScreen('cargo'))
    this.input.keyboard.on('keydown-C', () => this.openScreen('cargo'))

    // HUD mini-map: 5×5 surrounding panels, rebuilt on panel entry
    this.minimap = this.add.graphics().setDepth(60)
    this.minimapSummaries = null

    if (this.isTouch) {
      this.joystick = new VirtualJoystick(this)

      // Three-button cluster (handoff §10): THRUST central and large at the
      // natural thumb rest; SHOOT co-reachable by the same thumb; BOOST the
      // burst button, deliberately a reach away.
      this.thrustBtn = this.makeButton('THRUST', 52, '14px')
      this.thrustBtn.on('pointerdown', () => EventBus.emit('touch-thrust', true))
      this.thrustBtn.on('pointerup', () => EventBus.emit('touch-thrust', false))
      this.thrustBtn.on('pointerout', () => EventBus.emit('touch-thrust', false))

      this.shootBtn = this.makeButton('FIRE', 40, '13px')
      this.shootBtn.on('pointerdown', () => EventBus.emit('touch-shoot', true))
      this.shootBtn.on('pointerup', () => EventBus.emit('touch-shoot', false))
      this.shootBtn.on('pointerout', () => EventBus.emit('touch-shoot', false))

      this.boostBtn = this.makeButton('BOOST', 32, '11px')
      this.boostBtn.on('pointerdown', () => EventBus.emit('touch-boost'))
    }

    // scanlines come from App.vue's global overlay — never add them here

    this.boostStart = 0
    this.boostReadyAt = 0
    this.onBoostFired = ({ start, readyAt }) => {
      this.boostStart = start
      this.boostReadyAt = readyAt
    }
    EventBus.on('boost-fired', this.onBoostFired)

    // sector name caption on entering a new sector
    this.sectorCaption = this.add
      .text(this.scale.width / 2, 46, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#9db8ff',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(60)
      .setShadow(0, 0, '#9db8ff', 8)
    this.lastSectorKey = null
    this.captionTween = null
    this.onPanelEntered = ({ sector }) => {
      this.redrawMinimap()
      const key = `${sector.sx},${sector.sy}`
      if (key === this.lastSectorKey) return
      this.lastSectorKey = key
      this.sectorCaption.setText(`${sector.name}\n${sector.classification}`)
      if (this.captionTween) this.captionTween.stop()
      this.sectorCaption.setAlpha(0)
      this.captionTween = this.tweens.add({
        targets: this.sectorCaption,
        alpha: { from: 0, to: 0.95 },
        duration: 500,
        hold: 2200,
        yoyo: true,
      })
    }
    EventBus.on('panel-entered', this.onPanelEntered)
    // GameScene enters its first panel before UIScene exists — catch up
    const gs = this.scene.get('Game')
    if (gs?.panelSpec) this.onPanelEntered({ sector: gs.panelSpec.sector })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('boost-fired', this.onBoostFired)
      EventBus.off('panel-entered', this.onPanelEntered)
      EventBus.off('dock-available', this.onDockAvailable)
      EventBus.off('land-available', this.onLandAvailable)
    })

    // first-flight onboarding hint
    if (playerStore.points === 0 && worldState.diffs.size <= 2) {
      const hint = this.add
        .text(
          this.scale.width / 2,
          this.scale.height - 30,
          'fly off any edge to explore  ·  shoot glowing rocks to mine  ·  dock at stations',
          { fontFamily: FONT, fontSize: '12px', color: '#9db8ff' }
        )
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(60)
      this.tweens.add({
        targets: hint,
        alpha: { from: 0, to: 0.85 },
        duration: 800,
        hold: 9000,
        yoyo: true,
        onComplete: () => hint.destroy(),
      })
    }

    this.layout()
    this.scale.on('resize', this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off('resize', this.layout, this)
    )
  }

  pauseGame() {
    if (this.joystick) this.joystick.reset()
    EventBus.emit('touch-shoot', false)
    EventBus.emit('touch-thrust', false)
    playerStore.paused = true
    EventBus.emit('pause-game')
  }

  openMap() {
    this.openScreen('map')
  }

  openScreen(screen) {
    if (playerStore.screen !== 'game' || playerStore.paused) return
    if (this.joystick) this.joystick.reset()
    EventBus.emit('touch-shoot', false)
    EventBus.emit('touch-thrust', false)
    playerStore.screen = screen
    EventBus.emit('pause-game')
  }

  redrawMinimap() {
    const gs = this.scene.get('Game')
    if (!gs?.panelSpec) return
    const { px, py } = playerStore.currentPanel
    const cell = 15
    const g = this.minimap
    g.clear()
    const ox = this.minimapPos?.x ?? 0
    const oy = this.minimapPos?.y ?? 0
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const x = ox + (dx + 2) * cell
        const y = oy + (dy + 2) * cell
        const key = `${px + dx},${py + dy}`
        const visited = !!worldState.diffs.get(key)?.visited || (dx === 0 && dy === 0)
        if (visited) {
          const spec = generatePanel(gs.galaxySeed, px + dx, py + dy, getAuthored())
          g.fillStyle(spec.bgColor, 1)
          g.fillRect(x, y, cell - 2, cell - 2)
          if (spec.station) {
            g.fillStyle(0x7dffd8, 1)
            g.fillRect(x + cell / 2 - 2, y + cell / 2 - 2, 4, 4)
          } else if (spec.planet) {
            g.fillStyle(0xffd67a, 0.9)
            g.fillCircle(x + cell / 2, y + cell / 2, 2.2)
          } else if (spec.well) {
            g.fillStyle(
              spec.well.kind === 'blackhole'
                ? 0xb28aff
                : STAR_TYPES[spec.well.starType]?.mid ?? 0xfff3cd,
              0.9
            )
            g.fillCircle(x + cell / 2, y + cell / 2, spec.well.kind === 'star' ? 2.4 : 1.8)
          }
          // player base: amber dome over whatever else is here
          const base = playerStore.bases.find((b) => b.panelKey === key)
          if (base) {
            const cx = x + cell / 2
            const cy = y + cell / 2 + 2
            g.lineStyle(1.2, 0xffb35c, 0.95)
            g.beginPath()
            g.arc(cx, cy, 3, Math.PI, 0, false)
            g.strokePath()
            g.lineBetween(cx - 4, cy, cx + 4, cy)
            if (isSiloFull(base)) {
              g.fillStyle(0xffb35c, 1)
              g.fillCircle(x + cell - 4, y + 3, 1.8)
            }
          }
        } else {
          g.fillStyle(0xeaf6ff, 0.05)
          g.fillRect(x, y, cell - 2, cell - 2)
        }
        if (dx === 0 && dy === 0) {
          g.lineStyle(1.4, getShipAccent(playerStore.selectedShip).int, 0.95)
          g.strokeRect(x - 1, y - 1, cell, cell)
        }
      }
    }
  }

  // the land slot's action depends on its state: purchase first, then land
  landAction() {
    const s = this.landState
    if (!s.available) return
    if (s.hasBase) EventBus.emit('land')
    else if (s.canAfford) EventBus.emit('establish-base')
  }

  makeButton(label, radius, fontSize) {
    const c = this.add.container(0, 0).setDepth(60)
    const ring = this.add.graphics()
    ring.lineStyle(6, 0xeaf6ff, 0.12)
    ring.strokeCircle(0, 0, radius)
    ring.lineStyle(1.5, 0xeaf6ff, 0.7)
    ring.strokeCircle(0, 0, radius)
    const arc = this.add.graphics()
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize, color: '#eaf6ff' })
      .setOrigin(0.5)
    c.add([ring, arc, text])
    c.arcGfx = arc
    c.label = text
    c.btnRadius = radius
    c.setInteractive(
      new Phaser.Geom.Circle(0, 0, radius + 14),
      Phaser.Geom.Circle.Contains
    )
    c.on('pointerdown', () => c.setScale(0.92))
    c.on('pointerup', () => c.setScale(1))
    c.on('pointerout', () => c.setScale(1))
    return c
  }

  layout() {
    const w = this.scale.width
    const h = this.scale.height
    // convert CSS-pixel safe-area insets into game units (FIT letterboxing)
    const dw = this.scale.displaySize ? this.scale.displaySize.width : w
    const ratio = dw > 0 ? w / dw : 1
    const raw = getSafeArea()
    const sa = {
      top: raw.top * ratio,
      right: raw.right * ratio,
      bottom: raw.bottom * ratio,
      left: raw.left * ratio,
    }
    this.scoreText.setPosition(16 + sa.left, 12 + sa.top)
    this.hullText.setPosition(16 + sa.left, 38 + sa.top)
    this.shieldText.setPosition(16 + sa.left + 60, 38 + sa.top)
    this.lastShield = -1 // re-anchor next update
    this.fuelBarPos = { x: 16 + sa.left, y: 62 + sa.top }
    this.lastFuelFrac = -1 // force redraw at new position
    this.creditsText.setPosition(16 + sa.left, 76 + sa.top)
    this.cargoText.setPosition(16 + sa.left, 96 + sa.top)
    this.dockBtn.setPosition(w / 2 - 50, h - 80 - sa.bottom)
    this.landBtn.setPosition(w / 2 + 50, h - 80 - sa.bottom)
    this.pauseBtn.setPosition(w - 34 - sa.right, 34 + sa.top)
    this.mapBtn.setPosition(w - 90 - sa.right, 34 + sa.top)
    this.cargoBtn.setPosition(w - 146 - sa.right, 34 + sa.top)
    this.minimapPos = { x: w - 110 - sa.right, y: 72 + sa.top }
    this.redrawMinimap()
    if (this.thrustBtn) {
      this.thrustBtn.setPosition(w - 100 - sa.right, h - 100 - sa.bottom)
      this.shootBtn.setPosition(w - 226 - sa.right, h - 140 - sa.bottom)
      this.boostBtn.setPosition(w - 88 - sa.right, h - 232 - sa.bottom)
    }
  }

  update(time) {
    if (playerStore.points !== this.lastPoints) {
      this.lastPoints = playerStore.points
      this.scoreText.setText(String(playerStore.points).padStart(6, '0'))
    }

    const gs = this.scene.get('Game')
    if (gs?.ship && gs.ship.hull !== this.lastHull) {
      this.lastHull = gs.ship.hull
      this.hullText.setText('◆'.repeat(Math.max(0, gs.ship.hull)))
    }
    if (gs?.ship && (gs.ship.shield ?? 0) !== this.lastShield) {
      this.lastShield = gs.ship.shield ?? 0
      this.shieldText.setText('◇'.repeat(Math.max(0, this.lastShield)))
      this.shieldText.setX(this.hullText.x + Math.max(0, gs.ship.maxHull) * 14 + 6)
    }

    if (gs?.mods) {
      const frac = Math.max(0, Math.min(1, playerStore.fuel / gs.mods.fuelMax))
      if (Math.abs(frac - this.lastFuelFrac) > 0.005) {
        this.lastFuelFrac = frac
        const { x, y } = this.fuelBarPos
        this.fuelBar.clear()
        this.fuelBar.lineStyle(1, 0xeaf6ff, 0.5)
        this.fuelBar.strokeRect(x, y, 110, 7)
        this.fuelBar.fillStyle(frac < 0.2 ? 0xff6a6a : 0x7dffd8, 0.85)
        this.fuelBar.fillRect(x + 1, y + 1, 108 * frac, 5)
      }
      if (playerStore.credits !== this.lastCredits) {
        this.lastCredits = playerStore.credits
        this.creditsText.setText(`¢ ${playerStore.credits}`)
      }
      const mass = playerStore.cargoMass()
      const cargoStr = `MASS ${Math.round(mass)}/${gs.mods.massMax}`
      if (cargoStr !== this.lastCargo) {
        this.lastCargo = cargoStr
        this.cargoText.setText(cargoStr)
        this.cargoText.setColor(mass / gs.mods.massMax > 0.8 ? '#ffb35c' : '#9db8ff')
      }
    }

    if (this.boostBtn) {
      const arc = this.boostBtn.arcGfx
      if (time < this.boostReadyAt) {
        const frac = 1 - (this.boostReadyAt - time) / (this.boostReadyAt - this.boostStart)
        arc.clear()
        arc.lineStyle(3, 0xffb35c, 0.9)
        arc.beginPath()
        arc.arc(0, 0, this.boostBtn.btnRadius + 6, -Math.PI / 2, -Math.PI / 2 + frac * TAU)
        arc.strokePath()
      } else if (this.boostReadyAt !== 0) {
        this.boostReadyAt = 0
        arc.clear()
      }
    }
  }
}
