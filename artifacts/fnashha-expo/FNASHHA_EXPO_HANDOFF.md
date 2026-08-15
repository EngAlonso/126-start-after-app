# Fnashha Expo — Handoff Document

> Last updated: July 2026 | Expo SDK 53 | React Native (Hermes) | pnpm monorepo

---

## Project Overview

**Fnashha** (`فنشها`) is an Egyptian home-services marketplace. This document covers the **Expo mobile app** located at `artifacts/fnashha-expo/`.

The web frontend lives at `artifacts/fnashha/` and the shared Express+Drizzle API at `artifacts/api-server/`. The Flutter prototype is at `mobile/` (outside the artifacts tree).

---

## App Architecture

| Layer | Technology |
|---|---|
| Framework | Expo SDK 53 + Expo Router (file-based) |
| State | React Query v5 (server), React Context (auth/theme) |
| Styling | React Native StyleSheet + expo-linear-gradient |
| Fonts | Cairo (Arabic): 400, 500, 600, 700 weights |
| Icons | `@expo/vector-icons` Feather set |
| Auth | JWT access (15 min) + refresh tokens (30 days), stored in AsyncStorage |
| HTTP | Custom `apiFetch` / `apiUpload` in `hooks/useApi.ts` |
| Notifications | `expo-notifications` + APNs / FCM via backend |
| Audio/Image | `expo-av` (audio playback & recording), `expo-image-picker` |

### Route Structure

```
app/
  _layout.tsx          — root: AuthProvider + ThemeProvider + I18nManager RTL
  index.tsx            — guest home (browse services + banners)
  login.tsx            — login form
  register.tsx         — customer registration
  register-tech.tsx    — technician registration
  intro.tsx            — intro slideshow (CMS-driven)
  services/[id].tsx    — request form (submit a service request)
  requests/[id].tsx    — request detail (all statuses, customer + technician views)
  messages/
    index.tsx          — conversations list
    [requestId].tsx    — chat screen
  notifications.tsx    — notification list
  tech-ratings.tsx     — technician ratings page
  edit-profile.tsx     — profile edit (customer + technician)
  customer-wallet.tsx  — customer loyalty wallet
  support.tsx          — support tickets
  (customer)/
    index.tsx          — customer home
    my-page.tsx        — customer dashboard (active requests + loyalty)
    requests.tsx       — customer requests list (tabs)
    account.tsx        — customer account settings
  (technician)/
    index.tsx          — technician home
    my-page.tsx        — technician dashboard (stats + completed requests)
    requests.tsx       — technician requests list (pending / active / done)
    wallet.tsx         — technician points wallet
    account.tsx        — technician account + hero profile card
```

---

## Key Components

| Component | Location | Purpose |
|---|---|---|
| `RequestCard` | `components/RequestCard.tsx` | Request summary card; alternating amber/blue accents; two-layer elevation pattern |
| `AppHeader` | `components/AppHeader.tsx` | Role-aware header with back button + notification badge |
| `ScreenHeader` | `components/ScreenHeader.tsx` | Simple header for stack screens |
| `PersistentTabBar` | `components/PersistentTabBar.tsx` | Wraps CustomerTabBar + TechnicianTabBar |
| `BannerSlider` | `components/BannerSlider.tsx` | Auto-scroll banner carousel |
| `StarRating` | `components/StarRating.tsx` | Read-only star display |
| `EmptyState` | `components/EmptyState.tsx` | Consistent empty/error views |
| `SkeletonCard` | `components/SkeletonCard.tsx` | Loading skeletons (SkeletonList, RequestCardSkeletonList) |
| `ConfirmDialog` | `components/ConfirmDialog.tsx` | Cross-platform confirm/alert modal |

---

## RTL Layout

`I18nManager.allowRTL(true)` and `I18nManager.forceRTL(true)` are set at module level in `_layout.tsx`. This enables RTL for native builds.

**Important:** Expo Web does not support `I18nManager`. To ensure RTL works on ALL platforms (web + native), all screen root views and flex-row containers that need RTL must set `direction: 'rtl'` explicitly in their style.

### Screens with explicit `direction: 'rtl'` (applied):
- `components/RequestCard.tsx` — `cardInner` View
- `app/(technician)/my-page.tsx` — root View
- `app/(technician)/account.tsx` — root View
- `app/tech-ratings.tsx` — root View
- `app/(customer)/my-page.tsx` — root View
- `app/services/[id].tsx` — root View
- `app/requests/[id].tsx` — root View
- `app/messages/index.tsx` — root View
- `app/notifications.tsx` — root View

---

## Android White Rectangle Pattern

Android's elevation system causes a white rectangle when a View has both `elevation` > 0 AND `overflow: 'hidden'`. The pattern to avoid this:

```jsx
{/* Outer: elevation + opaque backgroundColor (NO overflow: 'hidden') */}
<View style={{ elevation: 4, borderRadius: 16, backgroundColor: '#FFFEF5' }}>
  {/* Inner: overflow:'hidden' for corner clipping (NO elevation) */}
  <LinearGradient style={{ borderRadius: 16, overflow: 'hidden' }}>
    {/* content */}
  </LinearGradient>
</View>
```

This pattern is used in: `RequestCard`, `TechnicianMyPage` stat cards, `TechRatings` summary card, `CustomerMyPage` loyalty cards.

---

## API Integration

- **Base URL:** resolved by `hooks/api-base.ts` via `apiUrl(path)`
- **Auth:** `Authorization: Bearer <accessToken>` header
- **Token refresh:** 401 responses auto-retry once via `getRefreshHandler()` in `AuthContext`
- **File uploads:** `apiUpload(path, formData, token)` — uses Blob/fetch approach for cross-platform reliability
- **SSE:** `useUserEvents()` hook in customer + technician layouts; reconnect = full cache invalidation

### Key Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/login` | Login → `{ accessToken, refreshToken, user }` |
| `POST /api/auth/refresh` | Refresh token rotation |
| `GET /api/requests?role=<role>&status=<csv>` | Request list |
| `GET /api/requests/:id` | Request detail (phone stripped for non-selected technicians) |
| `GET /api/conversations` | Conversation list (raw snake_case from SQL join) |
| `GET /api/notifications` | Notification list |
| `GET /api/points/balance` | Technician points balance |
| `GET /api/points/transactions` | Technician point transaction history |
| `GET /api/ratings/technician/:id` | Technician ratings |
| `POST /api/upload/user?category=<cat>` | Local file upload (profiles / requests / chat) |
| `PATCH /api/users/:id` | Update user profile |

---

## Phone Number Privacy

- Customer phone is hidden from technicians in the published request
- The backend strips `customer.mobile` for non-selected technicians on the `GET /api/requests/:id` response
- **Frontend gate:** `request.mobile` and `request.fullName` are only displayed when `isCustomer || isSelectedTech`
- Phone rows are tappable → opens native phone dialer via `Linking.openURL('tel:...')`

---

## Profile Image Upload

Upload uses a cross-platform Blob fetch approach to ensure the correct MIME type (`image/jpeg`) is sent regardless of the source file format (HEIC, WebP, etc.):

```js
const fileResponse = await fetch(asset.uri);
const blob = await fileResponse.blob();
const jpegBlob = blob.slice(0, blob.size, 'image/jpeg');
formData.append('file', jpegBlob, 'photo.jpg');
```

This works on iOS, Android, and Expo Web.

---

## Technician Requests Tabs

`app/(technician)/requests.tsx` has 3 tabs:
- Index 0: `pending` — تحتاج عرض (needs offer)
- Index 1: `active` — النشطة (active requests)
- Index 2: `done` — المنتهية (completed/cancelled)

Navigate to a specific tab: `router.push({ pathname: '/(technician)/requests', params: { initialTab: '2' } })`

The screen initializes `activeTab` state directly from the `initialTab` param and uses `initialScrollIndex` on the pager FlatList for reliable deep-linking.

---

## Dark Mode

- Theme: `ThemeContext` + `useColors()` hook
- Colors adapt automatically via `colors.background`, `colors.card`, `colors.foreground`, etc.
- **Wallet screen:** LinearGradient cards use `isDark`-aware color pairs to ensure readable text contrast

---

## Completed Changes (July 2026 Session)

### Part 0 — Handoff Document
Created this file.

### Part 1 — RTL Layout Direction
Added `direction: 'rtl'` explicitly to the root View (or the relevant flex container) of every screen/component listed below. This ensures RTL rendering on Expo Web (where `I18nManager` is a no-op) in addition to native:
- `components/RequestCard.tsx` — `cardInner` View
- `app/(technician)/my-page.tsx` — root View
- `app/(technician)/account.tsx` — root View
- `app/(technician)/wallet.tsx` — root View
- `app/tech-ratings.tsx` — root View
- `app/(customer)/my-page.tsx` — root View
- `app/services/[id].tsx` — root View
- `app/requests/[id].tsx` — root View
- `app/messages/index.tsx` — root View; also swapped `topRow` child order (name first → RIGHT in RTL, time last → LEFT in RTL) and `bottomRow` child order (preview first, badge last)
- `app/notifications.tsx` — root View

### Part 2 — Remove Inner White Rectangle on Request Cards
Changed `cardBg = outerBg` in `RequestCard.tsx` so the inner `cardInner` View always uses the same opaque color as the outer TouchableOpacity. The previous semi-transparent tint (`accent!.bg + '08'`) was imperceptible; removing it eliminates any Android elevation white-rectangle artifact.

### Part 3 — Functional Fixes

**3.1 — Phone privacy:** `request.mobile` and `request.fullName` are only rendered in `RequestInfoCard` when `showPhone = isCustomer || isSelectedTech`. Non-selected technicians see `'••••••••'` for the phone field and `'—'` for the name field.

**3.2 — Phone taps → native dialer:** `InfoGridItem` now accepts an optional `onPress` prop. When `showPhone` is true and `request.mobile` exists, tapping the phone cell calls `Linking.openURL('tel:' + number)`.

**3.3 — Technician wallet transaction history:** Transaction list correctly mapped via `TXN_META` (credit/debit/commission/release). No code change needed beyond the RTL direction fix.

**3.4 — "عرض المزيد" (More) tab navigation:** Replaced the `useEffect` + `setTimeout` + `scrollToIndex` approach with `useState(initTabIdx)` (tab indicator correct from first render) and `initialScrollIndex={initTabIdx}` on the pager FlatList (scroll position correct on mount). No flash, no race condition.

### Part 4 — Visual Improvements

**4.2 — Wallet dark mode:** LinearGradient in the available-points card now uses dark amber tones in dark mode (`['#1A1500', '#201C00']` / `['#2D1E00', '#1A1000']`). Text colors (`balanceNum`, `balanceSub`, `balanceHint`) use amber (`#E9B73A`, `#D97706`, `#B45309`) in dark mode so they're readable against the dark background.

**4.3 — Messages conversation list:** Fixed RTL child order in `topRow` (name RIGHT, time LEFT) and `bottomRow` (preview RIGHT/leading, badge LEFT/trailing).

**4.4 — Notifications:** Added `direction: 'rtl'` so the icon appears on the RIGHT (leading) and content on the LEFT, matching Arabic reading direction.

### Part 5 — Technician Account

**5.1 — Hero card yellow band overflow:** Added `overflow: 'hidden'` to `heroBand` in `account.tsx`. This clips the `heroBandCurve` (which extends -20px past each edge) safely because `heroBand` has no elevation.

**5.2 — Bottom nav overlap:** Increased ScrollView `paddingBottom` from `TECH_TAB_BAR_HEIGHT + insets.bottom + 24` to `+ 48` to prevent the last menu item from being obscured by the tab bar.

### Part 6 — Profile Image Upload Fix
`edit-profile.tsx` now fetches the picked image as a `Blob` via `fetch(asset.uri)` and uses `blob.slice(0, blob.size, 'image/jpeg')` to force `Content-Type: image/jpeg`. This is cross-platform reliable — native FormData ignores the `type` field on some Android versions; Expo Web rejects the `{uri, type, name}` shorthand entirely.

---

## Build Notes

- **Metro bundler:** `pnpm --filter @workspace/fnashha-expo run dev`
- **Expo Go:** scan QR code from the Expo dev server
- **Android APK:** requires Java 17, Android SDK 34, Gradle; run `nix-shell -p flutter` for tooling on Replit
- **iOS:** requires Xcode + APNs certificates for push notifications
- **Environment vars:** `API_BASE_URL` set via Expo's `app.config.js` extra or `EXPO_PUBLIC_API_BASE_URL`
