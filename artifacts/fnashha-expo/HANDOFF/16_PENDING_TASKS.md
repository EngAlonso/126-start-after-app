# 16 — Pending Tasks

---

> This file tracks future work, backlog items, and improvement ideas. Move items to `15_COMPLETED_FIXES.md` when done. Append new items at the bottom of each section.

---

## High Priority

### P1 — Verify Deep Links on iOS and Android (Production)
**What:** Referral short links (`/r/:code`) and push notification taps must route correctly on both platforms in production builds.

**Why:** Deep-link routing via custom scheme (`fnashha-expo://`) works in Expo Go but may fail on production builds without Universal Links (iOS) or App Links (Android) configuration.

**Steps:**
1. Configure Universal Links in `app.config.js` (`ios.associatedDomains`).
2. Configure App Links in `app.config.js` (`android.intentFilters`).
3. Test cold-start tap (app terminated) + warm tap (app in background) for all notification types.

---

### P2 — Add `onError` Handlers to All Mutations
**What:** Several `useMutation` calls are missing `onError` handlers. When they fail, optimistic updates disappear silently with no user feedback.

**Why:** The chat send mutation fix added an `onError` handler — the same pattern should be applied consistently across all mutations in the app.

**Affected screens (audit needed):** `services/[id].tsx`, `requests/[id].tsx`, `edit-profile.tsx`, `support/new.tsx`

---

### P3 — TypeScript Baseline Cleanup
**What:** Resolve or suppress pre-existing TypeScript warnings in the codebase.

**Why:** Baseline noise makes it harder to spot real type errors introduced by new code.

**Approach:** Run `npx tsc --noEmit`, categorize errors, and either fix or add targeted `// @ts-expect-error` with explanation comments. Do NOT use broad `as any` casts except for the established `direction: 'rtl' as any` pattern.

---

## Medium Priority

### M1 — Technician Service Modification Request Flow (Expo)
**What:** Technicians cannot edit their registered services or coverage areas directly — all changes must go through a modification request flow that an admin approves.

**Status:** The backend and web admin interface for this flow exist. The Expo mobile screens for technicians to submit modification requests are not yet built.

**Screens needed:**
- View current services + areas (read-only)
- Submit modification request (what to add / remove)
- View pending/approved/rejected modification requests

---

### M2 — Conversation List Refactor (snake_case → camelCase)
**What:** `GET /api/conversations` returns raw snake_case keys from a SQL join (`db.execute(sql`...`)`). The frontend `toConversation()` mapping is fragile — any new field must be manually added to the mapper.

**Ideal fix:** Refactor the backend endpoint to use Drizzle ORM's query builder, which returns camelCase keys automatically.

**Note:** Backend change required. Coordinate with API server changes.

---

### M3 — Pagination for Notifications and Transactions
**What:** `GET /api/notifications` and `GET /api/points/transactions` support `limit` but the Expo app does not implement infinite scroll / load-more. Long history lists are truncated at the default limit.

**Implementation:** Use TanStack Query's `useInfiniteQuery` + FlatList `onEndReached` callback.

---

### M4 — Offline Support / Error Boundaries Per Screen
**What:** Currently, network errors surface as console logs or silent failures on some screens. There is a global `ErrorBoundary` but no per-screen retry UI for query errors.

**Implementation:** Each `useQuery` call should handle `isError` state with an `EmptyState` (error variant) + retry button, using `refetch` from the query hook.

---

## Low Priority / Nice to Have

### L1 — Skeleton for Chat Screen
**What:** The chat screen (`app/messages/[requestId].tsx`) shows a blank view while messages load. A `SkeletonList` would improve perceived performance.

---

### L2 — Haptic Feedback on Key Actions
**What:** Add `expo-haptics` for:
- Sending a chat message (light impact)
- Selecting a technician offer (medium impact)
- Completing a job (success notification)

---

### L3 — Image Caching
**What:** Profile images and request images are re-fetched on every render. Use `expo-image` (which has built-in caching) instead of the standard `Image` from React Native.

---

### L4 — Pull-to-Refresh on All List Screens
**What:** Most screens fetch data on focus via `useRefetchOnFocus`, but not all support the standard pull-to-refresh gesture (`refreshControl` on `ScrollView`/`FlatList`).

**Audit needed:** Check which screens are missing `refreshControl` and add it.

---

### L5 — Accessibility (a11y) Pass
**What:** No `accessibilityLabel` props have been added to interactive elements. Required for compliance and for screen reader users.

**High-impact targets:** All `Pressable` / `TouchableOpacity` elements, especially those with icon-only content (no visible text label).

---

## Deferred (Requires Platform Decision)

### D1 — iOS App Store Submission
**Requires:** Apple Developer account, App Store Connect setup, screenshots in Arabic, App Review form submission.

### D2 — Google Play Submission
**Requires:** Google Play Console account, AAB build via EAS, store listing in Arabic.

### D3 — Analytics Integration
**What:** No analytics are currently instrumented. Options: Expo's built-in analytics, Firebase Analytics, Mixpanel.

---

*Last updated: July 2026*
