---
name: Fnashha Expo push notifications
description: Full push notification implementation for the Expo mobile app — architecture, platform routing, and production prerequisites.
---

## Architecture

- **Android / web tokens** → FCM HTTP v1 API (`sendFcmMessage`)
- **iOS tokens** → APNs HTTP/2 API (`sendApnsMessage` using `node:http2`)
- Platform is stored in `push_tokens.platform` column (`android` / `ios` / `web`)
- `dispatchPushToUsers(userIds, payload)` reads push_tokens table and routes by platform

## Token registration (Expo side)

- `hooks/usePushNotifications.ts` — permission request, `getDevicePushTokenAsync()` for native FCM/APNs tokens (NOT Expo push token), registers at `POST /api/push-tokens`, exports `deregisterPushTokens(accessToken)`
- Called inside `AuthGate` in `app/_layout.tsx`; no-op on web
- Tokens are deregistered **before** `logout()` in both account screens (while accessToken is still valid)

## Notification handler wiring (`app/_layout.tsx`)

- `Notifications.setNotificationHandler({...})` — module-level, foreground display config
- `createAndroidChannel('fnashha_default', ...)` — called once on mount in `RootLayout`
- `Notifications.getLastNotificationResponseAsync()` — cold-start tap handler in `AuthGate`, fires after `isLoading` resolves
- `Notifications.addNotificationResponseReceivedListener(...)` — background/foreground tap handler in `AuthGate`, re-bound when `user.role` changes

## Notification routing

- `lib/notificationRouter.ts` — single source of truth for push data → route mapping
  - `getRouteFromPushData(data, role)` — used by push tap handlers in `_layout.tsx`
  - `getRouteFromDbNotification(type, relatedId, role, title?)` — used by `notifications.tsx` screen
- `notifications.tsx` uses `getRouteFromDbNotification` (removed old local `getNotifPath`)

## New push notification types (backend)

Five types added to `notification-service.ts` that previously had DB notifications but no push:
- `notifyPriceChangeRequested` — called in `requests.ts` after price adjustment insert
- `notifyPriceApproved` — called in `requests.ts` after approve branch
- `notifyPriceRejected` — called in `requests.ts` after reject branch
- `notifyWaitingApproval` — called in `requests.ts` after waiting_approval status update
- `notifyNewRating` — called in `ratings.ts` after rating notification insert
- `notifySupportReply` — called in `support.ts` after support reply notification insert

All push calls are wrapped in `try {}catch {}` — fail-silent, never blocking the main response.

## FCM payload change

Removed `click_action: "FLUTTER_NOTIFICATION_CLICK"` from the Android FCM notification object — it was Flutter-specific and wrong for Expo/React Native.

## Android channel

Channel ID: `fnashha_default` — must match `channel_id` in FCM payload (it does).
Created programmatically at app startup via `setNotificationChannelAsync`.

## iOS APNs — production prerequisites

Required env vars (not set by default, must be added by user):
- `APNS_TEAM_ID` — 10-char Apple Developer Team ID
- `APNS_KEY_ID` — Key ID of the .p8 auth key
- `APNS_P8_KEY` — full PEM content of the .p8 file (with newlines)
- `APNS_BUNDLE_ID` — `com.fnashha.app`

Without these, iOS push is silently skipped (logged as warning). Android push is unaffected.

APNs JWT is cached and reused for up to 50 minutes (Apple allows up to 60 min).
Uses sandbox endpoint in non-production; production endpoint otherwise.

## Android — production prerequisites

- `google-services.json` must be placed at `artifacts/fnashha-expo/google-services.json`
- Referenced in `app.json` as `"googleServicesFile": "./google-services.json"` (add when file is available)
- Required for production EAS builds; dev preview (Expo Go) uses the shared Expo FCM project

## Notification icon

`app.json` plugin uses `adaptive-icon.png` as the push notification icon. For production, a dedicated monochrome PNG at `assets/images/notification-icon.png` is recommended (Android silhouette icon).

**Why:**  Android 5+ renders notification icons as white silhouettes; colored images appear as a white square.
