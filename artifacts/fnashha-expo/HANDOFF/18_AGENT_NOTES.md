# 18 — Agent Notes

---

> Read this file before making any significant change. It contains the sharpest edges, most non-obvious decisions, and common pitfalls discovered across all sessions.

---

## 1. React Query v5 Stale-Closure Mutation Bug

**This is the #1 silent failure in the codebase.**

React Query v5 propagates new `mutationFn` closures to the running mutation on every re-render (`MutationObserver.setOptions()` → `currentMutation.setOptions()`). If `onMutate` calls `setState`, the component re-renders before the retryer invokes `mutationFn` — the closure is replaced with the new one (which has stale/cleared state).

**Rule:** Never capture mutable state in `mutationFn` via closure. Always pass it as mutation variables.

```ts
// ❌ WRONG — text will be '' when mutationFn actually executes
const mutation = useMutation({
  mutationFn: () => apiFetch(url, { body: JSON.stringify({ content: text }) }),
  onMutate: () => { setText(''); },
});
mutation.mutate();

// ✅ CORRECT — content is snapshot before onMutate fires
const mutation = useMutation({
  mutationFn: (content: string) => apiFetch(url, { body: JSON.stringify({ content }) }),
  onMutate: (content: string) => { setText(''); },
  onError: (err, content) => { /* restore optimistic entry, show Alert */ },
});
mutation.mutate(text.trim());
```

Always include an `onError` handler that removes the optimistic entry and shows a user-facing error (`Alert.alert`).

---

## 2. RTL on Expo Web is NOT Handled by I18nManager

`I18nManager.forceRTL(true)` (set in `app/_layout.tsx`) is a no-op on Expo Web. Every screen root View must include:

```tsx
<View style={{ flex: 1, backgroundColor: colors.background, direction: 'rtl' as any }}>
```

Without this, new screens render LTR on web. See `12_RTL_GUIDE.md` for the full checklist.

---

## 3. Android Elevation + Transparent Background = White Rectangle

Never put `elevation > 0` on a `View` with no `backgroundColor`. Never put `elevation` and `overflow: 'hidden'` on the same `View`.

The correct pattern is always two layers:
- **Outer `View`:** `elevation`, `borderRadius`, explicit `backgroundColor` (gradient start color)
- **Inner `LinearGradient`:** `borderRadius`, `padding`, `overflow: 'hidden'`

See `11_UI_DESIGN_RULES.md` for the full pattern and the list of files already fixed.

---

## 4. Audio Files Must Have an Extension

Passing a filename without an extension to the upload function causes the server to save it with a `.bin` extension. `express.static` then serves it as `application/octet-stream`. iOS AVPlayer and Android MediaPlayer silently reject this MIME type — the file plays fine in a browser but not on native.

**Rule:** Always use `'voice_recording.m4a'` (or any named extension) as the recording filename. Never use a display string like `'تسجيل صوتي مباشر'` as the filename.

---

## 5. Audio Playback: Always Call `setAudioModeAsync` First

Before creating an `Audio.Sound` for playback on iOS:

```ts
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
});
const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
```

Without `playsInSilentModeIOS: true`, audio is silent when the iOS device is in silent mode.

Always unload sounds in `useEffect` cleanup:
```ts
return () => { soundRef.current?.unloadAsync().catch(() => {}); };
```

---

## 6. SSE on Native Uses XHR, Not EventSource

React Native does not have a built-in `EventSource`. `useSse.ts` uses `XMLHttpRequest` with `onprogress` for true streaming on native. Do not install a polyfill package — the custom XHR implementation in `useSse.ts` handles reconnection and is already integrated.

On reconnect, the handler calls `queryClient.invalidateQueries()` with **no arguments** — a full cache refresh. This is intentional; do not change it to targeted key invalidations without testing all SSE-driven screens.

---

## 7. `useUserEvents()` Must Be CALLED, Not Just Imported

The SSE hook must be **called** (not just imported) inside both:
- `app/(customer)/_layout.tsx`
- `app/(technician)/_layout.tsx`

Omitting the call silences all real-time events for that role. This is easy to miss when adding a new role or layout.

---

## 8. Conversations API Returns snake_case

`GET /api/conversations` uses `db.execute(sql`...`)` — a raw SQL join — and returns snake_case keys, unlike every other endpoint which uses Drizzle ORM's camelCase output.

The `toConversation(raw, myId)` function in `app/messages/index.tsx` maps this to the `Conversation` type. If you add a new field from this endpoint, update both:
1. The SQL query (backend)
2. The `toConversation` mapping function (frontend)

---

## 9. `useRefetchOnFocus` Must Be Added to New Screens

Every screen with `useQuery` should call:
```ts
useRefetchOnFocus([refetchFn1, refetchFn2]);
```

Without it, the screen will show stale data for up to 30 seconds (React Query's `staleTime`) after the user navigates back to it. The hook skips the initial mount to avoid double-fetching.

---

## 10. iOS Safari / Cross-Origin — Push API Guard

In Expo Web, cross-origin iframes (e.g., preview frames in Replit) actively throw `SecurityError` when accessing `'PushManager' in window` or `'Notification' in window`. Always wrap in both a `try/catch` AND `useMemo`:

```ts
const isWebPushSupported = useMemo(() => {
  try { return 'PushManager' in window && 'Notification' in window; }
  catch { return false; }
}, []);
```

Never call this check raw in the render body.

---

## 11. Blob Approach for File Uploads (Required)

The `{ uri, type, name }` FormData shorthand fails on Expo Web and can send wrong MIME types on iOS for HEIC photos. Always use the Blob fetch approach:

```ts
const fileResponse = await fetch(asset.uri);
const blob = await fileResponse.blob();
const jpegBlob = blob.slice(0, blob.size, 'image/jpeg');
const formData = new FormData();
formData.append('file', jpegBlob, 'photo.jpg');
```

Do NOT set `Content-Type` manually on the `apiUpload` call — let the runtime set it with the multipart boundary.

---

## 12. `RequestInfoCard` `showPhone` Must Be a Prop

`RequestInfoCard` is a sub-component function declared inside `app/requests/[id].tsx`. It does **not** close over `RequestDetailScreen`'s render-time locals — it is a separate function declaration.

The phone-privacy boolean (`showPhone = isCustomer || isSelectedTech`) must be computed in the parent and passed as an explicit prop. Without this, non-selected technicians see real phone numbers.

---

## 13. Logout Navigation — Three-Step Sequence

After `await logout()`, always:
1. Mark intro as handled (prevent replay on the next guest root mount).
2. Dismiss the navigation stack (`router.dismissAll()` or equivalent).
3. Replace with the guest root (`router.replace('/')`).

A plain `router.replace('/')` alone leaves protected screens accessible via OS back gesture.

---

## 14. CORS — Expo Web Preview Uses Different Subdomain

The Expo dev server on Replit runs on a different `*.replit.dev` subdomain from the API server. Without the `devReplitPattern` regex in the API's CORS config, all Expo Web API calls fail silently with "Failed to fetch".

The fix is in `artifacts/api-server/src/app.ts`. Do not remove or narrow the `devReplitPattern` regex in dev mode.

---

## 15. Tab Bar Heights Are Exported Constants

Always import and use:
```ts
import { TAB_BAR_HEIGHT } from '@/components/CustomerTabBar';
import { TECH_TAB_BAR_HEIGHT } from '@/components/TechnicianTabBar';
```

for `paddingBottom` on scroll content inside tab screens. Hardcoding a fixed number will break when the tab bar height changes.

---

## 16. No Admin Role in Mobile App

There is no admin role in the Expo app. Admin and staff actions are done via the React web frontend (`artifacts/fnashha/`). Do not add admin screens to the Expo app.

---

## 17. `requests/[id].tsx` Is Large (~2300 Lines) — Work Carefully

This is the largest and most critical file in the project. It serves both customer and technician views with conditional rendering. Before editing it:
1. Understand the full computed-booleans block (see `06_REQUEST_LIFECYCLE.md`).
2. Changes to `RequestInfoCard` sub-component require explicit props — see Agent Note #12.
3. Run a manual test for both customer and technician views after any change.

---

## 18. Baseline TypeScript Noise

Pre-existing TypeScript errors and warnings exist in the codebase. Before attributing any TypeScript error to your changes, run `git stash` and verify the error existed before. Do not attempt to fix all baseline TypeScript errors in one session.

---

*Last updated: July 2026*
