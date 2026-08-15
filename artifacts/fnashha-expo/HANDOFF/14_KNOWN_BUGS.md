# 14 — Known Bugs

---

> This file documents **pre-existing and open issues** — bugs that were present at the time of writing and have NOT yet been fixed. For bugs that have already been resolved, see `15_COMPLETED_FIXES.md`.

---

## Pre-Existing TypeScript Noise (Baseline)

The project has a set of pre-existing TypeScript warnings and errors that were present before any session-specific changes. These are **not regressions** introduced by recent work.

When running `npx tsc --noEmit` or similar:

- Treat any errors present in a clean checkout (before your changes) as baseline noise.
- Use `git stash` before attributing a TypeScript error to your session's changes.
- Do NOT attempt to fix all baseline TypeScript errors in a single session — they are numerous and some may be intentional (e.g., `as any` casts for RTL `direction` style).

### Common Sources of Baseline Noise
- `direction: 'rtl' as any` on `View` styles — expected, safe.
- Unused variable warnings in large screens (`requests/[id].tsx` ~2300 lines).
- Loosely typed API response shapes (some endpoints return `any`).

---

## iOS Safari / Cross-Origin SecurityError

**Symptom:** App crashes or throws `SecurityError` on iOS Safari in cross-origin iframes when calling web push APIs.

**Root Cause:** `'PushManager' in window` and `'Notification' in window` throw a `SecurityError` on iOS Safari when called inside a cross-origin iframe — the browser actively blocks access to these properties.

**Status:** Fixed in `hooks/usePushNotifications.ts` for the push registration flow. If you add any NEW code that checks for push support, you MUST use the guarded pattern:

```ts
// ✅ CORRECT — always wrap in try/catch AND useMemo
const isWebPushSupported = useMemo(() => {
  try {
    return 'PushManager' in window && 'Notification' in window;
  } catch {
    return false;
  }
}, []);

// ❌ WRONG — calling raw in render body throws SecurityError on iOS Safari
if ('PushManager' in window) { ... }
```

---

## Expo Web — `I18nManager` No-Op

**Symptom:** RTL layout breaks on Expo Web — flex rows appear LTR even though `I18nManager.forceRTL(true)` is set in `_layout.tsx`.

**Root Cause:** `I18nManager` is a React Native API with no effect on the web runtime.

**Status:** Resolved for all existing screens by adding `direction: 'rtl' as any` to every screen root. If a **new screen** is added without this explicit `direction`, it will appear LTR on Expo Web.

**Ongoing Risk:** Any developer who adds a new screen and forgets `direction: 'rtl'` will reintroduce this bug on web. See `12_RTL_GUIDE.md` for the checklist.

---

## Android SDK Not Available in Replit Workspace

**Symptom:** Running `npx expo run:android` or attempting a local APK build in the Replit environment fails with missing Java / Gradle / adb errors.

**Root Cause:** The Replit workspace does not have the Android SDK, JDK, or Gradle toolchain installed.

**Status:** Known environment limitation. Use EAS Build (cloud) for APK/AAB generation. Metro/Expo Go can still run the JS app without these tools.

---

## Stale Data After Tab Switch (Mitigated)

**Symptom:** Returning to a tab after navigating away can show stale data for up to 30 seconds (React Query's default `staleTime`).

**Mitigation:** `useRefetchOnFocus` is implemented on all 15 main screens and refetches queries on every focus event. The first mount is skipped to avoid double-fetching.

**Residual Risk:** Any new screen that uses `useQuery` but does NOT call `useRefetchOnFocus` will exhibit this behavior. See `18_AGENT_NOTES.md`.

---

## Conversation List — Raw snake_case Response

**Symptom:** If a developer adds a new field from `GET /api/conversations` and accesses it with camelCase, it silently returns `undefined`.

**Root Cause:** `GET /api/conversations` uses `db.execute(sql`...`)` on the backend and returns raw snake_case keys. The `toConversation()` mapping function in `app/messages/index.tsx` must be updated whenever a new field is consumed.

**Status:** Open design issue — the endpoint could be refactored to use Drizzle ORM for automatic camelCase, but this would require backend changes.

---

## No `voice` Message Type in DB Enum

**Symptom:** Attempting to send a message with `type: 'voice'` fails silently or with a DB error.

**Root Cause:** The `message_type` database enum only includes: `text`, `image`, `audio`. There is no `voice` type. Audio messages (including voice recordings) must use `type: 'audio'`.

**Status:** Known constraint. Do not add `'voice'` to the frontend type without a matching backend migration.

---

## Referral Link Short URLs (`/r/:code`) — Web Only

**Symptom:** Tapping a `fnashha-expo://r/CODE` deep link on mobile may not navigate to the referral screen in all cases, depending on whether the app is installed and how the OS handles custom schemes.

**Status:** Deep-link routing is implemented in `lib/notificationRouter.ts` and `_layout.tsx`. Testing required on both iOS (Universal Links) and Android (App Links) for production release. Expo Router `+not-found.tsx` handles unmatched routes gracefully.

---

*Last updated: July 2026*
