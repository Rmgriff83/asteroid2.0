// Ship accent colors: one curated family per swatch — accent (primary
// strokes/text), bright (hover/hot), dim (borders/trim) — pre-tuned so
// gauges, borders and glows always read against the dark UI. `int` is the
// Phaser tint, `rgb` a comma triplet for rgba(var(--ck-accent-rgb), a)
// composition in CSS.
//
// The accent drives BOTH the ship's exterior (hull stroke, flame, thrust
// trail, minimap marker, previews) and its interior (cockpit tokens + the
// cargo terminal via the .cockpit-scoped --mint override). Ships declare a
// default via `accent` on the ship def; the player can override per ship
// (playerStore.shipAccents, set from the cockpit paint panel).
import { getShip } from './ships'
import { playerStore } from '../../stores/playerStore'

export const ACCENTS = {
  green:  { name: 'REACTOR GREEN', css: '#5fd9a0', bright: '#8ce8bc', dim: '#2f8f70', int: 0x5fd9a0, rgb: '95, 217, 160' },
  mint:   { name: 'ION MINT',      css: '#7dffd8', bright: '#b1ffe9', dim: '#3fa889', int: 0x7dffd8, rgb: '125, 255, 216' },
  amber:  { name: 'FLARE AMBER',   css: '#ffb35c', bright: '#ffd08f', dim: '#a8703a', int: 0xffb35c, rgb: '255, 179, 92' },
  gold:   { name: 'SODIUM GOLD',   css: '#ffe066', bright: '#fff0a8', dim: '#a8923a', int: 0xffe066, rgb: '255, 224, 102' },
  pink:   { name: 'NEBULA PINK',   css: '#ff7de9', bright: '#ffabf2', dim: '#a84f99', int: 0xff7de9, rgb: '255, 125, 233' },
  violet: { name: 'PULSAR VIOLET', css: '#b48aff', bright: '#d0b3ff', dim: '#6f52a8', int: 0xb48aff, rgb: '180, 138, 255' },
  ice:    { name: 'CRYO ICE',      css: '#9db8ff', bright: '#c6d6ff', dim: '#5a6faf', int: 0x9db8ff, rgb: '157, 184, 255' },
  red:    { name: 'GIANT RED',     css: '#ff6a6a', bright: '#ff9d9d', dim: '#a84444', int: 0xff6a6a, rgb: '255, 106, 106' },
}

export const ACCENT_ORDER = ['green', 'mint', 'ice', 'violet', 'pink', 'red', 'amber', 'gold']

export function getAccent(key) {
  return ACCENTS[key] || ACCENTS.green
}

// player override → ship default → green
export function getShipAccent(shipId) {
  return getAccent(playerStore.shipAccents[shipId] ?? getShip(shipId).accent)
}
