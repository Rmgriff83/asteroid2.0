// Single JSON save blob via Capacitor Preferences.
// Its web implementation falls back to localStorage, so this works in the
// browser during development and natively on iOS/Android.
import { Preferences } from '@capacitor/preferences'

const KEY = 'asteroid-zen-save-v1'

export async function loadSave() {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return value ? JSON.parse(value) : null
  } catch (err) {
    console.warn('load failed', err)
    return null
  }
}

export async function writeSave(data) {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(data) })
  } catch (err) {
    console.warn('save failed', err)
  }
}
