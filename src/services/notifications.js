// Local notifications for base silos. One idempotent entry point:
// syncSiloNotifications(bases) cancels every silo notification we own and
// reschedules from the current base list — call it on boot (also covers the
// world-re-roll case, where an empty list cancels everything) and after any
// build/collect. No-ops gracefully on web.
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { siloFullAt } from '../game/systems/baseYield'
import { ITEMS } from '../game/data/resources'
import { hash32 } from '../game/utils/rng'

function siloNotificationId(base) {
  const [px, py] = base.panelKey.split(',').map(Number)
  return hash32(px | 0, py | 0) & 0x7fffffff
}

let permissionGranted = null

async function ensurePermission() {
  if (permissionGranted !== null) return permissionGranted
  try {
    let status = await LocalNotifications.checkPermissions()
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions()
    }
    permissionGranted = status.display === 'granted'
  } catch {
    permissionGranted = false
  }
  return permissionGranted
}

export async function syncSiloNotifications(bases) {
  if (!Capacitor.isNativePlatform()) {
    if (import.meta.env.DEV) console.info('[notifications] web platform — silo scheduling skipped')
    return
  }
  if (!(await ensurePermission())) return

  try {
    // cancel everything we own (ids are derived from base panel coords, and
    // silo alerts are the only notifications this app schedules)
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    }

    const now = Date.now()
    const upcoming = bases
      .filter((b) => siloFullAt(b) > now)
      .map((b) => ({
        id: siloNotificationId(b),
        title: 'SILO FULL',
        body: `Your ${ITEMS[b.resourceType]?.name ?? b.resourceType} base is at capacity (${b.capacity}) — swing by to collect.`,
        schedule: { at: new Date(siloFullAt(b)) },
      }))
    if (upcoming.length) await LocalNotifications.schedule({ notifications: upcoming })
  } catch (e) {
    console.warn('[notifications] silo sync failed', e)
  }
}
