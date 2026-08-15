# Fnashha — Capacitor Native Build Setup Guide

This document explains how to complete the Android and iOS build setup
after cloning the project onto a machine with Android Studio or Xcode installed.

---

## Prerequisites

| Tool | Android | iOS |
|------|---------|-----|
| Node 20+ | ✅ | ✅ |
| pnpm | ✅ | ✅ |
| Android Studio (Ladybug+) | ✅ | ❌ |
| JDK 17 | ✅ | ❌ |
| Xcode 15+ | ❌ | ✅ |
| CocoaPods | ❌ | ✅ |
| macOS | ❌ | ✅ required |

---

## 1 — Set the API server URL

Copy `.env.capacitor` to `.env.capacitor.local` (never commit this file):

```bash
cp .env.capacitor .env.capacitor.local
```

Edit `.env.capacitor.local` and set `VITE_API_URL` to your deployed server:

```
VITE_API_URL=https://your-fnashha-server.replit.app
```

---

## 2 — Build the web assets

```bash
# From the artifacts/fnashha directory:
pnpm run build
```

Output goes to `dist/public/` — this is what Capacitor serves inside the WebView.

---

## 3 — Add native platforms (run once)

```bash
npx cap add android
npx cap add ios        # macOS only
```

---

## 4 — Merge Android permissions

Open `android/app/src/main/AndroidManifest.xml` and add the entries from
`capacitor-setup/android/AndroidManifest-permissions.xml` inside `<manifest>`.

Copy the network security config:
```bash
cp capacitor-setup/android/network-security-config.xml \
   android/app/src/main/res/xml/network-security-config.xml
```

Then reference it in `AndroidManifest.xml` inside `<application>`:
```xml
android:networkSecurityConfig="@xml/network_security_config"
```

---

## 5 — Merge iOS permissions

Open `ios/App/App/Info.plist` and add all `<key>/<string>` pairs from
`capacitor-setup/ios/Info-permissions.plist`.

Install CocoaPods dependencies:
```bash
cd ios/App && pod install && cd ../..
```

---

## 6 — Sync and open

```bash
npx cap sync android   # or: pnpm run cap:sync:android
npx cap open android   # opens Android Studio

npx cap sync ios       # or: pnpm run cap:sync:ios
npx cap open ios       # opens Xcode
```

---

## 7 — Build outputs

| Platform | Output | Command in IDE |
|----------|--------|---------------|
| Android Debug APK | `android/app/build/outputs/apk/debug/` | Build → Build APK |
| Android Release AAB | `android/app/build/outputs/bundle/release/` | Build → Generate Signed Bundle |
| iOS IPA | Xcode Archive | Product → Archive |

---

## API URL notes

In a native Capacitor build the WebView origin is:
- Android: `https://localhost`
- iOS: `capacitor://localhost`

All `/api/...` calls are automatically prefixed with `VITE_API_URL` by
`src/lib/capacitor-bridge.ts` via the `setBaseUrl()` mechanism in
`lib/api-client-react/src/custom-fetch.ts`.

**The web app is unaffected** — `initCapacitor()` is a no-op when
`window.Capacitor.isNativePlatform()` returns false.

---

## Safe-area / notch support

Already configured:
- `viewport-fit=cover` in `index.html`
- `env(safe-area-inset-*)` CSS variables in `src/index.css`
- StatusBar plugin configured in `capacitor.config.ts` with `overlaysWebView: false`

---

## Remaining steps before store submission

- [ ] Generate a signed keystore for Android release builds
- [ ] Configure Gradle `signingConfigs` with keystore details
- [ ] Create an Apple Developer team / Bundle ID for `com.fnashha.app`
- [ ] Set up App Store Connect listing
- [ ] Integrate Firebase (FCM) for push notifications
- [ ] Add app icons (1024×1024 PNG) for Play Store / App Store
- [ ] Add splash screen assets using `@capacitor/assets` CLI tool
