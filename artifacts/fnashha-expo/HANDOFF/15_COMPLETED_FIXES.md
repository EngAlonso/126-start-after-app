# 15 — Completed Fixes

---

> This file records all verified bug fixes. Append new entries at the bottom of the relevant section when you fix something. Never delete entries — mark superseded ones with `[SUPERSEDED]`.

---

## Audio Playback

### Fix: Missing audio player in Request Detail
**Problem:** `RequestInfoCard` (inside `app/requests/[id].tsx`) had no UI or logic for `request.audioUrl`. Audio attached to a service request was silently ignored on native.

**Fix:** Added `expo-av` Audio.Sound playback:
- `useRef<Audio.Sound | null>(null)` + `useState(isPlaying)`
- `useEffect` cleanup calls `soundRef.current?.unloadAsync()`
- `handleAudioToggle`: first press → `setAudioModeAsync` + `createAsync({ shouldPlay: true })`; subsequent → `pauseAsync` / `playAsync`
- URL resolved: relative `/uploads/...` paths prepended with `apiUrl()`

**File:** `app/requests/[id].tsx` — `RequestInfoCard` sub-component

---

### Fix: Missing audio preview in Create-Request form
**Problem:** After recording/selecting audio in the service request form, there was no playback preview. Only a filename + remove button were shown.

**Fix:** Added `previewSoundRef` + `isPreviewPlaying` state + `handlePreviewToggle`. Extended cleanup `useEffect` to unload `previewSoundRef`. Added play/pause button beside filename.

**File:** `app/services/[id].tsx`

---

### Fix: Live recordings saved as `.bin` instead of `.m4a`
**Problem:** Recordings made using `Audio.Recording` had filename `'تسجيل صوتي مباشر'` (no extension). The file storage layer fell back to `.bin`, which is served as `application/octet-stream` — iOS and Android media players reject this MIME type silently.

**Fix:** Changed recording filename to `'voice_recording.m4a'` in `handleStopRecording` call. File-picked audio was unaffected (already had correct extensions).

**File:** `app/services/[id].tsx`

---

## RTL Layout

### Fix: Screens rendering LTR on Expo Web
**Problem:** `I18nManager.forceRTL(true)` in `_layout.tsx` has no effect on Expo Web. All screens appeared left-to-right on web.

**Fix:** Added `direction: 'rtl' as any` to the outermost `<View>` of every screen.

**Files:** All screen files under `app/` (applied during RTL audit pass, July 2026)

---

### Fix: `RequestCard` white rectangle (Android)
**Problem:** `RequestCard` used a semi-transparent `cardBg` tint (`accent.bg + '08'`) which caused Android's elevation shadow layer to bleed through as a white rectangle.

**Fix:** Changed `cardBg = outerBg` (opaque, same as the outer background). Always declare `outerBg` before `cardBg` in variable order.

**File:** `components/RequestCard.tsx`

---

### Fix: `RequestInfoCard` not receiving `showPhone`
**Problem:** `RequestInfoCard` is a sub-component function declared in the same file as `RequestDetailScreen`. Sub-component function declarations do not close over the parent's render-time locals. `showPhone` was being computed in the parent but not passed down, causing non-selected technicians to see phone numbers they shouldn't.

**Fix:** Added `showPhone` as an explicit prop on `RequestInfoCard`:
```tsx
<RequestInfoCard request={request} colors={colors} showPhone={showPhone} />
```

**File:** `app/requests/[id].tsx`

---

## Android Elevation / White Rectangle

### Fix: Multiple cards showing white rectangles on Android
**Problem:** Several cards used `elevation > 0` with no `backgroundColor`, or with `overflow: 'hidden'` on the same `View` as `elevation`. Android draws the elevation shadow behind the view's background — when transparent or clipped, it renders as a white rectangle.

**Fixes applied (July 2026):**

| File | Change |
|---|---|
| `components/HowToRequest.tsx` | `howSectionOuter`: removed `overflow:hidden`, added `backgroundColor` |
| `app/(customer)/account.tsx` | `profileOuter`: `backgroundColor: '#FFFBEB'` |
| `app/(customer)/my-page.tsx` | `emptyCard`: `backgroundColor: '#FFFBEB'` |
| `app/tech-ratings.tsx` | Split `summaryCard` → outer (elevation+bg) + inner LinearGradient (overflow:hidden, no elevation) |
| `app/(technician)/index.tsx` | `recentStyles.wrapper`: `backgroundColor: theme.gradStart` |
| `app/(technician)/my-page.tsx` | `cardStyles.wrapper`: `backgroundColor: theme.gradStart` |

---

## Chat

### Fix: Stale closure in chat send mutation (React Query v5)
**Problem:** Sending a message and then seeing an empty string sent to the backend. Root cause: React Query v5 propagates new `mutationFn` closures on re-render. When `onMutate` called `setText('')`, the component re-rendered before the retryer invoked `mutationFn`, replacing the captured `text` value with `''`.

**Fix:** Passed `text.trim()` as an explicit mutation variable instead of capturing it in the `mutationFn` closure:
```ts
mutationFn: (content: string) => apiFetch(url, { body: JSON.stringify({ content }) }),
mutate(text.trim());  // snapshot before onMutate fires
```

**File:** `app/messages/[requestId].tsx`

---

### Fix: Message delivered state (`is_delivered`)
**Problem:** Chat messages had no delivery confirmation (double-tick ✓✓). The `is_delivered` column, deliver-all route, and `messages_delivered` SSE event were missing.

**Fix:** Added:
- `is_delivered` column on `messages` table (backend migration)
- `POST /api/messages/:requestId/deliver` route
- `messages_delivered` SSE event handler in `useSse.ts`
- `MessageTick` component for ✓ / ✓✓ UI

**Files:** `hooks/useSse.ts`, `app/messages/[requestId].tsx`, `components/MessageTick.tsx`

---

## Authentication

### Fix: Logout leaves protected routes accessible via Back
**Problem:** After logout, `router.replace('/')` could leave protected stack screens accessible through the OS back gesture. Additionally, the guest root's cold-launch intro check could replay the intro after logout.

**Fix:** After `await logout()`:
1. Mark intro as handled for the current JS session.
2. Dismiss the existing navigation stack.
3. Replace route with `/`.

**File:** `app/(customer)/account.tsx`, `app/(technician)/account.tsx`

---

## Notifications

### Fix: Rating notification routing
**Problem:** Rating-related push notifications (type `status_change`, title `"تقييم جديد"`) were routed to the generic notifications screen instead of the technician ratings screen.

**Fix:** Added special-case check in `notificationRouter.ts`:
```ts
if (type === 'status_change' && title === 'تقييم جديد') return '/tech-ratings';
```

**File:** `lib/notificationRouter.ts`

---

## Focus Refresh

### Fix: Screens showing stale data after returning from a sub-screen
**Problem:** React Query's 30-second `staleTime` meant screens didn't refetch when the user navigated back.

**Fix:** Implemented `useRefetchOnFocus` hook and called it on all 15 main screens. The hook uses `useFocusEffect` with a `hasMountedRef` to skip the initial mount (avoiding double-fetch).

**Coverage:** `(customer)/index`, `(customer)/my-page`, `(customer)/requests`, `(technician)/index`, `(technician)/my-page`, `(technician)/requests`, `(technician)/wallet`, `notifications`, `customer-wallet`, `tech-ratings`, `messages/index`, `services/index`, `referral`, `app/index`

**File:** `hooks/useRefetchOnFocus.ts` (new hook)

---

## Intro Slideshow

### Fix: CMS-driven intro screens
**Problem:** Intro slideshow used only hardcoded slides from `constants/intro.ts`.

**Fix:** Backend serves `GET /api/intro-screens`. Frontend fetches and caches result under key `fnashha_intro_urls_v1` in `localStorage` (web) / `AsyncStorage` (native). Falls back to hardcoded slides if the API is unreachable.

**File:** `app/intro.tsx`

---

## CORS

### Fix: Expo Web preview "Failed to fetch"
**Problem:** Expo Web preview runs on a different `*.replit.dev` subdomain from the API server. All API calls failed with "Failed to fetch" due to missing CORS headers.

**Fix:** Added `devReplitPattern` regex to the API server's CORS config:
```ts
/^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.replit\.dev$/
```
Allows any `*.replit.dev` subdomain in dev mode. In production, `CORS_ORIGIN` must be set explicitly.

**File:** `artifacts/api-server/src/app.ts`

---

*Last updated: July 2026*
