// Bridge to the native WidgetFeed plugin (in-app plugin on both platforms):
//   write({ manifestJson?, files: [{path, dataB64}] }) — persist frame images
//     (and, last, the manifest) into widget-readable storage
//   reloadWidgets() — poke WidgetKit / AppWidgetManager to re-read the feed
// The web implementation is an in-memory dry-run store so the pipeline is
// testable in a browser (and in headless probes) without native code.
import { registerPlugin } from '@capacitor/core'

export const webFeedStore = { files: new Map(), manifest: null, reloads: 0 }

export const WidgetFeed = registerPlugin('WidgetFeed', {
  web: () => ({
    async write({ manifestJson, files = [] }) {
      for (const f of files) webFeedStore.files.set(f.path, f.dataB64)
      if (manifestJson) webFeedStore.manifest = JSON.parse(manifestJson)
    },
    async reloadWidgets() {
      webFeedStore.reloads++
    },
  }),
})
