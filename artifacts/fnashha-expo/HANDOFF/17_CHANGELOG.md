# 17 — Changelog

---

> Record session-by-session changes here. Each entry should include: date, what changed, which files were affected. Append new sessions at the bottom. Never delete entries.

---

## July 2026 — Initial Expo App Build

### Overview
Full Expo React Native app built from scratch. Covers all customer and technician flows.

### What Was Built

**Foundation**
- Monorepo structure: `artifacts/fnashha-expo/` as a pnpm workspace package
- Expo Router v4 file-based navigation with role-based AuthGate
- `AuthContext` with JWT access + refresh tokens, 401 auto-retry handler
- `ThemeContext` with dark/light toggle persisted to AsyncStorage
- Cairo Arabic font loading via `expo-font`
- Custom `PersistentTabBar` (renders customer + technician tab bars from root layout)

**Customer Screens**
- Guest home (`app/index.tsx`) — service browse + banner slider
- Login + registration (`login.tsx`, `register.tsx`, `register-select.tsx`)
- Customer tabs: Home, My Page, Requests, Account
- Request submission form (`services/[id].tsx`) — full form with audio, images, area selection, coupon/coins
- Request detail (`requests/[id].tsx`) — ~2300 lines, dual customer/technician view
- Conversations list + chat screen (`messages/index.tsx`, `messages/[requestId].tsx`)
- Customer wallet (`customer-wallet.tsx`) + referral (`referral.tsx`)
- Support tickets (`support/index.tsx`, `support/new.tsx`, `support/[id].tsx`)
- Notifications (`notifications.tsx`)
- Intro slideshow (`intro.tsx`)

**Technician Screens**
- Technician registration (`register-tech.tsx`) — service cards, multi-area selection
- Technician tabs: Home, My Page, Requests, Wallet, Account
- Technician requests (3 tabs: pending / active / done)
- Technician wallet with points balance, transaction history, filter chips
- Tech ratings screen (`tech-ratings.tsx`)
- Public technician profile (`technician-profile/[techId].tsx`)

**Shared Components**
- `AppHeader`, `AppLogo`, `AppTextInput`, `BannerSlider`
- `RequestCard` (alternating accent colors, two-layer elevation)
- `SkeletonCard`, `SkeletonList`, `RequestCardSkeletonList`
- `EmptyState`, `ErrorBoundary`, `ErrorFallback`
- `ConfirmDialog` + `useConfirm`
- `StarRating`, `MessageTick`, `ReferralCard`, `CoinsCard`
- `SearchableSelect`, `KeyboardAwareScrollViewCompat`

**Hooks and Utilities**
- `useSse.ts` — SSE real-time (web: EventSource; native: XHR+onprogress)
- `usePushNotifications.ts` — FCM/APNs registration with deduplication guards
- `useRefetchOnFocus.ts` — focus-triggered refetch for all 15 list screens
- `useApi.ts` — `apiFetch`, `apiUpload`, `useAuthedFetch`
- `lib/notificationRouter.ts` — notification type → screen path mapping
- `lib/fmt.ts` — Arabic locale formatters

---

## July 2026 — Bug Fix Session 1: RTL, Android White Rectangles, Audio

### RTL Fixes
- Added `direction: 'rtl' as any` to all screen root Views
- Fixed `RequestInfoCard` — `showPhone` now passed as explicit prop
- Fixed `RequestCard` — `cardBg = outerBg` (opaque) eliminates Android artifact

### Android Elevation / White Rectangle
- Fixed 6 card components (see `15_COMPLETED_FIXES.md` for full list)
- Established two-layer pattern: outer View (elevation + bg) + inner LinearGradient (overflow:hidden)

### Audio Playback
- Added audio player UI to `RequestInfoCard` in `requests/[id].tsx`
- Added audio preview to create-request form in `services/[id].tsx`
- Fixed recording filename: `'voice_recording.m4a'` replaces no-extension fallback

### Dark Mode
- Fixed technician wallet LinearGradient card — `isDark`-aware color pairs to prevent invisible text

---

## July 2026 — Bug Fix Session 2: Chat, Notifications, SSE, Auth

### Chat
- Fixed stale-closure mutation bug (React Query v5) — pass content as mutation variable, not closure
- Added message delivered state: `is_delivered` column, deliver-all route, `messages_delivered` SSE event, `MessageTick` component

### Notifications
- Fixed rating notification routing → `/tech-ratings` for `status_change` + title `"تقييم جديد"`
- Added cold-start push notification handler (`getLastNotificationResponseAsync`)
- Added deduplication guards (`inFlightRef`, `lastHandledIdRef`)

### SSE
- Confirmed `useUserEvents()` must be CALLED in both customer and technician layout components

### Auth / Navigation
- Fixed logout: added intro-mark + stack-dismiss before `router.replace('/')`

---

## July 2026 — Feature Session: Focus Refetch + Intro Slideshow

### Focus Refetch
- Created `hooks/useRefetchOnFocus.ts`
- Applied to all 15 main screens

### Intro Slideshow
- Backend: `GET /api/intro-screens` endpoint
- Frontend: `app/intro.tsx` fetches CMS slides, caches under `fnashha_intro_urls_v1`
- Falls back to hardcoded `constants/intro.ts` slides if API is unreachable

---

## July 2026 — Fix: CORS for Expo Web Preview

- Added `devReplitPattern` regex to API server CORS config
- Allows `*.replit.dev` subdomains in dev mode
- Fixed "Failed to fetch" errors in Expo Web preview on Replit

**File:** `artifacts/api-server/src/app.ts`

---

## July 2026 — HANDOFF Knowledge Base Created

- Created `HANDOFF/` folder in `artifacts/fnashha-expo/`
- Migrated content from `FNASHHA_EXPO_HANDOFF.md` into structured topic files
- Wrote files `00_INDEX.md` through `18_AGENT_NOTES.md`

---

*Last updated: July 2026*
