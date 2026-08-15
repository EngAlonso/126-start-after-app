---
name: Android FCM channel lifecycle
description: Native Android notification channels must exist before FCM can display a notification while the app process is stopped.
---

Create channels used by FCM in `Application.onCreate`, not only from JavaScript startup. Manifest default-channel metadata names a channel but does not create it; JS-only creation is too late for fresh installs and terminated-state delivery.

**Why:** Android may receive and render an FCM notification without starting React Native. A message targeting a missing Android 8+ channel cannot be shown.

**How to apply:** Keep the native channel ID, backend `channel_id`, Expo config `defaultChannel`, and JS channel setup identical. Use idempotent `NotificationManager.createNotificationChannel`.