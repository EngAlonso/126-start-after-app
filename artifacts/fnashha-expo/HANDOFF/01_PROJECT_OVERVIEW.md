# 01 — Project Overview

---

## What Is Fnashha?

**Fnashha** (`فنشها`) is an Egyptian Arabic home-services marketplace connecting customers who need home repairs/services with verified technicians.

- Customers post service requests; technicians submit competing offers; customers select the best offer.
- Technicians earn points per completed job and spend points to submit offers.
- A loyalty coin system rewards customers for referrals and completed requests.

---

## Monorepo Context

This Expo app lives in a pnpm monorepo. The three artifacts that matter:

| Artifact | Directory | Purpose |
|---|---|---|
| **Expo Mobile App** | `artifacts/fnashha-expo/` | iOS + Android + Expo Web (this project) |
| **Web Frontend** | `artifacts/fnashha/` | React + Vite web app |
| **API Server** | `artifacts/api-server/` | Express + Drizzle ORM + PostgreSQL |
| Flutter Prototype | `mobile/` | Separate Flutter app (outside artifacts/) |

> Changes to the API backend are in `artifacts/api-server/`. Do NOT modify API code when working in `artifacts/fnashha-expo/`.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Expo | ~54.0.36 (SDK 53/54) |
| Navigation | Expo Router (file-based) | v4 |
| Language | TypeScript + React Native | RN 0.81.5 |
| JS Engine | Hermes | — |
| State — Server | TanStack React Query | v5 |
| State — Client | React Context (Auth + Theme) | — |
| Styling | React Native StyleSheet + `expo-linear-gradient` | — |
| Fonts | Cairo Arabic (400, 500, 600, 700) via `expo-font` | — |
| Icons | `@expo/vector-icons` → Feather icon set | — |
| Auth | JWT (access 15 min + refresh 30 days) in AsyncStorage | — |
| HTTP | Custom `apiFetch` / `apiUpload` in `hooks/useApi.ts` | — |
| Notifications | `expo-notifications` + APNs/FCM | — |
| Audio | `expo-av` | — |
| Image Picker | `expo-image-picker` | ~17.0.9 |
| Animations | `react-native-reanimated` | — |
| Safe Area | `react-native-safe-area-context` | — |

---

## User Roles

| Role | Arabic | Description |
|---|---|---|
| `customer` | عميل | Posts requests, selects offers, pays, rates technicians |
| `technician` | فني | Submits offers, completes jobs, earns points |

> There is no admin role in the mobile app. Admin actions are done via the web frontend.

---

## App ID / Bundle

| Platform | Bundle ID / App ID |
|---|---|
| iOS | `com.fnashha.app` |
| Android | `com.fnashha.app` |
| Expo Scheme | `fnashha-expo` |
| Deep Link Scheme | `fnashha-expo://` |

---

## Key Brand Constants (`constants/brand.ts`)

```ts
BRAND.NAME     = 'فنشها'
BRAND.SLUG     = 'fnashha-expo'
BRAND.SCHEME   = 'fnashha-expo'
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL (used in production builds) |
| `API_BASE_URL` | Fallback / local dev server URL |

Resolved at runtime by `hooks/api-base.ts` → `apiUrl(path)`.

In `app.config.js`: `extra.origin` is set from `process.env.API_BASE_URL`.

---

## Primary Colors

The brand color is **amber** (`#E9B73A`). The full palette is in `constants/colors.ts` and exposed via `useColors()`.

| Token | Light | Dark |
|---|---|---|
| `primary` | `#E9B73A` | `#E9B73A` |
| `background` | `#F8F6F0` | `#0F1117` |
| `card` | `#FFFFFF` | `#1A1E27` |
| `foreground` | `#1A1A1A` | `#F1F1F1` |
| `mutedForeground` | `#6B7280` | `#9CA3AF` |
| `border` | `#E5E7EB` | `#2D3340` |

---

*Last updated: July 2026 — migrated from FNASHHA_EXPO_HANDOFF.md*
