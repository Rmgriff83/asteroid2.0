<script setup>
// The ship's cargo hold as a CRT terminal in the cockpit (layout per the
// design handoff, rendered in our own visual language). Above it: the canopy
// window looking out at the current sector.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { playerStore } from '../stores/playerStore'
import { EventBus } from '../game/EventBus'
import { currencyService } from '../services/currencyService'
import { ITEMS, STACK_CAP, RARITY_COLORS } from '../game/data/resources'
import { RECIPES } from '../game/data/recipes'
import { getShip } from '../game/data/ships'
import { getModifiers } from '../game/systems/modifiers'
import { resolveSector, sectorOf } from '../game/galaxy/sectorProps'
import { getAuthored } from '../game/galaxy/authored'
import { worldState } from '../game/systems/WorldDiffs'
import ItemIcon from './ItemIcon.vue'
import ShipTintPanel from './ShipTintPanel.vue'

const GRID_MAX = 24
const BAY_COST_BASE = 120

const emit = defineEmits(['close'])

const selected = ref([]) // ordered block indices
const tab = ref('readout')
const toast = ref('')
const jettisonArmed = ref(false)
let toastTimer = null

// scale the fixed 1320×~1080 design space to fit any viewport
const fitScale = ref(1)
function computeScale() {
  fitScale.value = Math.min(window.innerWidth / 1380, window.innerHeight / 1180)
}
onMounted(() => {
  computeScale()
  window.addEventListener('resize', computeScale)
})
onBeforeUnmount(() => window.removeEventListener('resize', computeScale))

const mods = computed(() => getModifiers(playerStore.perks))
const shipDef = computed(() => getShip(playerStore.selectedShip))
const sector = computed(() => {
  const { sx, sy } = sectorOf(playerStore.currentPanel.px, playerStore.currentPanel.py)
  return resolveSector(worldState.galaxySeed, sx, sy, getAuthored())
})
const docked = computed(() => !!playerStore.dockedStation && playerStore.screen === 'cargo')

// ---- cargo blocks (per-ship stack size, spillover parts) ----
const stackCap = computed(() => playerStore.stackCap())

const blocks = computed(() => {
  const cap = stackCap.value
  const out = []
  for (const [type, qty] of Object.entries(playerStore.cargo)) {
    if (qty <= 0 || !ITEMS[type]) continue
    const parts = Math.ceil(qty / cap)
    for (let i = 0; i < parts; i++) {
      out.push({
        type,
        qty: i === parts - 1 ? qty - i * cap : cap,
        part: parts > 1 ? `${i + 1}/${parts}` : '',
      })
    }
  }
  return out
})

const slotCount = computed(() => playerStore.slotCount())
const emptyCount = computed(() => Math.max(0, slotCount.value - blocks.value.length))
const lockedCount = computed(() => GRID_MAX - slotCount.value)
const massUsed = computed(() => playerStore.cargoMass())
const massPct = computed(() => Math.min(100, (massUsed.value / mods.value.massMax) * 100))

// prune selection when blocks shift (craft/jettison/use)
const validSelected = computed(() => selected.value.filter((i) => i < blocks.value.length))
const primary = computed(() => {
  const v = validSelected.value
  return v.length ? blocks.value[v[v.length - 1]] : null
})
const selNames = computed(() => {
  const names = []
  for (const i of validSelected.value) {
    const t = blocks.value[i]?.type
    if (t && !names.includes(t)) names.push(t)
  }
  return names
})

function toggle(i) {
  jettisonArmed.value = false
  const pos = selected.value.indexOf(i)
  if (pos >= 0) selected.value.splice(pos, 1)
  else selected.value.push(i)
}

function removeName(type) {
  selected.value = selected.value.filter((i) => blocks.value[i]?.type !== type)
}

function clearSel() {
  selected.value = []
  jettisonArmed.value = false
}

// ---- readout ----
const readout = computed(() => {
  if (!primary.value) return null
  const type = primary.value.type
  const item = ITEMS[type]
  const total = playerStore.cargo[type] || 0
  const cap = stackCap.value
  const blockCount = Math.ceil(total / cap)
  return {
    type,
    item,
    total,
    blockCount,
    rarityColor: RARITY_COLORS[item.rarity],
    totalMass: (total * item.massPerUnit).toFixed(1),
    stackPct: Math.round((total / (blockCount * cap)) * 100),
  }
})

function useItem() {
  const r = readout.value
  if (!r?.item.use) return
  if (playerStore.removeCargo(r.type, 1) < 1) return
  EventBus.emit('consume-item', { type: r.type })
  showToast(`✓ USED ${r.item.name.toUpperCase()}`)
}

function jettison() {
  if (!jettisonArmed.value) {
    jettisonArmed.value = true
    return
  }
  const r = readout.value
  if (!r) return
  const units = playerStore.removeCargo(r.type, r.total)
  EventBus.emit('jettison', { type: r.type, units })
  clearSel()
  showToast(`⚠ JETTISONED ${units}u`)
}

// ---- crafting ----
const knownRecipes = computed(() => RECIPES.filter((r) => playerStore.knownRecipes.includes(r.id)))
const undiscovered = computed(() => RECIPES.length - knownRecipes.value.length)

const craftTitle = computed(() => {
  if (selNames.value.length === 0) return 'ALL RECIPES'
  if (selNames.value.length === 1)
    return `CRAFTABLE FROM ${ITEMS[selNames.value[0]].name.toUpperCase()}`
  return `COMBINE ${selNames.value.length} SELECTED`
})

const craftRows = computed(() => {
  let list = knownRecipes.value
  if (selNames.value.length === 1) {
    list = list.filter((r) => r.ingredients.some(([id]) => id === selNames.value[0]))
  } else if (selNames.value.length >= 2) {
    const set = new Set(selNames.value)
    list = list.filter(
      (r) =>
        r.ingredients.every(([id]) => set.has(id)) &&
        r.ingredients.every(([id, q]) => (playerStore.cargo[id] || 0) >= q)
    )
  }
  return list.map((r) => {
    const item = ITEMS[r.id]
    const ingredients = r.ingredients.map(([id, need]) => {
      const have = playerStore.cargo[id] || 0
      return { id, name: ITEMS[id].name, need, have, ok: have >= need }
    })
    return {
      ...r,
      item,
      ingredients,
      rarityColor: RARITY_COLORS[item.rarity],
      craftable: ingredients.every((g) => g.ok),
    }
  })
})

const craftEmptyMsg = computed(() =>
  selNames.value.length >= 2
    ? 'SELECTED ITEMS DO NOT COMBINE'
    : selNames.value.length === 1
      ? 'NO KNOWN RECIPES USE THIS RESOURCE'
      : 'NO RECIPES KNOWN'
)

function craft(row) {
  if (!row.craftable) return
  // consume, then verify the output fits (mass usually drops; slots can bind)
  for (const g of row.ingredients) playerStore.removeCargo(g.id, g.need)
  if (!playerStore.canAddCargo(row.id, 1)) {
    for (const g of row.ingredients) playerStore.addCargo(g.id, g.need)
    showToast('✕ NO ROOM FOR OUTPUT')
    return
  }
  playerStore.addCargo(row.id, 1)
  showToast(`✓ FABRICATED ${row.item.name.toUpperCase()}`)
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2600)
}

// ---- bay upgrade ----
const bayCost = computed(() => BAY_COST_BASE * (playerStore.bayLevel + 1))
const bayMaxed = computed(() => slotCount.value >= GRID_MAX)

function upgradeBay() {
  if (bayMaxed.value) return
  if (currencyService.debit(bayCost.value, 'cargo bay')) {
    playerStore.bayLevel += 1
    playerStore.save()
  }
}

// the cockpit shell decides what closing means (stow vs. exit to game)
function close() {
  emit('close')
}
</script>

<template>
  <div class="screen cargo-page">
    <div class="fit" :style="{ transform: `scale(${fitScale})` }">
      <div class="console" :style="{ '--float-amp': (shipDef.bobAmp ?? 4) * 0.7 + 'px' }">
        <div class="plate">CARGO SYSTEMS TERMINAL</div>

        <div class="crt">
          <div class="fx scan"></div>
          <div class="fx vignette"></div>
          <div class="fx flicker"></div>
          <i class="bracket tl"></i><i class="bracket tr"></i><i class="bracket bl"></i><i class="bracket br"></i>

          <div class="content">
            <!-- header -->
            <div class="term-head">
              <div class="title">
                <span class="ship-name">{{ shipDef.name }}</span>
                <span class="sys">:: CARGO.SYS</span>
                <span class="cursor"></span>
              </div>
              <div class="telemetry">
                {{ sector.name.toUpperCase() }}
                <span class="div">|</span>
                <span :class="docked ? 'ok' : 'dim'">{{ docked ? '● DOCKED' : '○ ADRIFT' }}</span>
                <button class="close-x" @pointerup="close">✕ CLOSE</button>
              </div>
            </div>

            <!-- body -->
            <div class="body">
              <!-- cargo matrix -->
              <div class="matrix">
                <div class="matrix-head">
                  <span class="label">CARGO MATRIX</span>
                  <span class="hint">tap to select · multi-select to craft</span>
                </div>
                <div class="grid">
                  <button
                    v-for="(b, i) in blocks"
                    :key="'b' + i"
                    class="cell block"
                    :class="{ selected: validSelected.includes(i) }"
                    @pointerup="toggle(i)"
                  >
                    <i class="rdot" :style="{ background: RARITY_COLORS[ITEMS[b.type].rarity] }"></i>
                    <span v-if="b.part" class="part">{{ b.part }}</span>
                    <span
                      v-if="validSelected.includes(i)"
                      class="selbadge"
                    >{{ validSelected.indexOf(i) + 1 }}</span>
                    <ItemIcon class="cicon" :icon="ITEMS[b.type].icon" :size="34" />
                    <span class="qty">{{ b.qty }} / {{ stackCap }}</span>
                    <span class="bar"><i :style="{ width: (b.qty / stackCap) * 100 + '%' }"></i></span>
                  </button>
                  <div v-for="i in emptyCount" :key="'e' + i" class="cell empty">+</div>
                  <div v-for="i in lockedCount" :key="'l' + i" class="cell locked">
                    <i class="shackle"></i><i class="lockbody"></i>
                    <span>LOCKED</span>
                  </div>
                </div>
              </div>

              <!-- contextual panel -->
              <div class="context">
                <div class="tabs">
                  <button class="tab" :class="{ on: tab === 'readout' }" @pointerup="tab = 'readout'">READOUT</button>
                  <button class="tab" :class="{ on: tab === 'craft' }" @pointerup="tab = 'craft'">CRAFTING</button>
                  <button class="tab" :class="{ on: tab === 'ship' }" @pointerup="tab = 'ship'">SHIP</button>
                  <span class="spacer"></span>
                  <template v-if="validSelected.length">
                    <span class="selcount">◆ {{ validSelected.length }} SELECTED</span>
                    <button class="clear" @pointerup="clearSel">CLEAR</button>
                  </template>
                </div>

                <!-- READOUT -->
                <div v-if="tab === 'readout'" class="pane">
                  <div v-if="!readout" class="empty-msg">select a cargo block</div>
                  <template v-else>
                    <div class="ro-head">
                      <div class="ro-iconbox"><ItemIcon :icon="readout.item.icon" :size="54" /></div>
                      <div>
                        <div class="ro-name">{{ readout.item.name.toUpperCase() }}</div>
                        <span class="pill" :style="{ color: readout.rarityColor, borderColor: readout.rarityColor }">
                          {{ readout.item.rarity.toUpperCase() }}
                        </span>
                      </div>
                    </div>
                    <div class="stat"><span>CATEGORY</span><b>{{ readout.item.category }}</b></div>
                    <div class="stat"><span>IN CARGO</span><b>{{ readout.total }} u</b></div>
                    <div class="stat"><span>MASS / UNIT</span><b>{{ readout.item.massPerUnit }} MU</b></div>
                    <div class="stat"><span>TOTAL MASS</span><b>{{ readout.totalMass }} MU</b></div>
                    <div class="stat"><span>BLOCKS</span><b>{{ readout.blockCount }}</b></div>
                    <div class="stat"><span>VALUE / UNIT</span><b>¢ {{ readout.item.price }}</b></div>
                    <div class="stackfill">
                      <span>STACK FILL</span>
                      <span class="track"><i :style="{ width: readout.stackPct + '%', background: readout.rarityColor }"></i></span>
                    </div>
                    <div class="actions">
                      <button v-if="readout.item.use" class="act use" @pointerup="useItem">USE</button>
                      <button class="act jett" :class="{ armed: jettisonArmed }" @pointerup="jettison">
                        {{ jettisonArmed ? 'CONFIRM ⚠' : 'JETTISON' }}
                      </button>
                    </div>
                  </template>
                </div>

                <!-- SHIP (hull tint & ship config) -->
                <div v-else-if="tab === 'ship'" class="pane">
                  <div class="ship-pane-head">
                    <span class="ship-pane-name">{{ shipDef.name }}</span>
                    <span class="ship-pane-sub">HULL CONFIGURATION</span>
                  </div>
                  <ShipTintPanel />
                </div>

                <!-- CRAFTING -->
                <div v-else class="pane craftpane">
                  <div class="craft-head">
                    <span class="label mint">{{ craftTitle }}</span>
                    <span class="hint2">need / have</span>
                  </div>
                  <div v-if="selNames.length" class="chips">
                    <button v-for="t in selNames" :key="t" class="chip" @pointerup="removeName(t)">
                      {{ ITEMS[t].name.toUpperCase() }} ✕
                    </button>
                  </div>
                  <div v-if="toast" class="toast">{{ toast }}</div>
                  <div class="recipes">
                    <div v-if="!craftRows.length" class="empty-msg">{{ craftEmptyMsg }}</div>
                    <div v-for="row in craftRows" :key="row.id" class="recipe">
                      <div class="r-head">
                        <div class="r-iconbox"><ItemIcon :icon="row.item.icon" :size="28" /></div>
                        <div class="r-titles">
                          <div class="r-name">{{ row.item.name }}</div>
                          <div class="r-meta">{{ row.item.category }} · {{ row.item.rarity }}</div>
                        </div>
                        <span class="status" :class="row.craftable ? 'ready' : 'missing'">
                          {{ row.craftable ? 'READY' : 'MISSING' }}
                        </span>
                      </div>
                      <div class="ing-row">
                        <span v-for="g in row.ingredients" :key="g.id" class="ing">
                          {{ g.name.toUpperCase() }}
                          <b :class="{ bad: !g.ok }">{{ g.need }} / {{ g.have }}</b>
                        </span>
                      </div>
                      <button
                        class="craft-btn"
                        :class="{ dead: !row.craftable }"
                        @pointerup="craft(row)"
                      >
                        {{ row.craftable ? '⚙ CRAFT' : 'INSUFFICIENT' }}
                      </button>
                    </div>
                    <div v-if="undiscovered" class="undiscovered">
                      {{ undiscovered }} BLUEPRINTS UNDISCOVERED — check stations &amp; anomalies
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- footer -->
            <div class="term-foot">
              <div class="cmd">CMD&gt;<span class="cursor small"></span></div>
              <div class="cap-row">
                <div class="capblock">
                  <span class="label">SLOTS</span>
                  <b>{{ blocks.length }} / {{ slotCount }}</b>
                  <span v-if="lockedCount" class="label">+{{ lockedCount }} LOCKED</span>
                </div>
                <div class="capblock massblock">
                  <div class="massline">
                    <span class="label">MASS</span>
                    <b>{{ massUsed.toFixed(1) }} / {{ mods.massMax }} MU</b>
                    <span v-if="massPct > 80" class="warn">{{ massPct >= 100 ? 'OVERLOADED — SPEED −' : 'NEAR CAPACITY' }}</span>
                  </div>
                  <span class="track big"><i :style="{ width: massPct + '%' }" :class="{ hot: massPct > 80 }"></i></span>
                </div>
                <button class="bay-btn" :disabled="bayMaxed || playerStore.credits < bayCost" @pointerup="upgradeBay">
                  {{ bayMaxed ? 'BAY MAXED' : `UPGRADE BAY · ¢${bayCost}` }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="base-strip">
          <i class="led on"></i><i class="led"></i>
          <span class="engrave">CX-7 CARGO TERMINAL · V.MMXXVI</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* backdrop (space view + scanlines) is owned by the cockpit shell */
.cargo-page {
  padding: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.fit {
  position: relative;
  z-index: 1;
  width: 1320px;
  flex-shrink: 0;
  transform-origin: center center;
  display: flex;
  flex-direction: column;
}

/* console housing — borderless, floating in space (literally: gentle drift) */
.console {
  position: relative;
  background: rgba(12, 16, 21, 0.94);
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 30px 72px rgba(0, 0, 0, 0.7);
  animation: console-float 8s ease-in-out infinite;
}

@keyframes console-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(calc(var(--float-amp, 4px) * -1)); }
}

.plate {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(12, 16, 21, 0.96);
  border: 1px solid rgba(234, 246, 255, 0.18);
  padding: 3px 16px;
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--ice);
  z-index: 3;
}

/* CRT */
.crt {
  position: relative;
  height: 720px;
  border-radius: 10px;
  overflow: hidden;
  background: #04060a;
  box-shadow: inset 0 0 110px rgba(0, 0, 0, 0.85), 0 0 0 1px #05070a;
}

.fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fx.scan {
  background: repeating-linear-gradient(to bottom, transparent 0 4px, rgba(0, 0, 0, 0.22) 4px 6px);
  opacity: 0.35;
  z-index: 9;
}

.fx.vignette {
  background: radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(2, 4, 8, 0.55) 100%);
  z-index: 6;
}

.fx.flicker {
  background: rgba(var(--ck-accent-rgb, 125, 255, 216), 0.1);
  mix-blend-mode: screen;
  animation: flick 8s steps(1) infinite;
  z-index: 8;
}

@keyframes flick {
  0%, 92%, 100% { opacity: 0; }
  93% { opacity: 0.045; }
  94% { opacity: 0.015; }
  96% { opacity: 0.05; }
}

.bracket {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 1px solid var(--mint);
  opacity: 0.4;
  z-index: 5;
  pointer-events: none;
}

.bracket.tl { top: 14px; left: 14px; border-right: none; border-bottom: none; }
.bracket.tr { top: 14px; right: 14px; border-left: none; border-bottom: none; }
.bracket.bl { bottom: 14px; left: 14px; border-right: none; border-top: none; }
.bracket.br { bottom: 14px; right: 14px; border-left: none; border-top: none; }

.content {
  position: relative;
  z-index: 5;
  height: 100%;
  padding: 24px 36px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* header */
.term-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 21px;
  font-weight: 700;
}

.ship-name { color: var(--ink); letter-spacing: 2px; }
.sys { color: var(--mint); text-shadow: 0 0 10px rgba(var(--ck-accent-rgb, 125, 255, 216), 0.6); }

.cursor {
  width: 10px;
  height: 18px;
  background: var(--mint);
  animation: blink 1.05s steps(1) infinite;
}

.cursor.small { width: 7px; height: 13px; margin-left: 8px; }

@keyframes blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

.telemetry {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--ice);
}

.telemetry .div { color: #2c3630; }
.telemetry .ok { color: var(--mint); }
.telemetry .dim { color: #6f7a74; }

.close-x {
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--amber);
  background: transparent;
  border: 1px solid rgba(255, 179, 92, 0.45);
  padding: 5px 10px;
  cursor: pointer;
}

/* body */
.body { display: flex; gap: 28px; flex: 1; min-height: 0; }

.matrix { display: flex; flex-direction: column; gap: 12px; }

.matrix-head { display: flex; justify-content: space-between; align-items: baseline; width: 694px; }

.label { font-size: 10px; letter-spacing: 2px; color: #6f7a74; }
.label.mint { color: var(--mint); }
.hint { font-size: 11px; color: #59635d; }

.grid {
  display: grid;
  grid-template-columns: repeat(6, 104px);
  gap: 14px;
  align-content: start;
}

.cell {
  position: relative;
  width: 104px;
  height: 104px;
  background: transparent;
  border: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.22);
  box-sizing: border-box;
  font-family: inherit;
  padding: 0;
}

.cell.block { cursor: pointer; }
.cell.block:hover { border-color: var(--mint); }

.cell.block.selected {
  border: 1.5px solid var(--mint);
  box-shadow: inset 0 0 14px rgba(var(--ck-accent-rgb, 125, 255, 216), 0.12);
}

.rdot { position: absolute; top: 8px; left: 8px; width: 6px; height: 6px; border-radius: 50%; }
.part { position: absolute; top: 6px; right: 7px; font-size: 8px; color: #6f7a74; letter-spacing: 1px; }

.selbadge {
  position: absolute;
  top: -1px;
  right: -1px;
  min-width: 17px;
  height: 17px;
  background: var(--mint);
  color: #04060a;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cicon { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); }

.qty {
  position: absolute;
  left: 0;
  bottom: 15px;
  width: 100%;
  text-align: center;
  font-size: 14px;
  color: #dfe4e0;
}

.bar {
  position: absolute;
  bottom: 8px;
  left: 10px;
  right: 10px;
  height: 2px;
  background: rgba(255, 255, 255, 0.06);
}

.bar i { display: block; height: 100%; background: var(--mint); }

.cell.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--ck-accent-rgb, 125, 255, 216), 0.3);
  font-size: 20px;
  border-color: rgba(var(--ck-accent-rgb, 125, 255, 216), 0.12);
}

.cell.locked {
  opacity: 0.55;
  border-color: rgba(255, 179, 92, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.cell.locked span { font-size: 8px; letter-spacing: 1px; color: #8a7340; }
.shackle { width: 10px; height: 8px; border: 1px solid #8a7340; border-bottom: none; border-radius: 5px 5px 0 0; }
.lockbody { width: 20px; height: 11px; border: 1px solid #8a7340; }

/* contextual panel */
.context {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.18);
  padding-left: 28px;
}

.tabs {
  display: flex;
  align-items: baseline;
  gap: 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 2px;
  padding: 0 0 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #5a635d;
  cursor: pointer;
}

.tab.on { color: var(--mint); border-bottom-color: var(--mint); }
.spacer { flex: 1; }
.selcount { font-size: 9px; color: var(--mint); letter-spacing: 1px; padding-bottom: 10px; }

.clear {
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 1px;
  color: #6f7a74;
  background: none;
  border: none;
  cursor: pointer;
  padding-bottom: 10px;
}

.pane { padding-top: 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }

.ship-pane-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 6px; }
.ship-pane-name { font-size: 22px; font-weight: 700; color: #f2f5f2; letter-spacing: 1px; }
.ship-pane-sub { font-size: 10px; letter-spacing: 2px; color: #6f7a74; }

.empty-msg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5a635d;
  font-size: 14px;
  letter-spacing: 1px;
  min-height: 60px;
}

/* readout */
.ro-head { display: flex; gap: 14px; align-items: center; }

.ro-iconbox {
  width: 76px;
  height: 76px;
  border: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ro-name { font-size: 26px; font-weight: 700; color: #f2f5f2; letter-spacing: 1px; }

.pill {
  display: inline-block;
  margin-top: 5px;
  font-size: 9px;
  letter-spacing: 2px;
  border: 1px solid;
  padding: 3px 9px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat span { font-size: 10px; letter-spacing: 1px; color: #6f7a74; }
.stat b { font-size: 14px; color: #dfe4e0; white-space: nowrap; }

.stackfill { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
.stackfill > span:first-child { font-size: 10px; letter-spacing: 1px; color: #6f7a74; }

.track { display: block; height: 6px; background: rgba(255, 255, 255, 0.06); }
.track i { display: block; height: 100%; background: var(--mint); }
.track.big i { transition: width 0.3s; }
.track i.hot { background: var(--amber); }

.actions { display: flex; gap: 10px; margin-top: auto; padding-top: 10px; }

.act {
  flex: 1;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 10px;
  background: transparent;
  cursor: pointer;
}

.act.use { border: 1px solid var(--mint); color: var(--mint); }
.act.jett { border: 1px solid #653029; color: #c07068; }
.act.jett.armed { background: #d85a4a; color: #140302; border-color: #d85a4a; }

/* crafting */
.craftpane { min-height: 0; }
.craft-head { display: flex; justify-content: space-between; align-items: baseline; }
.hint2 { font-size: 9px; color: #59635d; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--mint);
  background: none;
  border: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.3);
  padding: 4px 8px;
  cursor: pointer;
}

.toast {
  font-size: 10px;
  letter-spacing: 1px;
  color: #7fbf6a;
  border: 1px solid #37642e;
  padding: 7px 10px;
}

.recipes { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; padding-right: 6px; }

.recipe {
  border: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.2);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(255, 255, 255, 0.014);
}

.r-head { display: flex; gap: 10px; align-items: center; }

.r-iconbox {
  width: 38px;
  height: 38px;
  border: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.r-titles { flex: 1; min-width: 0; }
.r-name { font-size: 15px; font-weight: 700; color: #f2f5f2; }
.r-meta { font-size: 9px; color: #6f7a74; letter-spacing: 1px; }

.status { font-size: 9px; letter-spacing: 1px; padding: 3px 8px; border: 1px solid; }
.status.ready { color: #7fbf6a; border-color: #37642e; }
.status.missing { color: #a5776e; border-color: #5a3a34; }

.ing-row { display: flex; flex-wrap: wrap; gap: 7px; }

.ing {
  font-size: 9px;
  letter-spacing: 1px;
  color: #9aa39c;
  border: 1px solid rgba(255, 255, 255, 0.07);
  padding: 4px 8px;
}

.ing b { font-size: 11px; margin-left: 5px; color: #9aa39c; }
.ing b.bad { color: #d8685a; }

.craft-btn {
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 9px;
  background: var(--mint);
  color: #04060a;
  border: 1px solid var(--mint);
  cursor: pointer;
  font-weight: 700;
}

.craft-btn.dead {
  background: transparent;
  color: #59605a;
  border-color: #333a36;
  cursor: default;
  font-weight: 400;
}

.undiscovered { font-size: 9px; letter-spacing: 1px; color: #8a7340; padding: 6px 2px; }

/* footer */
.term-foot {
  border-top: 1px solid rgba(var(--ck-accent-rgb, 125, 255, 216), 0.18);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cmd { font-size: 12px; color: var(--mint); display: flex; align-items: center; }

.cap-row { display: flex; gap: 28px; align-items: center; }

.capblock { display: flex; align-items: baseline; gap: 10px; }
.capblock b { font-size: 19px; color: #dfe4e0; }

.massblock { flex: 1; flex-direction: column; align-items: stretch; display: flex; gap: 5px; }
.massline { display: flex; align-items: baseline; gap: 10px; }
.massline b { font-size: 15px; }
.warn { margin-left: auto; font-size: 9px; letter-spacing: 1px; color: #8a7340; }

.bay-btn {
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 1px;
  border: 1px solid var(--mint);
  color: var(--mint);
  background: transparent;
  padding: 11px 16px;
  cursor: pointer;
}

.bay-btn:disabled { opacity: 0.4; cursor: default; }

/* base strip */
.base-strip { height: 26px; margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.led { width: 8px; height: 8px; border-radius: 50%; background: #242a30; }
.led.on { background: var(--mint); box-shadow: 0 0 7px var(--mint); }
.engrave { margin-left: auto; font-size: 9px; letter-spacing: 2px; color: #3f464c; }

@media (prefers-reduced-motion: reduce) {
  .console,
  .fx.flicker,
  .cursor {
    animation: none;
  }
}
</style>
