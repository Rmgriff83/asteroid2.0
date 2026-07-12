// IndexedDB access (via idb). Four flat key-value stores:
//   player     — single 'main' record: the critical player-state domain
//   worldDiffs — "px,py" → panel diff (bulk world-state domain)
//   meta       — galaxySeed, visitedSectors, permanentKeys, schemaVersion
//   authored   — admin editor working copy (dev only)
import { openDB } from 'idb'

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('galaxy-v1', 1, {
      upgrade(db) {
        db.createObjectStore('player')
        db.createObjectStore('worldDiffs')
        db.createObjectStore('meta')
        db.createObjectStore('authored')
      },
    })
  }
  return dbPromise
}

export async function dbGet(store, key) {
  return (await getDB()).get(store, key)
}

export async function dbPut(store, key, value) {
  return (await getDB()).put(store, value, key)
}

export async function dbDelete(store, key) {
  return (await getDB()).delete(store, key)
}

export async function dbAllEntries(store) {
  const db = await getDB()
  const [keys, values] = await Promise.all([db.getAllKeys(store), db.getAll(store)])
  return keys.map((k, i) => [k, values[i]])
}
