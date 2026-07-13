// Widget deep links: asteroidzen://base/<panelKey> drops the player straight
// into that base's interior (no flight session, no animations). The app's
// FIRST url-scheme handler — native only.
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { playerStore } from '../stores/playerStore'

export const URL_SCHEME = 'asteroidzen'

// exported for headless testing (probes call this directly with a url)
export function handleDeepLink(url) {
  const m = /^asteroidzen:\/\/base\/(-?\d+,-?\d+)$/.exec(url || '')
  if (!m) return false
  const base = playerStore.bases.find((b) => b.panelKey === m[1])
  if (!base) return false
  playerStore.landing = { panelKey: base.panelKey, resourceType: base.resourceType }
  // entered from the home screen, not from flight — back/liftoff must go to
  // the menu instead of resuming a game that was never running
  playerStore.baseReturnsTo = 'menu'
  playerStore.screen = 'base'
  return true
}

export function initDeepLinks() {
  if (!Capacitor.isNativePlatform()) return
  // cold start: the event can fire before listeners attach
  CapApp.getLaunchUrl()
    .then((r) => r?.url && handleDeepLink(r.url))
    .catch(() => {})
  CapApp.addListener('appUrlOpen', ({ url }) => handleDeepLink(url))
}
