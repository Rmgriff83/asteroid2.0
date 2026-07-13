# Base-Window Home-Screen Widgets

Full-width widgets showing an outpost's window view — the pre-rendered planet
surface with accurate day/night + weather for each moment — plus the live silo
fill and a one-tap deep link (`asteroidzen://base/<panelKey>`) into that base.

## How it works

- `src/services/widgetFeed.js` renders **12 future frames per base** (now +
  half-hour wall-clock steps, 728×340 JPEG) with the same pure renderer the
  base interior uses, plus a `manifest.json` (silo timestamps, colors, names).
  It syncs whenever base state changes and when the app backgrounds.
- The in-app `WidgetFeed` Capacitor plugin writes those into:
  - iOS: the App Group container (`group.com.example.asteroidzen.widgets`)
  - Android: `filesDir/widgets/`
- Widgets never render the scene themselves — they swap pre-rendered frames on
  schedule (iOS: one timeline entry per frame; Android: 15-min WorkManager
  ticks pick the frame closest to now) and compute silo fill natively from
  `lastCollected/ratePerHour/capacity` (mirror of `baseYield.js`), so the
  numbers never go stale. iOS additionally auto-ticks the countdown and fill
  bar between refreshes (`Text(timerInterval:)` / `ProgressView(timerInterval:)`).

## Android — ready to run

Everything is wired (`assembleDebug` verified). Test on a device/emulator:

```sh
npm run build && npx cap copy android && cd android && ./gradlew installDebug
adb shell am start -a android.intent.action.VIEW -d "asteroidzen://base/0,0"  # deep-link smoke test
```

Open the app once (establish a base, background the app — that writes the
feed), then long-press the home screen → widgets → **Asteroid Zen** → place the
4×2 widget → the config dialog lists your outposts.

## iOS — one-time Xcode setup (~2 minutes)

All Swift sources are pre-written in `ios/App/BaseWidget/`. Xcode must create
the extension target itself (reliable signing/embedding). In
`ios/App/App.xcodeproj`:

1. File → New → Target… → **Widget Extension**.
   - Product name: **BaseWidget** (exactly — it matches the pre-written folder).
   - UNCHECK "Include Live Activity"; CHECK "Include Configuration App Intent".
   - Embed in Application: App. Activate the scheme when asked.
2. Xcode generates template files inside `BaseWidget/` — **delete the
   generated `.swift` files that duplicate ours** (keep `BaseWidgetBundle`,
   `BaseTimelineProvider`, `BaseWidgetView`, `SelectBaseIntent`,
   `WidgetManifest` from this repo; the folder is synchronized, so they're
   already in the target).
3. BaseWidget target → General: iOS Deployment Target **17.0**.
4. BaseWidget target → Signing & Capabilities: set your team; add capability
   **App Groups** → `group.com.example.asteroidzen.widgets`; set the
   entitlements file to `BaseWidget/BaseWidget.entitlements` if not picked up.
5. App target → Signing & Capabilities: set your team; add the same App Group
   (the file `App/App.entitlements` is already wired via
   `CODE_SIGN_ENTITLEMENTS`).
6. Run the App scheme on a device/simulator, establish a base, background the
   app (this writes the feed), then add the **Base Window** widget; long-press
   → Edit Widget → pick an outpost; tap it to jump into that base.

## Before store submission

- **Rename the placeholder bundle id** `com.example.asteroidzen`. It's
  embedded in: `capacitor.config.json`, `android/app/build.gradle`
  (namespace + applicationId) and the Java package dirs, iOS
  `PRODUCT_BUNDLE_IDENTIFIER`, and the App Group string in THREE files —
  `ios/App/App/WidgetFeedPlugin.swift`, `ios/App/BaseWidget/WidgetManifest.swift`,
  and both `.entitlements` files. The URL scheme `asteroidzen` can stay.

## Design notes / limits

- Widgets cannot animate (OS limitation) — "active weather" means each frame
  shows the true weather/day state for its timestamp, swapped every ~30 min
  (iOS timeline; Android ≤15-min lag from WorkManager).
- Planet days run ~24 real minutes, so consecutive frames sample about one
  in-game day apart. If that ever reads oddly, densify the iOS timeline by
  lowering `STEP_MS` in `widgetFeed.js` — timeline entries are budget-free.
- Feed freshness: frames cover ~6 h. Past the last frame the widget holds the
  final image (silo numbers stay correct regardless); it refreshes the moment
  the app is opened again.
